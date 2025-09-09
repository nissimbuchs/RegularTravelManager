#!/bin/bash

# RTM Deployment Health Check Script
# Validates stack states and identifies issues before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT="${1:-dev}"

echo -e "${BLUE}🩺 RTM Deployment Health Check${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo ""

# Function to check if a stack exists and get its status
get_stack_status() {
    local stack_name="$1"
    aws cloudformation describe-stacks --stack-name "$stack_name" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND"
}

# Function to check if log groups exist
check_log_groups() {
    local env="$1"
    aws logs describe-log-groups \
        --log-group-name-prefix "/aws/lambda/rtm-${env}-" \
        --query 'logGroups[].logGroupName' \
        --output text 2>/dev/null || echo ""
}

# Check AWS credentials
echo -e "${BLUE}🔐 Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: AWS credentials not configured or expired${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
REGION=$(aws configure get region 2>/dev/null || echo "us-east-1")
echo -e "${GREEN}✓ AWS credentials valid (Account: ${ACCOUNT_ID}, Region: ${REGION})${NC}"
echo ""

# Check stack statuses
echo -e "${BLUE}📊 Checking CloudFormation stacks...${NC}"

INFRASTRUCTURE_STATUS=$(get_stack_status "rtm-${ENVIRONMENT}-infrastructure")
LAMBDA_STATUS=$(get_stack_status "rtm-${ENVIRONMENT}-lambda")
API_GATEWAY_STATUS=$(get_stack_status "rtm-${ENVIRONMENT}-api-gateway")
WEB_STATUS=$(get_stack_status "rtm-${ENVIRONMENT}-web")

declare -A STACK_STATUSES=(
    ["Infrastructure"]="$INFRASTRUCTURE_STATUS"
    ["Lambda"]="$LAMBDA_STATUS"
    ["API Gateway"]="$API_GATEWAY_STATUS"
    ["Web"]="$WEB_STATUS"
)

HEALTHY_COUNT=0
ISSUES_COUNT=0
RECOMMENDATIONS=()

for stack_type in "Infrastructure" "Lambda" "API Gateway" "Web"; do
    status="${STACK_STATUSES[$stack_type]}"
    
    case "$status" in
        "CREATE_COMPLETE"|"UPDATE_COMPLETE")
            echo -e "  ${stack_type}: ${GREEN}${status} ✓${NC}"
            HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
            ;;
        "NOT_FOUND")
            echo -e "  ${stack_type}: ${YELLOW}${status} ⚠${NC}"
            ;;
        "CREATE_FAILED"|"UPDATE_FAILED"|"DELETE_FAILED"|"ROLLBACK_COMPLETE"|"UPDATE_ROLLBACK_COMPLETE")
            echo -e "  ${stack_type}: ${RED}${status} ❌${NC}"
            ISSUES_COUNT=$((ISSUES_COUNT + 1))
            case "$stack_type" in
                "Lambda")
                    RECOMMENDATIONS+=("Delete failed Lambda stack: aws cloudformation delete-stack --stack-name rtm-${ENVIRONMENT}-lambda")
                    ;;
                "Web")
                    RECOMMENDATIONS+=("Delete failed Web stack: aws cloudformation delete-stack --stack-name rtm-${ENVIRONMENT}-web")
                    ;;
                "API Gateway")
                    RECOMMENDATIONS+=("Delete failed API Gateway stack: aws cloudformation delete-stack --stack-name rtm-${ENVIRONMENT}-api-gateway")
                    ;;
            esac
            ;;
        "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS"|"DELETE_IN_PROGRESS")
            echo -e "  ${stack_type}: ${YELLOW}${status} ⏳${NC}"
            RECOMMENDATIONS+=("Wait for ${stack_type} stack operation to complete before deploying")
            ;;
        *)
            echo -e "  ${stack_type}: ${YELLOW}${status} ❓${NC}"
            ;;
    esac
done

echo ""

# Check for problematic log groups
echo -e "${BLUE}📋 Checking for potentially conflicting log groups...${NC}"
LOG_GROUPS=$(check_log_groups "$ENVIRONMENT")

