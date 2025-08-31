#!/bin/bash

# Setup script for API deployment prerequisites
set -e

REGION="eu-central-1"
BUCKET_NAME="rtm-sam-deployments-$REGION"

echo "🛠️  Setting up deployment prerequisites..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Create S3 bucket for SAM deployments if it doesn't exist
if aws s3 ls "s3://$BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "📦 Creating S3 bucket for SAM deployments..."
    aws s3 mb "s3://$BUCKET_NAME" --region $REGION
    echo "✅ Created bucket: $BUCKET_NAME"
else
    echo "✅ S3 bucket already exists: $BUCKET_NAME"
fi

# Install AWS SAM CLI if not present
if ! command -v sam &> /dev/null; then
    echo "📥 Installing AWS SAM CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install aws-sam-cli
    else
        echo "❌ Please install AWS SAM CLI manually:"
        echo "   https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
        exit 1
    fi
fi

echo "✅ Setup completed successfully!"
echo ""
echo "🚀 Ready to deploy! Run:"
echo "   npm run deploy:dev     # Deploy to dev environment"
echo "   npm run deploy:staging # Deploy to staging environment"
echo "   npm run deploy:prod    # Deploy to production environment"