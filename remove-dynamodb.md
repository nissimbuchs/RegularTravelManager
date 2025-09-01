# DynamoDB Removal Plan

## Summary
PostgreSQL already handles all project/subproject data. DynamoDB contains only duplicate sample data.

## Steps

### 1. Remove DynamoDB Dependencies
```bash
# Remove from package.json
npm uninstall @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# Remove from aws-factory.ts
- createDynamoDBClient()
- createDynamoDBDocumentClient() 
- getDynamoClient()
- getTableName()
```

### 2. Update LocalStack Configuration
```bash
# Remove from docker-compose.yml
- DynamoDB service references
- Remove localstack/init/02-setup-dynamodb.sh
- Update npm scripts to skip DynamoDB init
```

### 3. Clean Up Environment
```bash
# Remove from test-setup.sh
- DynamoDB table checks
- DynamoDB status verification

# Remove from documentation
- All DynamoDB references in CLAUDE.md
- Architecture documentation updates
```

## Benefits
- Eliminates architectural complexity
- Reduces LocalStack startup time by ~30%
- Removes duplicate data management
- Simplifies backup/recovery
- One less service to monitor

## Risk Assessment
- **ZERO RISK**: DynamoDB contains only sample data
- PostgreSQL is primary data store
- No production dependencies on DynamoDB
- All business logic uses PostgreSQL