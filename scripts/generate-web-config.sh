#!/bin/bash

# Script to generate web configuration file from AWS SSM parameters
# Usage: ./scripts/generate-web-config.sh <environment>
# Example: ./scripts/generate-web-config.sh dev

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to get SSM parameter
get_parameter() {
    local param_name="$1"
    local description="$2"
    
    print_info "Fetching $description from $param_name"
    
    local value=$(aws ssm get-parameter --name "$param_name" --query 'Parameter.Value' --output text 2>/dev/null)
    
    if [ $? -ne 0 ] || [ -z "$value" ]; then
        print_error "Failed to get parameter: $param_name"
        exit 1
    fi
    
    echo "$value"
}

# Function to upload config to S3
upload_to_s3() {
    local config_content="$1"
    local bucket_name="$2"
    local environment="$3"
    
    # Create temporary file
    local temp_file=$(mktemp)
    echo "$config_content" > "$temp_file"
    
    print_info "Uploading config.json to S3 bucket: $bucket_name"
    
    # Upload main config file
    aws s3 cp "$temp_file" "s3://$bucket_name/assets/config/config.json" \
        --content-type "application/json" \
        --cache-control "no-cache"
    
    if [ $? -eq 0 ]; then
        print_success "Uploaded config.json"
    else
        print_error "Failed to upload config.json"
        rm -f "$temp_file"
        exit 1
    fi
    
    # Upload environment-specific config file
    aws s3 cp "$temp_file" "s3://$bucket_name/assets/config/config.$environment.json" \
        --content-type "application/json" \
        --cache-control "no-cache"
    
    if [ $? -eq 0 ]; then
        print_success "Uploaded config.$environment.json"
    else
        print_error "Failed to upload config.$environment.json"
    fi
    
    # Clean up
    rm -f "$temp_file"
}

# Main function
main() {
    local environment="$1"
    
    if [ -z "$environment" ]; then
        print_error "Usage: $0 <environment>"
        print_info "Example: $0 dev"
        exit 1
    fi
    
    print_info "Generating web configuration for environment: $environment"
    print_info "======================================================"
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Get region
    local region=$(aws configure get region)
    if [ -z "$region" ]; then
        region="eu-central-1"  # Default region
        print_warning "No AWS region configured, using default: $region"
    fi
    
    # Get configuration values from SSM
    local api_url=$(get_parameter "/rtm/$environment/api/base-url" "API Gateway URL")
    local user_pool_id=$(get_parameter "/rtm/$environment/cognito/user-pool-id" "Cognito User Pool ID")
    local client_id=$(get_parameter "/rtm/$environment/cognito/client-id" "Cognito Client ID")
    
    # Get S3 bucket name for web hosting
    local bucket_name=$(get_parameter "/rtm/$environment/web/bucket-name" "Web S3 Bucket Name")
    
    print_success "Retrieved all required parameters"
    
    # Generate configuration JSON
    local config_json=$(cat <<EOF
{
  "apiUrl": "$api_url",
  "cognito": {
    "userPoolId": "$user_pool_id",
    "userPoolClientId": "$client_id",
    "region": "$region",
    "useMockAuth": false
  },
  "environment": "$environment"
}
EOF
)
    
    print_info "Generated configuration:"
    echo "$config_json" | jq . 2>/dev/null || echo "$config_json"
    
    # Upload to S3
    upload_to_s3 "$config_json" "$bucket_name" "$environment"
    
    print_success "Web configuration generated and uploaded successfully!"
    print_info "Config available at:"
    print_info "  - s3://$bucket_name/assets/config/config.json"
    print_info "  - s3://$bucket_name/assets/config/config.$environment.json"
    
    # Suggest invalidating CloudFront if available
    local distribution_id=$(aws ssm get-parameter --name "/rtm/$environment/web/distribution-id" --query 'Parameter.Value' --output text 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$distribution_id" ]; then
        print_info "To refresh the config immediately, run:"
        print_info "  aws cloudfront create-invalidation --distribution-id $distribution_id --paths '/assets/config/*'"
    fi
}

# Run main function with all arguments
main "$@"