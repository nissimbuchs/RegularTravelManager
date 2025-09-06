#!/bin/bash

# API Deployment Script for RegularTravelManager
set -e

# Configuration
STACK_NAME="rtm-api"
ENVIRONMENT="${1:-dev}"  # Default to dev, can pass staging/production

# Validate environment parameter
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Valid options: dev, staging, production"
    exit 1
fi
REGION="eu-central-1"

echo "🚀 Starting API deployment to $ENVIRONMENT environment..."

# Check if AWS SAM is installed
if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI not found. Installing..."
    
    # Install SAM CLI based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install aws-sam-cli
    else
        echo "Please install AWS SAM CLI manually: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
        exit 1
    fi
fi

# Build the application
echo "📦 Building Lambda function..."
npm run build

# Validate SAM template
echo "🔍 Validating SAM template..."
sam validate --template template.yaml --region $REGION

# Build SAM application
echo "🏗️  Building SAM application..."
sam build --template template.yaml --region $REGION

# Deploy with SAM
echo "🚢 Deploying to AWS..."
sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name "$STACK_NAME-$ENVIRONMENT" \
    --s3-bucket "rtm-sam-deployments-$REGION" \
    --s3-prefix "$STACK_NAME-$ENVIRONMENT" \
    --region $REGION \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides Environment=$ENVIRONMENT \
    --confirm-changeset

# Get the API URL
echo "📋 Retrieving deployment information..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME-$ENVIRONMENT" \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

echo "✅ API deployment completed successfully!"
echo "🌐 API URL: $API_URL"
echo ""
echo "📋 Next steps:"
echo "1. Test the API endpoints"
echo "2. Update frontend environment.$ENVIRONMENT.ts with the new API URL"
echo "3. Redeploy frontend if needed"
echo ""
echo "🔧 Useful commands:"
echo "  sam logs -n RTMApiFunction --stack-name $STACK_NAME-$ENVIRONMENT --tail"
echo "  aws logs describe-log-groups --log-group-name-prefix /aws/lambda/rtm-api"