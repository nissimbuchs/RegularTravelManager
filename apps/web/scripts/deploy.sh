#!/bin/bash

# Frontend Deployment Script for RTM
set -e

# Configuration
BUCKET_NAME="rtm-frontend-prod"
DISTRIBUTION_ID="E1OBOFZO1FG0A8"  # CloudFront distribution ID
REGION="eu-central-1"

echo "🚀 Starting frontend deployment..."

# Build the Angular application
echo "📦 Building Angular application..."
npm run build

# Check if build was successful
if [ ! -d "dist/web/browser" ]; then
  echo "❌ Build failed - dist/web/browser directory not found"
  exit 1
fi

# Sync files to S3
echo "☁️  Uploading to S3..."
aws s3 sync dist/web/browser/ s3://$BUCKET_NAME --delete --region $REGION

# Set proper content types
echo "🔧 Setting content types..."
aws s3 cp dist/web/browser/ s3://$BUCKET_NAME --recursive --exclude "*" --include "*.html" --content-type "text/html" --metadata-directive REPLACE --region $REGION
aws s3 cp dist/web/browser/ s3://$BUCKET_NAME --recursive --exclude "*" --include "*.css" --content-type "text/css" --metadata-directive REPLACE --region $REGION
aws s3 cp dist/web/browser/ s3://$BUCKET_NAME --recursive --exclude "*" --include "*.js" --content-type "application/javascript" --metadata-directive REPLACE --region $REGION
aws s3 cp dist/web/browser/ s3://$BUCKET_NAME --recursive --exclude "*" --include "*.json" --content-type "application/json" --metadata-directive REPLACE --region $REGION

# Invalidate CloudFront cache if distribution ID is set
if [ -n "$DISTRIBUTION_ID" ]; then
  echo "🔄 Invalidating CloudFront cache..."
  aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*" --region $REGION
  echo "✅ CloudFront cache invalidation initiated"
else
  echo "⚠️  DISTRIBUTION_ID not set - skipping CloudFront invalidation"
fi

echo "✅ Frontend deployment completed successfully!"
echo "🌐 Application available at: https://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"