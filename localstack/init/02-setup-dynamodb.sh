#!/bin/bash
set -e

echo "🗄️ Setting up DynamoDB tables..."

# Set AWS CLI to use LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=eu-central-1

# Create Projects Table
echo "Creating Projects table..."
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name rtm-projects-dev \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-central-1

echo "✅ Projects table created"

# Create Subprojects Table
echo "Creating Subprojects table..."
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name rtm-subprojects-dev \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=projectId,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    'IndexName=ProjectIndex,KeySchema=[{AttributeName=projectId,KeyType=HASH}],Projection={ProjectionType=ALL}' \
  --billing-mode PAY_PER_REQUEST \
  --region eu-central-1

echo "✅ Subprojects table created"

# Insert sample data
echo "Inserting sample data..."

# Sample Project 1
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
  --table-name rtm-projects-dev \
  --item '{
    "id": {"S": "proj-001"},
    "name": {"S": "Digital Transformation Initiative"},
    "description": {"S": "Company-wide digital transformation project"},
    "status": {"S": "active"},
    "startDate": {"S": "2024-01-01"},
    "endDate": {"S": "2024-12-31"},
    "budget": {"N": "500000"},
    "createdAt": {"S": "2024-01-01T00:00:00Z"},
    "updatedAt": {"S": "2024-01-01T00:00:00Z"}
  }' \
  --region eu-central-1

# Sample Project 2
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
  --table-name rtm-projects-dev \
  --item '{
    "id": {"S": "proj-002"},
    "name": {"S": "Office Relocation Project"},
    "description": {"S": "Relocating main office to new building"},
    "status": {"S": "planning"},
    "startDate": {"S": "2024-06-01"},
    "endDate": {"S": "2024-09-30"},
    "budget": {"N": "250000"},
    "createdAt": {"S": "2024-01-15T00:00:00Z"},
    "updatedAt": {"S": "2024-01-15T00:00:00Z"}
  }' \
  --region eu-central-1

# Sample Subprojects
aws --endpoint-url=http://localhost:4566 dynamodb put-item \
  --table-name rtm-subprojects-dev \
  --item '{
    "id": {"S": "sub-001"},
    "projectId": {"S": "proj-001"},
    "name": {"S": "Web Platform Upgrade"},
    "description": {"S": "Upgrading customer-facing web platform"},
    "status": {"S": "active"},
    "budget": {"N": "150000"},
    "createdAt": {"S": "2024-01-02T00:00:00Z"},
    "updatedAt": {"S": "2024-01-02T00:00:00Z"}
  }' \
  --region eu-central-1

aws --endpoint-url=http://localhost:4566 dynamodb put-item \
  --table-name rtm-subprojects-dev \
  --item '{
    "id": {"S": "sub-002"},
    "projectId": {"S": "proj-001"},
    "name": {"S": "Mobile App Development"},
    "description": {"S": "New mobile application for customers"},
    "status": {"S": "planning"},
    "budget": {"N": "200000"},
    "createdAt": {"S": "2024-01-05T00:00:00Z"},
    "updatedAt": {"S": "2024-01-05T00:00:00Z"}
  }' \
  --region eu-central-1

aws --endpoint-url=http://localhost:4566 dynamodb put-item \
  --table-name rtm-subprojects-dev \
  --item '{
    "id": {"S": "sub-003"},
    "projectId": {"S": "proj-002"},
    "name": {"S": "Furniture & Equipment"},
    "description": {"S": "Procuring furniture and equipment for new office"},
    "status": {"S": "pending"},
    "budget": {"N": "100000"},
    "createdAt": {"S": "2024-01-16T00:00:00Z"},
    "updatedAt": {"S": "2024-01-16T00:00:00Z"}
  }' \
  --region eu-central-1

echo "✅ Sample data inserted"

# Verify tables exist
echo "Verifying tables..."
TABLES=$(aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region eu-central-1 --query 'TableNames' --output text)
echo "📋 Created tables: $TABLES"

echo "✅ DynamoDB setup complete!"