PROBLEMATIC_PATTERNS=(
    "/aws/lambda/rtm-${ENVIRONMENT}-load-sample-data-custom-resource"
    "/aws/lambda/rtm-${ENVIRONMENT}-web-config-generator-provider"
    "/aws/lambda/rtm-${ENVIRONMENT}-user-creator-provider"
)

CONFLICTING_LOGS=()
for pattern in "${PROBLEMATIC_PATTERNS[@]}"; do
    if echo "$LOG_GROUPS" | grep -q "$pattern"; then
        echo -e "  ${RED}❌ Found potentially conflicting log group: ${pattern}${NC}"
        CONFLICTING_LOGS+=("$pattern")
    fi
done

if [ ${#CONFLICTING_LOGS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ No known problematic log groups found${NC}"
else
    echo -e "${YELLOW}⚠️  Found ${#CONFLICTING_LOGS[@]} potentially problematic log groups${NC}"
    RECOMMENDATIONS+=("Run log group cleanup: ./scripts/cleanup-log-groups.sh ${ENVIRONMENT}")
fi

# Count total log groups
if [ -n "$LOG_GROUPS" ]; then
    LOG_GROUP_COUNT=$(echo "$LOG_GROUPS" | wc -w | tr -d ' ')
    echo -e "  Total RTM log groups: ${LOG_GROUP_COUNT}"
else
    echo -e "  Total RTM log groups: 0"
fi

echo ""

# Overall health assessment
echo -e "${BLUE}📋 Health Assessment:${NC}"
echo -e "  Healthy stacks: ${GREEN}${HEALTHY_COUNT}/4${NC}"
echo -e "  Issues found: ${RED}${ISSUES_COUNT}${NC}"
echo -e "  Conflicting log groups: ${RED}${#CONFLICTING_LOGS[@]}${NC}"

if [ $ISSUES_COUNT -eq 0 ] && [ ${#CONFLICTING_LOGS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ Environment is healthy for deployment${NC}"
    HEALTH_STATUS="HEALTHY"
elif [ $ISSUES_COUNT -gt 0 ] || [ ${#CONFLICTING_LOGS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Environment has issues that may affect deployment${NC}"
    HEALTH_STATUS="ISSUES"
else
    echo -e "${RED}❌ Environment has critical issues${NC}"
    HEALTH_STATUS="CRITICAL"
fi

# Recommendations
if [ ${#RECOMMENDATIONS[@]} -gt 0 ]; then
    echo ""
    echo -e "${BLUE}💡 Recommendations:${NC}"
    for i in "${!RECOMMENDATIONS[@]}"; do
        echo -e "  $((i + 1)). ${RECOMMENDATIONS[$i]}"
    done
fi

# Environment-specific checks
echo ""
echo -e "${BLUE}🔧 Environment-specific checks:${NC}"

# Check if this is production and warn about destructive operations
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}⚠️  Production environment detected${NC}"
    echo -e "  - Extra caution required for any destructive operations"
    echo -e "  - Consider backing up important resources before cleanup"
fi

# Check for incomplete destroys (stacks in DELETE_FAILED state)
DELETE_FAILED_STACKS=()
for stack_type in "Infrastructure" "Lambda" "API Gateway" "Web"; do
    status="${STACK_STATUSES[$stack_type]}"
    if [ "$status" = "DELETE_FAILED" ]; then
        DELETE_FAILED_STACKS+=("rtm-${ENVIRONMENT}-$(echo "$stack_type" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')")
    fi
done

if [ ${#DELETE_FAILED_STACKS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Found stacks in DELETE_FAILED state:${NC}"
    for stack in "${DELETE_FAILED_STACKS[@]}"; do
        echo -e "  - $stack"
    done
    echo -e "${YELLOW}💡 These may need manual cleanup in AWS Console${NC}"
fi

# Exit with appropriate code
case "$HEALTH_STATUS" in
    "HEALTHY")
        exit 0
        ;;
    "ISSUES")
        exit 1
        ;;
    "CRITICAL")
        exit 2
        ;;
esac