#!/bin/bash

# Fix CloudFront Distribution with correct S3 website endpoint
set -e

BUCKET_NAME="rtm-frontend-prod"
REGION="eu-central-1"

echo "🔧 Creating new CloudFront distribution with correct origin..."

# Create distribution config with correct S3 website endpoint
cat > distribution-config-fixed.json << EOF
{
  "CallerReference": "rtm-frontend-fixed-$(date +%s)",
  "Comment": "RegularTravelManager Frontend Distribution (Fixed)",
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-rtm-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "ForwardedValues": {
      "QueryString": true,
      "Cookies": {"Forward": "none"}
    },
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "MinTTL": 0,
    "DefaultTTL": 0,
    "MaxTTL": 0
  },
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-rtm-frontend",
        "DomainName": "$BUCKET_NAME.s3-website.$REGION.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }
    ]
  },
  "DefaultRootObject": "index.html",
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      },
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true,
  "PriceClass": "PriceClass_All"
}
EOF

# Create the distribution
echo "📡 Creating new CloudFront distribution..."
DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution --distribution-config file://distribution-config-fixed.json --region us-east-1)

# Extract distribution ID
DISTRIBUTION_ID=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.Id')
DOMAIN_NAME=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.DomainName')

echo "✅ New CloudFront distribution created!"
echo "🆔 Distribution ID: $DISTRIBUTION_ID"
echo "🌐 Domain Name: https://$DOMAIN_NAME"

# Update deploy script
sed -i.bak "s/E2REUX92R2H47R/$DISTRIBUTION_ID/g" deploy.sh
echo "✅ Updated deploy.sh with new distribution ID"

# Clean up
rm distribution-config-fixed.json

echo "🎉 CloudFront fix complete!"
echo ""
echo "📋 Next steps:"
echo "1. Wait 10-15 minutes for distribution to deploy"
echo "2. Test your app at: https://$DOMAIN_NAME"
echo ""
echo "⚠️  Old distribution E2REUX92R2H47R can be disabled/deleted from AWS Console"