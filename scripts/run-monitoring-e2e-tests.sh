#!/bin/bash

# Monitoring E2E Test Runner
# Comprehensive test runner for monitoring endpoint E2E tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_ENV="development"
BACKEND_URL="http://localhost:5001"
FRONTEND_URL="http://localhost:3000"
MAX_RETRIES=3
RETRY_DELAY=5

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if services are running
check_services() {
    print_status "Checking if required services are running..."
    
    # Check backend
    if ! curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
        print_error "Backend service not accessible at $BACKEND_URL"
        print_status "Make sure to run: npm run dev or docker-compose --profile dev up -d"
        exit 1
    else
        print_success "Backend service is running"
    fi
    
    # Check frontend
    if ! curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
        print_warning "Frontend service not accessible at $FRONTEND_URL"
        print_status "Some tests may fail. Consider running: npm run dev:frontend"
    else
        print_success "Frontend service is running"
    fi
    
    # Check database connectivity via health endpoint
    local health_response=$(curl -s "$BACKEND_URL/api/health" | jq -r '.components.database.status' 2>/dev/null || echo "unknown")
    if [ "$health_response" = "healthy" ]; then
        print_success "Database is healthy"
    elif [ "$health_response" = "degraded" ]; then
        print_warning "Database is degraded but accessible"
    else
        print_error "Database is not healthy: $health_response"
        print_status "Check database connection and restart if needed"
    fi
}

# Function to wait for services
wait_for_services() {
    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
            print_success "Services are ready"
            return 0
        fi
        
        retries=$((retries + 1))
        print_status "Waiting for services... (attempt $retries/$MAX_RETRIES)"
        sleep $RETRY_DELAY
    done
    
    print_error "Services failed to start after $MAX_RETRIES attempts"
    return 1
}

# Function to run specific test suites
run_test_suite() {
    local test_file="$1"
    local test_name="$2"
    
    print_status "Running $test_name tests..."
    
    if npx playwright test "$test_file" --reporter=html,line; then
        print_success "$test_name tests passed"
        return 0
    else
        print_error "$test_name tests failed"
        return 1
    fi
}

