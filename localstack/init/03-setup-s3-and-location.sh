#!/bin/bash
set -e

echo "🗂️ Setting up S3 buckets..."

# Set AWS CLI to use LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=eu-central-1

# Create S3 bucket for file storage
echo "Creating S3 bucket..."
aws --endpoint-url=http://localhost:4566 s3api create-bucket \
  --bucket rtm-documents-dev \
  --region eu-central-1 \
  --create-bucket-configuration LocationConstraint=eu-central-1

echo "✅ S3 bucket 'rtm-documents-dev' created"

# Set up bucket policy for development
aws --endpoint-url=http://localhost:4566 s3api put-bucket-policy \
  --bucket rtm-documents-dev \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "DevelopmentAccess",
        "Effect": "Allow",
        "Principal": "*",
        "Action": [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        "Resource": "arn:aws:s3:::rtm-documents-dev/*"
      }
    ]
  }'

echo "✅ S3 bucket policy configured"

# Create Location Service Place Index (mock setup)
# Note: LocalStack Location Service support is limited, so we document the intended setup
echo "Setting up Location Service configuration..."

# Create a place index for Swiss locations (this would work in real AWS)
# For LocalStack, we'll create a mock configuration file
mkdir -p /tmp/localstack/location-service

cat > /tmp/localstack/location-service/place-index-config.json << EOF
{
  "PlaceIndexName": "rtm-swiss-places-dev",
  "DataSource": "Esri",
  "Description": "Place index for Swiss locations in RegularTravelManager development",
  "DataSourceConfiguration": {
    "IntendedUse": "SingleUse"
  },
  "PricingPlan": "RequestBasedUsage"
}
EOF

echo "✅ Location Service configuration prepared"
echo "⚠️  Note: LocalStack has limited Location Service support"
echo "    Real geocoding will be handled by mock service in application code"

# Upload sample documents to S3
echo "Uploading sample documents..."

# Create some sample files
mkdir -p /tmp/sample-docs
echo "Sample expense receipt for Project Digital Transformation" > /tmp/sample-docs/receipt-001.txt
echo "Travel authorization form template" > /tmp/sample-docs/travel-auth-template.txt

# Upload to S3
aws --endpoint-url=http://localhost:4566 s3 cp /tmp/sample-docs/receipt-001.txt s3://rtm-documents-dev/receipts/receipt-001.txt
aws --endpoint-url=http://localhost:4566 s3 cp /tmp/sample-docs/travel-auth-template.txt s3://rtm-documents-dev/templates/travel-auth-template.txt

echo "✅ Sample documents uploaded"

# List buckets to verify
echo "Verifying S3 setup..."
BUCKETS=$(aws --endpoint-url=http://localhost:4566 s3 ls | awk '{print $3}')
echo "📦 Created buckets: $BUCKETS"

# List objects in our bucket
echo "📁 Documents in rtm-documents-dev:"
aws --endpoint-url=http://localhost:4566 s3 ls s3://rtm-documents-dev --recursive

echo "✅ S3 and Location Service setup complete!"