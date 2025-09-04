#!/bin/bash

# Sample Data Loading Script for LocalStack Environment
# Description: Load comprehensive sample data for development and testing
# Version: 1.0
# Date: 2025-09-04

set -e

echo "🔄 Loading comprehensive sample data for RegularTravelManager..."

# Configuration
DATABASE_URL="${DATABASE_URL:-postgresql://nissim:devpass123@localhost:5432/travel_manager_dev}"
SCRIPT_DIR="$(dirname "$0")"
DATA_SCRIPT="${SCRIPT_DIR}/../../infrastructure/data/sample-data.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if sample data script exists
if [ ! -f "$DATA_SCRIPT" ]; then
    print_error "Sample data script not found at: $DATA_SCRIPT"
    exit 1
fi

# Check if database is available
print_status "Checking database connectivity..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    print_error "Cannot connect to database. Ensure PostgreSQL is running and accessible."
    print_error "Database URL: $DATABASE_URL"
    exit 1
fi

print_success "Database connection successful"

# Check if migrations have been run
print_status "Verifying database schema..."
TABLES_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('employees', 'projects', 'subprojects', 'travel_requests');" 2>/dev/null | tr -d ' ')

if [ "$TABLES_COUNT" != "4" ]; then
    print_error "Database schema incomplete. Please run migrations first:"
    print_error "  cd apps/api && npm run db:migrate"
    exit 1
fi

print_success "Database schema verified"

# Check if sample data already exists
print_status "Checking for existing sample data..."
EMPLOYEE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM employees WHERE employee_id LIKE 'EMP-%' OR employee_id LIKE 'ADM-%' OR employee_id LIKE 'MGR-%';" 2>/dev/null | tr -d ' ')

if [ "$EMPLOYEE_COUNT" -gt "0" ]; then
    print_warning "Sample data already exists ($EMPLOYEE_COUNT employees found)"
    read -p "Do you want to clear existing data and reload? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Clearing existing sample data..."
        
        # Clear data in reverse order of dependencies
        psql "$DATABASE_URL" -c "TRUNCATE TABLE request_status_history CASCADE;" > /dev/null 2>&1
        psql "$DATABASE_URL" -c "TRUNCATE TABLE employee_address_history CASCADE;" > /dev/null 2>&1
        psql "$DATABASE_URL" -c "TRUNCATE TABLE travel_requests CASCADE;" > /dev/null 2>&1
        psql "$DATABASE_URL" -c "TRUNCATE TABLE subprojects CASCADE;" > /dev/null 2>&1
        psql "$DATABASE_URL" -c "TRUNCATE TABLE projects CASCADE;" > /dev/null 2>&1
        psql "$DATABASE_URL" -c "DELETE FROM employees WHERE employee_id LIKE 'EMP-%' OR employee_id LIKE 'ADM-%' OR employee_id LIKE 'MGR-%';" > /dev/null 2>&1
        
        print_success "Existing sample data cleared"
    else
        print_status "Skipping sample data loading"
        exit 0
    fi
fi

# Load sample data
print_status "Loading comprehensive sample data..."
print_status "Data includes:"
echo "  • Swiss employees with realistic addresses"
echo "  • Manager hierarchy and admin users"
echo "  • Projects across major Swiss cities"
echo "  • Complete travel request lifecycle examples"
echo "  • Audit trails and status change history"

if psql "$DATABASE_URL" -f "$DATA_SCRIPT" > /dev/null 2>&1; then
    print_success "Sample data loaded successfully"
else
    print_error "Failed to load sample data"
    print_error "Check the SQL script for syntax errors: $DATA_SCRIPT"
    exit 1
fi

# Verify data loading
print_status "Verifying loaded data..."

# Count records by type
ADMIN_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM employees WHERE employee_id LIKE 'ADM-%';" | tr -d ' ')
MANAGER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM employees WHERE employee_id LIKE 'MGR-%';" | tr -d ' ')
EMPLOYEE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM employees WHERE employee_id LIKE 'EMP-%';" | tr -d ' ')
PROJECT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM projects;" | tr -d ' ')
SUBPROJECT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM subprojects;" | tr -d ' ')
REQUEST_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM travel_requests;" | tr -d ' ')

echo
print_success "Data Loading Summary:"
echo "  👑 Admin Users: $ADMIN_COUNT"
echo "  👨‍💼 Managers: $MANAGER_COUNT" 
echo "  👥 Employees: $EMPLOYEE_COUNT"
echo "  🏢 Projects: $PROJECT_COUNT"
echo "  📍 Subprojects: $SUBPROJECT_COUNT"
echo "  ✈️  Travel Requests: $REQUEST_COUNT"

# Geographic coverage check
print_status "Verifying geographic coverage..."
CITIES=$(psql "$DATABASE_URL" -t -c "SELECT DISTINCT home_city FROM employees ORDER BY home_city;" | tr '\n' ', ' | sed 's/, $//')
echo "  🏙️  Employee Cities: $CITIES"

SUBPROJECT_CITIES=$(psql "$DATABASE_URL" -t -c "SELECT DISTINCT city FROM subprojects ORDER BY city;" | tr '\n' ', ' | sed 's/, $//')
echo "  🏭 Subproject Cities: $SUBPROJECT_CITIES"

# Request status distribution
print_status "Travel request status distribution:"
STATUS_COUNTS=$(psql "$DATABASE_URL" -t -c "SELECT status, count(*) FROM travel_requests GROUP BY status ORDER BY status;")
while IFS='|' read -r status count; do
    status=$(echo "$status" | tr -d ' ')
    count=$(echo "$count" | tr -d ' ')
    if [ -n "$status" ]; then
        echo "  📊 $status: $count requests"
    fi
done <<< "$STATUS_COUNTS"

# Distance calculation verification
print_status "Verifying distance calculations..."
AVG_DISTANCE=$(psql "$DATABASE_URL" -t -c "SELECT ROUND(AVG(calculated_distance_km), 1) FROM travel_requests;" | tr -d ' ')
MAX_DISTANCE=$(psql "$DATABASE_URL" -t -c "SELECT ROUND(MAX(calculated_distance_km), 1) FROM travel_requests;" | tr -d ' ')
MIN_DISTANCE=$(psql "$DATABASE_URL" -t -c "SELECT ROUND(MIN(calculated_distance_km), 1) FROM travel_requests;" | tr -d ' ')

echo "  📏 Distance Range: ${MIN_DISTANCE}km - ${MAX_DISTANCE}km (avg: ${AVG_DISTANCE}km)"

# Audit trail verification
HISTORY_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM request_status_history;" | tr -d ' ')
ADDRESS_HISTORY_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM employee_address_history;" | tr -d ' ')

echo "  📜 Status History Records: $HISTORY_COUNT"
echo "  🏠 Address History Records: $ADDRESS_HISTORY_COUNT"

echo
print_success "✨ Sample data loading completed successfully!"
print_success "🎯 Environment is ready for development and testing"

# Development tips
echo
print_status "Development Tips:"
echo "  💡 Admin Users: admin1@company.ch, admin2@company.ch"  
echo "  💡 Managers: manager1@company.ch, manager2@company.ch"
echo "  💡 Employees: employee1@company.ch through employee6@company.ch"
echo "  💡 All users are configured for Cognito authentication"
echo "  💡 Use LocalStack dashboard to manage test users: http://localhost:4566"
echo "  💡 Geographic data covers major Swiss cities with accurate coordinates"

echo
print_success "🚀 Ready to develop with comprehensive Swiss business data!"