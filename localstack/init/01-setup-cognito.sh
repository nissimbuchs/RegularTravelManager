#!/bin/bash
set -e

echo "🔐 Setting up Authentication (Mock Mode for LocalStack Free)..."

# Since Cognito is a Pro feature in LocalStack, we'll use mock authentication
# The actual user authentication is handled by the frontend auth service

echo "ℹ️  Cognito is a Pro feature in LocalStack - using mock authentication instead"
echo "📋 Production-matching test users available in development:"
echo "  👤 employee1@company.com (John Employee) - Default user"
echo "  👤 employee2@company.com (Jane Worker)"  
echo "  👔 manager1@company.com (Bob Manager)"
echo "  👔 manager2@company.com (Alice Director)"
echo "  🔐 admin1@company.com (Sarah Admin)"
echo "  🔐 admin2@company.com (David SuperAdmin)"
echo ""
echo "🔧 To switch users in development, run in browser console:"
echo "   localStorage.setItem('mockUser', 'employee1')"
echo "   localStorage.setItem('mockUser', 'employee2')" 
echo "   localStorage.setItem('mockUser', 'manager1')"
echo "   localStorage.setItem('mockUser', 'manager2')"
echo "   localStorage.setItem('mockUser', 'admin1')"
echo "   localStorage.setItem('mockUser', 'admin2')"
echo "   window.location.reload()"
echo ""

# Create mock environment file for consistency
mkdir -p /tmp/localstack
cat > /tmp/localstack/.env.cognito << EOF
# Mock Cognito configuration for LocalStack Free
COGNITO_USER_POOL_ID=mock-pool-id
COGNITO_CLIENT_ID=mock-client-id
MOCK_AUTH_ENABLED=true
EOF

echo "✅ Mock authentication setup complete!"
echo "💡 Users are handled by frontend auth service in development mode"