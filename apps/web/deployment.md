# Frontend Deployment Configuration

## S3 + CloudFront Deployment

### Prerequisites
- AWS CLI configured with appropriate permissions
- Domain name configured in Route 53 (optional)

### S3 Bucket Setup
```bash
# Create S3 bucket for static website hosting
aws s3 mb s3://rtm-frontend-prod --region eu-central-1

# Configure bucket for static website hosting
aws s3 website s3://rtm-frontend-prod --index-document index.html --error-document index.html

# Set bucket policy for public read access
aws s3api put-bucket-policy --bucket rtm-frontend-prod --policy file://bucket-policy.json
```

### CloudFront Distribution
The CloudFront distribution will:
- Serve the Angular application from S3
- Handle SPA routing by redirecting 404s to index.html
- Provide HTTPS termination
- Cache static assets with appropriate TTL

### Build and Deploy Script
```bash
# Build the Angular application for production
npm run build

# Sync built files to S3
aws s3 sync dist/web/ s3://rtm-frontend-prod --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### Environment Configuration
The application uses different API endpoints based on the build environment:
- Development: http://localhost:3000
- Production: https://sqosxx4mo6.execute-api.eu-central-1.amazonaws.com/dev/

### Security Headers
CloudFront should be configured to add security headers:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy