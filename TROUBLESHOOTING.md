# RegularTravelManager - Troubleshooting Guide

## Deployment Issues

### CloudWatch Log Group Conflicts

**Symptom:** Deployment fails with error like:
```
A log group with the specified name already exists. (Service: CloudWatchLogs; Status Code: 400; Error Code: ResourceAlreadyExistsException)
```

**Cause:** CloudWatch log groups persist after stack deletion when they don't have proper `RemovalPolicy.DESTROY` configured.

**Solution:**
1. **Run health check first:**
   ```bash
   npm run health:check  # or npm run health:check:staging/production
   ```

2. **Clean up problematic log groups:**
   ```bash
   npm run cleanup:logs  # or npm run cleanup:logs:staging/production
   ```

3. **Use safe deployment:**
   ```bash
   npm run deploy:safe  # Runs health check + cleanup before deployment
   ```

**Prevention:**
- Always use `npm run deploy:safe` instead of `npm run deploy`
- Run `npm run health:check` before any deployment
- Use `npm run destroy:clean` instead of manual stack deletion

### Incomplete Stack Deletion

**Symptom:** Stacks show `DELETE_FAILED` or remain in `UPDATE_COMPLETE` state after deletion.

**Solution:**
1. **Check stack status:**
   ```bash
   npm run health:check:dev
   ```

2. **Manual cleanup if needed:**
   ```bash
   # Delete specific failed stacks
   aws cloudformation delete-stack --stack-name rtm-dev-lambda
   aws cloudformation delete-stack --stack-name rtm-dev-web
   ```

3. **Complete cleanup:**
   ```bash
   npm run destroy:clean  # Destroys stacks + cleans log groups
   ```

### Stack Dependencies

**Order matters:** Our 4-stack architecture has specific dependencies:

```
InfrastructureStack
└── LambdaStack
    └── ApiGatewayStack
        └── WebStack
```

**Deployment:** Always deploy in order (handled by `npm run deploy`)
**Destruction:** Always destroy in reverse order (handled by `npm run destroy`)

### Common Error Patterns

#### 1. Custom Resource Lambda Conflicts
```
/aws/lambda/rtm-dev-load-sample-data-custom-resource already exists
/aws/lambda/rtm-dev-user-creator-provider already exists
```
**Fix:** `npm run cleanup:logs:dev && redeploy`

#### 2. Web Config Generator Conflicts  
```
/aws/lambda/rtm-dev-web-config-generator-provider already exists
```
**Fix:** Delete Web stack first, then cleanup logs

#### 3. Infrastructure Stack Won't Delete
**Check:** Look for resources with `RETAIN` policies (production RDS, etc.)
**Fix:** May require manual resource deletion in AWS Console

## Environment-Specific Issues

### Development (LocalStack)
- **Service not responding:** `npm run dev:env:restart`
- **LocalStack issues:** `docker logs rtm-localstack`
- **Database issues:** `docker logs rtm-postgres`

### Production Deployments
- **Extra caution required** - run health checks twice
- **Backup important resources** before cleanup operations
- **Consider maintenance windows** for destructive operations

## Recovery Procedures

### Complete Environment Reset
```bash
# 1. Clean everything
npm run destroy:clean:dev
npm run dev:env:clean

# 2. Wait for complete deletion (check AWS Console)
npm run health:check:dev

# 3. Fresh setup
npm run dev:env
npm run deploy:safe:dev
```

### Partial Recovery (Frontend Only)
```bash
# If only web stack failed
aws cloudformation delete-stack --stack-name rtm-dev-web
npm run cleanup:logs:dev
npm run deploy:frontend:dev
```

### Log Group Emergency Cleanup
```bash
# List all RTM log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/rtm-dev-"

# Delete specific problematic log group
aws logs delete-log-group --log-group-name "/aws/lambda/rtm-dev-PROBLEMATIC-FUNCTION"

# Or use our script for bulk cleanup
./scripts/cleanup-log-groups.sh dev
```

## Monitoring and Alerts

### Stack Health Monitoring
```bash
# Check all environments
npm run health:check
npm run health:check:staging  
npm run health:check:production

# Continuous monitoring
watch -n 30 'npm run health:check:dev'
```

### CloudFormation Events
```bash
# Monitor stack events during deployment
aws cloudformation describe-stack-events --stack-name rtm-dev-infrastructure --max-items 10
```

## Prevention Best Practices

1. **Always use safe deployment commands:**
   - `npm run deploy:safe` instead of `npm run deploy`
   - `npm run destroy:clean` instead of manual deletion

2. **Regular health checks:**
   - Before any deployment
   - After failed deployments
   - Weekly in development environments

3. **Environment hygiene:**
   - Clean up failed stacks immediately
   - Don't leave stacks in `DELETE_FAILED` state
   - Monitor log group accumulation

4. **Production safety:**
   - Double-check health status before production deployments
   - Backup critical resources before cleanup
   - Use staging environment to test deployment procedures

## Emergency Contacts

- **AWS Support:** [Your AWS Support Plan]
- **Development Team:** [Team Contact Information]
- **Infrastructure Lead:** [Lead Contact Information]

## Useful Commands Reference

```bash
# Health & Status
npm run health:check:dev
npm run health:check:staging
npm run health:check:production

# Safe Operations
npm run deploy:safe
npm run deploy:safe:staging
npm run deploy:safe:production
npm run destroy:clean
npm run destroy:clean:staging  
npm run destroy:clean:production

# Log Management
npm run cleanup:logs:dev
npm run cleanup:logs:staging
npm run cleanup:logs:production

# AWS Direct Commands
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE DELETE_FAILED
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/rtm-"
aws cloudformation describe-stack-events --stack-name rtm-dev-infrastructure
```