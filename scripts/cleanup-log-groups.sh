#!/bin/bash

# AWS CloudWatch Log Groups Cleanup Script
# Removes orphaned log groups that can cause deployment conflicts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT="${1:-dev}"

echo -e "${BLUE}🧹 RTM Log Groups Cleanup Script${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo ""

# Function to list RTM log groups
list_rtm_log_groups() {
    aws logs describe-log-groups \
        --log-group-name-prefix "/aws/lambda/rtm-${ENVIRONMENT}-" \
        --query 'logGroups[].logGroupName' \
        --output text 2>/dev/null || echo ""
}

# Function to check if a stack exists
stack_exists() {
    local stack_name="$1"
    aws cloudformation describe-stacks --stack-name "$stack_name" --query 'Stacks[0].StackStatus' --output text 2>/dev/null >/dev/null
    return $?
}

# Function to delete log group
delete_log_group() {
    local log_group="$1"
    echo -e "${YELLOW}  Deleting: ${log_group}${NC}"
    if aws logs delete-log-group --log-group-name "$log_group" 2>/dev/null; then
        echo -e "${GREEN}  ✓ Deleted: ${log_group}${NC}"
        return 0
    else
        echo -e "${RED}  ✗ Failed to delete: ${log_group}${NC}"
        return 1
    fi
}

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: AWS credentials not configured or expired${NC}"
    exit 1
fi

# Get list of RTM log groups
echo -e "${BLUE}📋 Scanning for RTM log groups...${NC}"
RTM_LOG_GROUPS=$(list_rtm_log_groups)

if [ -z "$RTM_LOG_GROUPS" ]; then
    echo -e "${GREEN}✅ No RTM log groups found for environment: ${ENVIRONMENT}${NC}"
    exit 0
fi

echo -e "${YELLOW}Found RTM log groups:${NC}"
echo "$RTM_LOG_GROUPS" | while read -r log_group; do
    [ -n "$log_group" ] && echo "  - $log_group"
done
echo ""

# Check stack states
INFRASTRUCTURE_EXISTS=$(stack_exists "rtm-${ENVIRONMENT}-infrastructure" && echo "true" || echo "false")
LAMBDA_EXISTS=$(stack_exists "rtm-${ENVIRONMENT}-lambda" && echo "true" || echo "false")
WEB_EXISTS=$(stack_exists "rtm-${ENVIRONMENT}-web" && echo "true" || echo "false")

echo -e "${BLUE}📊 Stack Status:${NC}"
echo "  Infrastructure: $([ "$INFRASTRUCTURE_EXISTS" = "true" ] && echo -e "${GREEN}EXISTS${NC}" || echo -e "${YELLOW}MISSING${NC}")"
echo "  Lambda: $([ "$LAMBDA_EXISTS" = "true" ] && echo -e "${GREEN}EXISTS${NC}" || echo -e "${YELLOW}MISSING${NC}")"
echo "  Web: $([ "$WEB_EXISTS" = "true" ] && echo -e "${GREEN}EXISTS${NC}" || echo -e "${YELLOW}MISSING${NC}")"
echo ""

# Determine cleanup strategy
if [ "$INFRASTRUCTURE_EXISTS" = "false" ] && [ "$LAMBDA_EXISTS" = "false" ] && [ "$WEB_EXISTS" = "false" ]; then
    echo -e "${YELLOW}⚠️  All RTM stacks are missing - these appear to be orphaned log groups${NC}"
    CLEANUP_ALL="true"
elif [ "$LAMBDA_EXISTS" = "false" ] && [ "$WEB_EXISTS" = "false" ]; then
    echo -e "${YELLOW}⚠️  Lambda and Web stacks missing - some log groups may be orphaned${NC}"
    CLEANUP_ALL="prompt"
else
    echo -e "${GREEN}ℹ️  RTM stacks exist - will only clean up known problematic log groups${NC}"
    CLEANUP_ALL="false"
fi

# Known problematic log groups that commonly cause conflicts
PROBLEMATIC_PATTERNS=(
    "/aws/lambda/rtm-${ENVIRONMENT}-load-sample-data-custom-resource"
    "/aws/lambda/rtm-${ENVIRONMENT}-web-config-generator-provider"
    "/aws/lambda/rtm-${ENVIRONMENT}-user-creator-provider"
)

DELETED_COUNT=0
FAILED_COUNT=0

if [ "$CLEANUP_ALL" = "true" ]; then
    echo -e "${YELLOW}🗑️  Deleting all RTM log groups (stacks are missing):${NC}"
    echo "$RTM_LOG_GROUPS" | while read -r log_group; do
        if [ -n "$log_group" ]; then
            if delete_log_group "$log_group"; then
                DELETED_COUNT=$((DELETED_COUNT + 1))
            else
                FAILED_COUNT=$((FAILED_COUNT + 1))
            fi
        fi
    done
elif [ "$CLEANUP_ALL" = "prompt" ]; then
    echo -e "${YELLOW}❓ Some stacks are missing. Delete all RTM log groups? (y/N):${NC}"
    read -r CONFIRM
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🗑️  Deleting all RTM log groups:${NC}"
        echo "$RTM_LOG_GROUPS" | while read -r log_group; do
            if [ -n "$log_group" ]; then
                if delete_log_group "$log_group"; then
                    DELETED_COUNT=$((DELETED_COUNT + 1))
                else
                    FAILED_COUNT=$((FAILED_COUNT + 1))
                fi
            fi
        done
    else
        echo -e "${BLUE}ℹ️  Skipped full cleanup. Will only check for problematic log groups.${NC}"
        CLEANUP_ALL="false"
    fi
fi

if [ "$CLEANUP_ALL" = "false" ]; then
    echo -e "${YELLOW}🎯 Checking for known problematic log groups:${NC}"
    for pattern in "${PROBLEMATIC_PATTERNS[@]}"; do
        if echo "$RTM_LOG_GROUPS" | grep -q "$pattern"; then
            echo -e "${YELLOW}  Found problematic log group: ${pattern}${NC}"
            if delete_log_group "$pattern"; then
                DELETED_COUNT=$((DELETED_COUNT + 1))
            else
                FAILED_COUNT=$((FAILED_COUNT + 1))
            fi
        fi
    done
    
    if [ $DELETED_COUNT -eq 0 ]; then
        echo -e "${GREEN}  ✅ No problematic log groups found${NC}"
    fi
fi

echo ""
echo -e "${BLUE}📊 Cleanup Summary:${NC}"
echo -e "  Deleted: ${GREEN}${DELETED_COUNT}${NC} log groups"
echo -e "  Failed:  ${RED}${FAILED_COUNT}${NC} log groups"

if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some log groups could not be deleted. Check AWS permissions.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Log group cleanup completed successfully${NC}"
fi