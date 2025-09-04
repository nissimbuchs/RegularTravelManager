#!/bin/bash

# RegularTravelManager Development Environment Setup
# This script sets up the complete development environment including sample data
# Version: 1.0
# Date: 2025-09-04

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}ℹ️  ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

print_error() {
    echo -e "${RED}❌ ${1}${NC}"
}

print_header() {
    echo -e "${BLUE}🚀 ${1}${NC}"
    echo "=================================="
}

print_header "RegularTravelManager Development Setup"
echo "This script will set up your complete development environment with sample data"
echo ""

# Step 1: Wait for services to be ready
print_status "Step 1: Waiting for infrastructure services..."
echo "Checking PostgreSQL, Redis, and LocalStack availability..."

# Wait for PostgreSQL
print_status "Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker exec rtm-postgres pg_isready -U nissim -d travel_manager_dev >/dev/null 2>&1; then
        print_success "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL not ready after 30 seconds"
        exit 1
    fi
    sleep 1
done

# Wait for Redis
print_status "Waiting for Redis..."
for i in {1..30}; do
    if docker exec rtm-redis redis-cli ping >/dev/null 2>&1; then
        print_success "Redis is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Redis not ready after 30 seconds"
        exit 1
    fi
    sleep 1
done

# Wait for LocalStack
print_status "Waiting for LocalStack..."
for i in {1..30}; do
    if curl -f -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
        print_success "LocalStack is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "LocalStack not ready after 30 seconds"
        exit 1
    fi
    sleep 1
done

# Step 2: Run database migrations
print_status "Step 2: Setting up database schema..."
npm run db:migrate
print_success "Database migrations completed"

# Step 3: Load comprehensive sample data
print_status "Step 3: Loading comprehensive sample data..."
npm run db:seed
print_success "Sample data loaded successfully"

# Step 4: Initialize AWS services in LocalStack
print_status "Step 4: Initializing AWS services..."
npm run localstack:init
print_success "AWS services initialized"

# Step 5: Verify complete setup
print_status "Step 5: Running environment verification..."
./test-setup.sh

print_header "Setup Complete! 🎉"
echo ""
print_success "Your RegularTravelManager development environment is ready!"
echo ""
echo -e "${BLUE}📊 What's been set up:${NC}"
echo "├── PostgreSQL with complete database schema"
echo "├── Redis for caching"
echo "├── LocalStack with AWS services (S3, Location)"
echo "├── Comprehensive Swiss business sample data:"
echo "│   ├── 2 Admin users (admin1@company.ch, admin2@company.ch)"
echo "│   ├── 2 Managers (manager1@company.ch, manager2@company.ch)"
echo "│   ├── 6 Employees across major Swiss cities"
echo "│   ├── 4 Business projects with realistic cost rates"
echo "│   ├── 8 Subprojects with precise Swiss coordinates"
echo "│   └── 5 Complete travel request examples"
echo "└── All audit trails and status change history"
echo ""
echo -e "${BLUE}🚀 Ready to start development:${NC}"
echo "1. Start API: ${GREEN}npm run dev:api:local${NC}"
echo "2. Start Web: ${GREEN}npm run dev:web${NC}"
echo "3. Visit: ${GREEN}http://localhost:4200${NC}"
echo ""
echo -e "${BLUE}💡 Development Tips:${NC}"
echo "• Switch users in browser console: localStorage.setItem('mockUser', 'admin1')"
echo "• View logs: ${GREEN}npm run dev:env:logs${NC}"
echo "• Reset everything: ${GREEN}npm run dev:env:clean && npm run dev:setup${NC}"