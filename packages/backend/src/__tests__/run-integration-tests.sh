#!/bin/bash

# Run Integration Tests for Performance Improvements
# This script runs the new integration tests created for PR #8

echo "🧪 Running Integration Tests for Performance Improvements..."
echo "================================================"

# Set test environment
export NODE_ENV=test
export ENABLE_READ_REPLICAS=true
export DATABASE_WRITE_URL=postgresql://postgres:pass@localhost:5432/test
export DATABASE_READ_URL=postgresql://postgres:pass@localhost:5432/test

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run a test suite
run_test() {
  local test_name=$1
  local test_file=$2
  
  echo -e "\n${YELLOW}Running: ${test_name}${NC}"
  echo "----------------------------------------"
  
  if npm test -- "${test_file}" --verbose; then
    echo -e "${GREEN}✅ ${test_name} passed${NC}"
    return 0
  else
    echo -e "${RED}❌ ${test_name} failed${NC}"
    return 1
  fi
}

# Track failures
failed_tests=()
passed_tests=()

# Run each integration test
tests=(
  "ML Service Scaling|__tests__/integration/ml-scaling.test.ts"
  "Read Replica Failover|__tests__/integration/read-replica-failover.test.ts"
  "GraphQL Rate Limiting|__tests__/integration/graphql-rate-limiting.test.ts"
  "Circuit Breaker Pattern|__tests__/integration/circuit-breaker.test.ts"
  "WebSocket Batching|__tests__/integration/websocket-batching.test.ts"
)

for test in "${tests[@]}"; do
  IFS='|' read -r name file <<< "$test"
  if run_test "$name" "$file"; then
    passed_tests+=("$name")
  else
    failed_tests+=("$name")
  fi
done

# Summary
echo -e "\n\n================================================"
echo -e "📊 ${YELLOW}Test Summary${NC}"
echo "================================================"

echo -e "\n${GREEN}Passed Tests (${#passed_tests[@]}):${NC}"
for test in "${passed_tests[@]}"; do
  echo -e "  ✅ $test"
done

if [ ${#failed_tests[@]} -gt 0 ]; then
  echo -e "\n${RED}Failed Tests (${#failed_tests[@]}):${NC}"
  for test in "${failed_tests[@]}"; do
    echo -e "  ❌ $test"
  done
fi

# Coverage report
echo -e "\n${YELLOW}Generating coverage report...${NC}"
npm test -- --coverage --coverageDirectory=coverage/integration \
  __tests__/integration/ml-scaling.test.ts \
  __tests__/integration/read-replica-failover.test.ts \
  __tests__/integration/graphql-rate-limiting.test.ts \
  __tests__/integration/circuit-breaker.test.ts \
  __tests__/integration/websocket-batching.test.ts

# Exit with appropriate code
if [ ${#failed_tests[@]} -gt 0 ]; then
  echo -e "\n${RED}Some tests failed. Please fix the issues before merging.${NC}"
  exit 1
else
  echo -e "\n${GREEN}All tests passed! 🎉${NC}"
  exit 0
fi