# Function to run all monitoring tests
run_all_monitoring_tests() {
    local failed_tests=()
    
    print_status "Starting comprehensive monitoring E2E test suite..."
    
    # Test 1: Core monitoring endpoints
    if ! run_test_suite "e2e/monitoring/monitoring-endpoints.spec.ts" "Monitoring Endpoints"; then
        failed_tests+=("Monitoring Endpoints")
    fi
    
    # Test 2: Performance monitoring
    if ! run_test_suite "e2e/monitoring/performance-monitoring.spec.ts" "Performance Monitoring"; then
        failed_tests+=("Performance Monitoring")
    fi
    
    # Test 3: Accessibility testing
    if ! run_test_suite "e2e/monitoring/monitoring-accessibility.spec.ts" "Accessibility"; then
        failed_tests+=("Accessibility")
    fi
    
    # Report results
    if [ ${#failed_tests[@]} -eq 0 ]; then
        print_success "All monitoring tests passed! ✅"
        return 0
    else
        print_error "Some test suites failed:"
        for test in "${failed_tests[@]}"; do
            echo "  - $test"
        done
        return 1
    fi
}

# Function to run performance benchmarks
run_performance_benchmarks() {
    print_status "Running performance benchmarks..."
    
    local temp_results="/tmp/monitoring_performance_$(date +%s).json"
    
    # Run only performance tests with JSON reporter
    if npx playwright test e2e/monitoring/performance-monitoring.spec.ts --reporter=json:"$temp_results"; then
        print_success "Performance benchmarks completed"
        
        # Extract and display key metrics if jq is available
        if command -v jq >/dev/null 2>&1 && [ -f "$temp_results" ]; then
            print_status "Performance Summary:"
            echo "  Detailed results saved to: $temp_results"
            
            # Count passed/failed tests
            local passed=$(jq '[.suites[].specs[] | select(.ok == true)] | length' "$temp_results" 2>/dev/null || echo "0")
            local failed=$(jq '[.suites[].specs[] | select(.ok == false)] | length' "$temp_results" 2>/dev/null || echo "0")
            
            echo "  Tests passed: $passed"
            echo "  Tests failed: $failed"
        fi
        
        return 0
    else
        print_error "Performance benchmarks failed"
        return 1
    fi
}

# Function to check test environment
check_test_environment() {
    print_status "Checking test environment..."
    
    # Check Node.js version
    local node_version=$(node --version)
    print_status "Node.js version: $node_version"
    
    # Check if test user exists
    local test_user_check=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"testuser@test.com","password":"testuser123"}' | \
        jq -r '.token // "null"' 2>/dev/null || echo "null")
    
    if [ "$test_user_check" = "null" ]; then
        print_warning "Test user not found or invalid credentials"
        print_status "Creating test user..."
        if ! npm run db:create-test-user; then
            print_error "Failed to create test user"
            exit 1
        fi
    else
        print_success "Test user authentication working"
    fi
    
    # Check Playwright installation
    if ! npx playwright --version > /dev/null 2>&1; then
        print_error "Playwright not installed"
        print_status "Installing Playwright..."
        npm run playwright:install
    else
        print_success "Playwright is installed"
    fi
}

# Function to generate test report
generate_test_report() {
    print_status "Generating comprehensive test report..."
    
    local report_dir="test-results/monitoring-e2e-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$report_dir"
    
    # Run tests with multiple reporters
    npx playwright test e2e/monitoring/ \
        --reporter=html:"$report_dir/html",json:"$report_dir/results.json",line \
        || true
    
    print_status "Test reports generated in: $report_dir"
    
    # Generate summary if jq is available
    if command -v jq >/dev/null 2>&1 && [ -f "$report_dir/results.json" ]; then
        local summary_file="$report_dir/summary.txt"
        {
            echo "Monitoring E2E Test Summary"
            echo "Generated: $(date)"
            echo "Environment: $TEST_ENV"
            echo "Backend URL: $BACKEND_URL"
            echo "Frontend URL: $FRONTEND_URL"
            echo ""
            
            local total_specs=$(jq '[.suites[].specs[]] | length' "$report_dir/results.json")
            local passed_specs=$(jq '[.suites[].specs[] | select(.ok == true)] | length' "$report_dir/results.json")
            local failed_specs=$(jq '[.suites[].specs[] | select(.ok == false)] | length' "$report_dir/results.json")
            
            echo "Total test specs: $total_specs"
            echo "Passed: $passed_specs"
            echo "Failed: $failed_specs"
            echo "Success rate: $(echo "scale=1; $passed_specs * 100 / $total_specs" | bc -l 2>/dev/null || echo "N/A")%"
            
        } > "$summary_file"
        
        print_success "Test summary saved to: $summary_file"
        cat "$summary_file"
    fi
}

# Main execution
main() {
    echo "=================================================="
    echo "  Monitoring E2E Test Runner"
    echo "  SpherosegV4 - Comprehensive Test Suite"
    echo "=================================================="
    echo ""
    
    # Parse command line arguments
    local run_mode="all"
    local generate_report=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --endpoints)
                run_mode="endpoints"
                shift
                ;;
            --performance)
                run_mode="performance"
                shift
                ;;
            --accessibility)
                run_mode="accessibility"
                shift
                ;;
            --benchmarks)
                run_mode="benchmarks"
                shift
                ;;
            --report)
                generate_report=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --endpoints     Run only endpoint tests"
                echo "  --performance   Run only performance tests"
                echo "  --accessibility Run only accessibility tests"
                echo "  --benchmarks    Run performance benchmarks"
                echo "  --report        Generate comprehensive test report"
                echo "  --help, -h      Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check environment and dependencies
    check_test_environment
    
    # Wait for services to be ready
    wait_for_services
    
    # Check service health
    check_services
    
    # Execute tests based on run mode
    case $run_mode in
        "endpoints")
            run_test_suite "e2e/monitoring/monitoring-endpoints.spec.ts" "Monitoring Endpoints"
            ;;
        "performance")
            run_test_suite "e2e/monitoring/performance-monitoring.spec.ts" "Performance Monitoring"
            ;;
        "accessibility")
            run_test_suite "e2e/monitoring/monitoring-accessibility.spec.ts" "Accessibility"
            ;;
        "benchmarks")
            run_performance_benchmarks
            ;;
        "all")
            if $generate_report; then
                generate_test_report
            else
                run_all_monitoring_tests
            fi
            ;;
        *)
            print_error "Invalid run mode: $run_mode"
            exit 1
            ;;
    esac
    
    local exit_code=$?
    
    echo ""
    echo "=================================================="
    if [ $exit_code -eq 0 ]; then
        print_success "Monitoring E2E tests completed successfully! 🎉"
        echo "  View detailed results: npx playwright show-report"
    else
        print_error "Some monitoring E2E tests failed. 😞"
        echo "  View detailed results: npx playwright show-report"
        echo "  Check logs above for specific failures"
    fi
    echo "=================================================="
    
    exit $exit_code
}

# Run main function with all arguments
main "$@"