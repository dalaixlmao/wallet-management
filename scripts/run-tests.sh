#!/bin/bash

# Test Suite Runner with Optimizations
# 
# This script runs the test suite with performance optimizations:
# - Configures Jest for optimal parallel execution
# - Sets up proper test environment
# - Runs tests in the most efficient order
# - Provides detailed reporting

set -e

# Start timer
START_TIME=$(date +%s)

# Get directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_WORKERS=4
CACHE_DIR="$PROJECT_ROOT/.test-cache"
REPORT_DIR="$PROJECT_ROOT/test-reports"

# Create directories
mkdir -p "$CACHE_DIR"
mkdir -p "$REPORT_DIR"

# Print header
echo -e "\n${BLUE}==============================================${NC}"
echo -e "${BLUE}🚀 Advanced Test Suite Runner${NC}"
echo -e "${BLUE}==============================================${NC}\n"

# Validate environment
echo -e "${BLUE}Validating environment...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install it first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Node.js modules are installed
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${YELLOW}Node modules not found. Installing dependencies...${NC}"
    cd "$PROJECT_ROOT" && npm install --legacy-peer-deps
fi

# Setup test environment
echo -e "\n${BLUE}Setting up test environment...${NC}"
node "$SCRIPT_DIR/setup-test-environment.js"

# Run linting first (but don't fail the build if it fails)
echo -e "\n${BLUE}Running linting...${NC}"
cd "$PROJECT_ROOT" && npm run lint || echo -e "${YELLOW}Linting had errors, but continuing with tests${NC}"

# Run tests with Jest in optimal order
echo -e "\n${BLUE}Running tests in optimized order...${NC}"

# Define test categories and their priorities
declare -A TEST_CATEGORIES
TEST_CATEGORIES["unit"]=1
TEST_CATEGORIES["integration"]=2
TEST_CATEGORIES["e2e"]=3
TEST_CATEGORIES["performance"]=4

# Sort test categories by priority
SORTED_CATEGORIES=($(for cat in "${!TEST_CATEGORIES[@]}"; do
    echo "${TEST_CATEGORIES[$cat]}:$cat"
done | sort -n | cut -d: -f2))

# Execute tests in order
EXIT_CODE=0
TEST_RESULTS=()

for category in "${SORTED_CATEGORIES[@]}"; do
    if [ -d "$PROJECT_ROOT/__tests__/$category" ]; then
        echo -e "\n${BLUE}Running $category tests...${NC}"
        
        # Determine optimal jest args based on test type
        JEST_ARGS=""
        case $category in
            unit)
                JEST_ARGS="--maxWorkers=$MAX_WORKERS"
                ;;
            integration)
                JEST_ARGS="--maxWorkers=2"
                ;;
            e2e|performance)
                JEST_ARGS="--runInBand"
                ;;
        esac
        
        # Add common args
        JEST_ARGS="$JEST_ARGS --testMatch=\"**/__tests__/$category/**/*\" --colors"
        
        # Run tests
        CATEGORY_START_TIME=$(date +%s)
        if cd "$PROJECT_ROOT" && npx jest $JEST_ARGS; then
            CATEGORY_END_TIME=$(date +%s)
            CATEGORY_DURATION=$((CATEGORY_END_TIME - CATEGORY_START_TIME))
            echo -e "${GREEN}✓ $category tests passed in $CATEGORY_DURATION seconds${NC}"
            TEST_RESULTS+=("$category:pass:$CATEGORY_DURATION")
        else
            CATEGORY_END_TIME=$(date +%s)
            CATEGORY_DURATION=$((CATEGORY_END_TIME - CATEGORY_START_TIME))
            echo -e "${RED}✗ $category tests failed in $CATEGORY_DURATION seconds${NC}"
            TEST_RESULTS+=("$category:fail:$CATEGORY_DURATION")
            EXIT_CODE=1
        fi
    else
        echo -e "${YELLOW}Skipping $category tests - directory not found${NC}"
        TEST_RESULTS+=("$category:skip:0")
    fi
done

# End timer and calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Print summary
echo -e "\n${BLUE}==============================================${NC}"
echo -e "${BLUE}📊 Test Execution Summary${NC}"
echo -e "${BLUE}==============================================${NC}"
echo -e "Total Duration: ${DURATION} seconds\n"

for result in "${TEST_RESULTS[@]}"; do
    IFS=':' read -r category status duration <<< "$result"
    case $status in
        pass)
            echo -e "${GREEN}✓ $category: Passed ($duration seconds)${NC}"
            ;;
        fail)
            echo -e "${RED}✗ $category: Failed ($duration seconds)${NC}"
            ;;
        skip)
            echo -e "${YELLOW}⏭ $category: Skipped${NC}"
            ;;
    esac
done

echo -e "\n${BLUE}Final Result: ${EXIT_CODE == 0 ? "${GREEN}✅ All tests passed" : "${RED}❌ Some tests failed"}${NC}"

# Generate report file
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
REPORT_FILE="$REPORT_DIR/test-report-$TIMESTAMP.txt"

{
    echo "Test Execution Report"
    echo "====================="
    echo "Date: $(date)"
    echo "Duration: $DURATION seconds"
    echo ""
    echo "Results:"
    for result in "${TEST_RESULTS[@]}"; do
        IFS=':' read -r category status duration <<< "$result"
        echo "- $category: $status ($duration seconds)"
    done
    echo ""
    echo "Final Status: ${EXIT_CODE == 0 ? "PASSED" : "FAILED"}"
} > "$REPORT_FILE"

echo -e "\nReport saved to: $REPORT_FILE"

exit $EXIT_CODE