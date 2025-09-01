#!/bin/bash

# Script to setup LocalStack Pro or Community mode
# Usage: ./scripts/setup-localstack-mode.sh [pro|community]

set -e

MODE=${1:-pro}

case $MODE in
  "pro")
    echo "🏗️ Configuring LocalStack Pro mode..."
    
    # Check if LocalStack API key is set
    if [ -z "$LOCALSTACK_API_KEY" ]; then
      echo "❌ LOCALSTACK_API_KEY environment variable is not set!"
      echo "   Please set your LocalStack Pro license key:"
      echo "   export LOCALSTACK_API_KEY=your_license_key_here"
      exit 1
    fi
    
    # Update initialization scripts
    echo "📋 Setting up Pro initialization scripts..."
    
    # Rename community scripts to backup
    if [ -f "localstack/init/01-setup-cognito.sh" ]; then
      mv "localstack/init/01-setup-cognito.sh" "localstack/init/01-setup-cognito-community.sh.bak"
    fi
    
    # Link Pro scripts
    if [ -f "localstack/init/01-setup-cognito-pro.sh" ]; then
      ln -sf "01-setup-cognito-pro.sh" "localstack/init/01-setup-cognito.sh"
    fi
    
    if [ -f "localstack/init/03-setup-location-pro.sh" ]; then
      ln -sf "03-setup-location-pro.sh" "localstack/init/03-setup-location.sh"
    fi
    
    # Set environment variables for Pro features
    export MOCK_AUTH_ENABLED=false
    export MOCK_LOCATION_ENABLED=false
    
    echo "✅ LocalStack Pro mode configured!"
    echo "🔄 You may need to restart your development environment:"
    echo "   npm run dev:env:restart"
    ;;
    
  "community")
    echo "🏠 Configuring LocalStack Community mode..."
    
    # Restore community scripts
    if [ -f "localstack/init/01-setup-cognito-community.sh.bak" ]; then
      mv "localstack/init/01-setup-cognito-community.sh.bak" "localstack/init/01-setup-cognito.sh"
    fi
    
    # Remove Pro-only scripts
    if [ -L "localstack/init/03-setup-location.sh" ]; then
      rm "localstack/init/03-setup-location.sh"
    fi
    
    # Set environment variables for community/mock features
    export MOCK_AUTH_ENABLED=true
    export MOCK_LOCATION_ENABLED=true
    
    echo "✅ LocalStack Community mode configured!"
    echo "💡 Using mock authentication and location services"
    echo "🔄 You may need to restart your development environment:"
    echo "   npm run dev:env:restart"
    ;;
    
  *)
    echo "❌ Invalid mode: $MODE"
    echo "Usage: $0 [pro|community]"
    exit 1
    ;;
esac

echo ""
echo "📋 Current Configuration:"
echo "   Mode: $MODE"
echo "   Mock Auth: ${MOCK_AUTH_ENABLED:-true}"
echo "   Mock Location: ${MOCK_LOCATION_ENABLED:-true}"

if [ "$MODE" = "pro" ]; then
  echo "   LocalStack API Key: ${LOCALSTACK_API_KEY:0:10}..."
fi