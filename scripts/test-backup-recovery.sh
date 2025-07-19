#!/bin/bash

# Automated Backup Recovery Testing Script
# 
# Comprehensive testing suite for backup and restore procedures
# including data integrity validation, performance testing, and rollback verification.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_DB_NAME="spheroseg_backup_test"
ORIGINAL_DB_NAME="spheroseg"
BACKUP_TEST_DIR="/tmp/backup_recovery_tests_$(date +%s)"
LOG_FILE="$BACKUP_TEST_DIR/backup_recovery_test.log"

# Test configuration
RUN_PERFORMANCE_TESTS=true
RUN_INTEGRITY_TESTS=true
RUN_ROLLBACK_TESTS=true
CLEANUP_AFTER_TESTS=true
TEST_DATA_SCALE="small" # small, medium, large

# Parse command line arguments
TEST_FILTER=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --test)
      TEST_FILTER="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--test TEST_NAME] [--help]"
      echo ""
      echo "Options:"
      echo "  --test TEST_NAME  Run specific test only"
      echo "  --help, -h        Show this help message"
      echo ""
      echo "Available tests:"
      echo "  basic_backup      Test basic backup functionality"
      echo "  restoration       Test backup restoration"
      echo "  data_integrity    Test data integrity validation"
      echo "  performance       Test backup/restore performance"
      echo "  format_testing    Test different backup formats"
      echo "  retention_policy  Test backup retention and cleanup"
      echo "  rollback_scenarios Test recovery from failed operations"
      echo "  disaster_recovery Test major failure scenarios"
      echo "  point_in_time     Test point-in-time recovery"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Test results tracking
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Function to record test result
record_test_result() {
    local test_name="$1"
    local result="$2" # "PASS" or "FAIL"
    local details="${3:-}"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    if [ "$result" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        print_success "TEST PASSED: $test_name"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        print_error "TEST FAILED: $test_name${details:+ - $details}"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running or not accessible"
        exit 1
    fi
    
    # Check if database container is running
    if ! docker-compose ps db | grep -q "Up"; then
        print_error "Database container is not running"
        exit 1
    fi
    
    # Check if backup scripts exist
    if [ ! -f "$SCRIPT_DIR/backup/backup-database.sh" ]; then
        print_error "Backup script not found: $SCRIPT_DIR/backup/backup-database.sh"
        exit 1
    fi
    
    if [ ! -f "$SCRIPT_DIR/rollback/restore-database.sh" ]; then
        print_error "Restore script not found: $SCRIPT_DIR/rollback/restore-database.sh"
        exit 1
    fi
    
    # Create test directories
    mkdir -p "$BACKUP_TEST_DIR"/{backups,logs,data}
    
    # Check available disk space (need at least 1GB)
    local available_space=$(df "$BACKUP_TEST_DIR" | tail -1 | awk '{print $4}')
    if [ "$available_space" -lt 1048576 ]; then # 1GB in KB
        print_warning "Low disk space available for tests ($(($available_space / 1024))MB). Consider cleaning up or using --cleanup flag."
    fi
    
    print_success "Prerequisites check passed"
}

# Function to setup test environment
setup_test_environment() {
    print_status "Setting up test environment..."
    
    # Create test database
    docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;"
    docker-compose exec -T db psql -U postgres -c "CREATE DATABASE $TEST_DB_NAME OWNER postgres;"
    
    # Copy schema from main database
    copy_database_schema
    
    # Generate test data based on scale
    generate_test_data
    
    print_success "Test environment setup completed"
}

# Function to copy database schema from main database
copy_database_schema() {
    print_status "Copying database schema from $ORIGINAL_DB_NAME to $TEST_DB_NAME..."
    
    # Export schema only (no data) from main database
    local schema_file="$BACKUP_TEST_DIR/schema.sql"
    
    # Create schema dump
    if docker-compose exec -T db pg_dump -U postgres -s "$ORIGINAL_DB_NAME" > "$schema_file" 2>/dev/null; then
        # Import schema to test database
        if docker-compose exec -T db psql -U postgres -d "$TEST_DB_NAME" < "$schema_file" >/dev/null 2>&1; then
            print_success "Database schema copied successfully"
        else
            print_error "Failed to import schema to test database"
            return 1
        fi
    else
        print_error "Failed to export schema from main database"
        return 1
    fi
    
    # Clean up schema file
    rm -f "$schema_file"
}

# Function to generate test data
generate_test_data() {
    print_status "Generating test data (scale: $TEST_DATA_SCALE)..."
    
    # Determine data scale
    local user_count=10
    local project_count=5
    local image_count=20
    local cell_count=100
    
    case "$TEST_DATA_SCALE" in
        "medium")
            user_count=100
            project_count=20
            image_count=200
            cell_count=1000
            ;;
        "large")
            user_count=1000
            project_count=100
            image_count=2000
            cell_count=10000
            ;;
    esac
    
    print_status "Creating $user_count users, $project_count projects, $image_count images with segmentation data..."
    
    # Create test data generation SQL
    cat > "$BACKUP_TEST_DIR/generate_test_data.sql" << EOF
-- Clear existing data (in proper order for foreign keys)
TRUNCATE TABLE segmentation_results, segmentation_queue, segmentation_tasks, segmentations, images, projects, users RESTART IDENTITY CASCADE;

-- Generate users (using actual schema)
INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at, is_approved, storage_used_bytes, storage_limit_bytes, email_verified)
SELECT 
    gen_random_uuid(),
    'test_user_' || i || '@backup-test.com',
    'Test User ' || i,
    '\$2b\$10\$dummy.hash.for.testing.purposes.only',
    CASE WHEN i % 10 = 0 THEN 'admin' ELSE 'user' END,
    NOW() - (random() * interval '30 days'),
    NOW() - (random() * interval '29 days'),
    true,
    0,
    10737418240,
    false
FROM generate_series(1, $user_count) i;

-- Generate projects (using actual schema)
INSERT INTO projects (id, title, description, user_id, created_at, updated_at, tags, public)
SELECT 
    gen_random_uuid(),
    'Test Project ' || i,
    'Generated test project for backup testing - ' || i,
    (SELECT id FROM users ORDER BY RANDOM() LIMIT 1),
    NOW() - (random() * interval '20 days'),
    NOW() - (random() * interval '19 days'),
    ARRAY['test', 'backup'],
    CASE WHEN i % 3 = 0 THEN true ELSE false END
FROM generate_series(1, $project_count) i;

-- Generate images (using actual schema)
INSERT INTO images (id, project_id, user_id, name, storage_filename, original_filename, storage_path, file_size, width, height, format, segmentation_status, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    (SELECT id FROM projects ORDER BY RANDOM() LIMIT 1),
    (SELECT id FROM users ORDER BY RANDOM() LIMIT 1),
    'test_image_' || i || '.tiff',
    'storage_' || i || '_' || extract(epoch from now())::bigint || '.tiff',
    'original_image_' || i || '.tiff',
    '/uploads/images/',
    1000000 + (random() * 5000000)::bigint,
    800 + (random() * 400)::int,
    600 + (random() * 300)::int,
    'TIFF',
    CASE 
        WHEN i % 4 = 0 THEN 'completed'
        WHEN i % 4 = 1 THEN 'processing'
        WHEN i % 4 = 2 THEN 'queued'
        ELSE 'without_segmentation'
    END,
    NOW() - (random() * interval '15 days'),
    NOW() - (random() * interval '14 days')
FROM generate_series(1, $image_count) i;

-- Generate segmentation results for completed images (using actual schema)
INSERT INTO segmentation_results (id, image_id, status, result_data, parameters, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    i.id,
    'completed',
    ('{"algorithm": "ResUNet", "confidence": ' || (0.8 + random() * 0.2)::numeric(3,2) || ', "cell_count": ' || (10 + random() * 90)::int || '}')::jsonb,
    '{"threshold": 0.5, "min_area": 100}'::jsonb,
    i.created_at + interval '1 hour',
    i.created_at + interval '1 hour 30 minutes'
FROM images i 
WHERE i.segmentation_status = 'completed';

-- Generate some segmentation queue entries
INSERT INTO segmentation_queue (id, image_id, user_id, project_id, status, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    i.id,
    i.user_id,
    i.project_id,
    CASE 
        WHEN i.segmentation_status = 'processing' THEN 'processing'
        WHEN i.segmentation_status = 'queued' THEN 'queued'
        ELSE 'completed'
    END,
    i.created_at + interval '30 minutes',
    i.created_at + interval '45 minutes'
FROM images i 
WHERE i.segmentation_status IN ('processing', 'queued', 'completed');

-- Create indexes for better performance during testing
CREATE INDEX IF NOT EXISTS idx_test_images_project ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_test_segmentations_image ON segmentations(image_id);
CREATE INDEX IF NOT EXISTS idx_test_results_image ON segmentation_results(image_id);

-- Generate some test statistics
SELECT 
    'Test data generated:' as info,
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM projects) as projects,
    (SELECT COUNT(*) FROM images) as images,
    (SELECT COUNT(*) FROM segmentation_results) as results,
    (SELECT COUNT(*) FROM segmentation_queue) as queue_items;
EOF

    # Execute test data generation
    if docker-compose exec -T db psql -U postgres -d "$TEST_DB_NAME" -f - < "$BACKUP_TEST_DIR/generate_test_data.sql"; then
        print_success "Test data generated successfully"
    else
        print_error "Failed to generate test data"
        return 1
    fi
}

# Function to get database checksum for integrity verification
get_database_checksum() {
    local db_name="$1"
    
    # Create a comprehensive checksum of the database
    docker-compose exec -T db psql -U postgres -d "$db_name" -t -c "
        SELECT md5(string_agg(md5_row, '')) 
        FROM (
            SELECT md5(row(u.*)::text) as md5_row FROM users u ORDER BY id
            UNION ALL
            SELECT md5(row(p.*)::text) FROM projects p ORDER BY id
            UNION ALL
            SELECT md5(row(i.*)::text) FROM images i ORDER BY id
            UNION ALL
            SELECT md5(row(sr.*)::text) FROM segmentation_results sr ORDER BY id
            UNION ALL
            SELECT md5(row(c.*)::text) FROM cells c ORDER BY id
        ) checksums;
    " | tr -d ' \n'
}

# Function to test basic backup functionality
test_basic_backup() {
    print_status "Testing basic backup functionality..."
    
    local backup_file="$BACKUP_TEST_DIR/backups/test_backup_$(date +%s).sql"
    
    # Set environment variables for backup script
    export BACKUP_DIR="$BACKUP_TEST_DIR/backups"
    export DB_NAME="$TEST_DB_NAME"
    export CONTAINER_NAME="spheroseg-db"
    export USE_DOCKER="true"
    export BACKUP_FORMAT="plain"
    export RETENTION_DAILY="3"
    
    # Run backup script
    if "$SCRIPT_DIR/backup/backup-database.sh" 2>&1 | tee -a "$LOG_FILE"; then
        # Check if backup file was created
        local backup_files=($(find "$BACKUP_TEST_DIR/backups/daily" -name "*$TEST_DB_NAME*" -type f))
        
        if [ ${#backup_files[@]} -gt 0 ]; then
            local latest_backup="${backup_files[-1]}"
            
            # Verify backup file is not empty
            if [ -s "$latest_backup" ]; then
                # Test backup integrity
                if gzip -t "$latest_backup" 2>/dev/null; then
                    record_test_result "Basic Backup Creation" "PASS" "Backup file: $(basename "$latest_backup")"
                    echo "$latest_backup" > "$BACKUP_TEST_DIR/latest_backup.txt"
                else
                    record_test_result "Basic Backup Creation" "FAIL" "Backup file corrupted"
                fi
            else
                record_test_result "Basic Backup Creation" "FAIL" "Backup file is empty"
            fi
        else
            record_test_result "Basic Backup Creation" "FAIL" "No backup file created"
        fi
    else
        record_test_result "Basic Backup Creation" "FAIL" "Backup script failed"
    fi
}

# Function to test backup restoration
test_backup_restoration() {
    print_status "Testing backup restoration..."
    
    if [ ! -f "$BACKUP_TEST_DIR/latest_backup.txt" ]; then
        record_test_result "Backup Restoration" "FAIL" "No backup file available for restoration"
        return 1
    fi
    
    local backup_file=$(cat "$BACKUP_TEST_DIR/latest_backup.txt")
    if [ ! -f "$backup_file" ]; then
        record_test_result "Backup Restoration" "FAIL" "Backup file not found: $backup_file"
        return 1
    fi
    
    # Get original database checksum
    local original_checksum=$(get_database_checksum "$TEST_DB_NAME")
    
    # Create a temporary database for restoration testing
    local restore_db_name="spheroseg_restore_test"
    docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS $restore_db_name;"
    docker-compose exec -T db psql -U postgres -c "CREATE DATABASE $restore_db_name OWNER postgres;"
    
    # Restore backup to temporary database
    if zcat "$backup_file" | docker-compose exec -T db psql -U postgres -d "$restore_db_name" 2>&1 | tee -a "$LOG_FILE"; then
        # Get restored database checksum
        local restored_checksum=$(get_database_checksum "$restore_db_name")
        
        # Compare checksums
        if [ "$original_checksum" = "$restored_checksum" ]; then
            record_test_result "Backup Restoration" "PASS" "Data integrity verified"
        else
            record_test_result "Backup Restoration" "FAIL" "Data integrity check failed"
        fi
        
        # Cleanup temporary database
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE $restore_db_name;"
    else
        record_test_result "Backup Restoration" "FAIL" "Restoration process failed"
    fi
}

# Function to test backup performance
test_backup_performance() {
    if [ "$RUN_PERFORMANCE_TESTS" != "true" ]; then
        return 0
    fi
    
    print_status "Testing backup performance..."
    
    # Get database size
    local db_size=$(docker-compose exec -T db psql -U postgres -d "$TEST_DB_NAME" -t -c "SELECT pg_database_size('$TEST_DB_NAME');" | tr -d ' ')
    local db_size_mb=$((db_size / 1024 / 1024))
    
    print_status "Database size: ${db_size_mb}MB"
    
    # Measure backup time
    local start_time=$(date +%s)
    
    export BACKUP_DIR="$BACKUP_TEST_DIR/backups/performance"
    export DB_NAME="$TEST_DB_NAME"
    export BACKUP_FORMAT="custom"
    mkdir -p "$BACKUP_TEST_DIR/backups/performance/daily"
    
    if timeout 300 "$SCRIPT_DIR/backup/backup-database.sh" >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local backup_duration=$((end_time - start_time))
        local backup_rate=$((db_size_mb / backup_duration))
        
        print_status "Backup completed in ${backup_duration}s (${backup_rate}MB/s)"
        
        # Performance thresholds (adjust based on your requirements)
        if [ "$backup_duration" -lt 60 ] && [ "$backup_rate" -gt 5 ]; then
            record_test_result "Backup Performance" "PASS" "${backup_duration}s, ${backup_rate}MB/s"
        elif [ "$backup_duration" -lt 120 ]; then
            record_test_result "Backup Performance" "PASS" "${backup_duration}s (acceptable), ${backup_rate}MB/s"
        else
            record_test_result "Backup Performance" "FAIL" "${backup_duration}s (too slow), ${backup_rate}MB/s"
        fi
    else
        record_test_result "Backup Performance" "FAIL" "Backup timed out after 300s"
    fi
}

# Function to test data integrity across backup/restore cycle
test_data_integrity() {
    if [ "$RUN_INTEGRITY_TESTS" != "true" ]; then
        return 0
    fi
    
    print_status "Testing data integrity across backup/restore cycle..."
    
    # Create specific test data for integrity checking
    local integrity_test_id=$(date +%s)
    
    docker-compose exec -T db psql -U postgres -d "$TEST_DB_NAME" << EOF
-- Insert specific test record
INSERT INTO users (email, name, password_hash, role, created_at)
VALUES ('integrity_test_$integrity_test_id@test.com', 'Integrity Test User', 'test_hash', 'user', NOW());

-- Get the ID of the inserted user
SELECT id FROM users WHERE email = 'integrity_test_$integrity_test_id@test.com';
EOF

    # Create backup with new data
    export BACKUP_DIR="$BACKUP_TEST_DIR/backups/integrity"
    export DB_NAME="$TEST_DB_NAME"
    export BACKUP_FORMAT="plain"
    mkdir -p "$BACKUP_TEST_DIR/backups/integrity/daily"
    
    if "$SCRIPT_DIR/backup/backup-database.sh" >/dev/null 2>&1; then
        local backup_file=($(find "$BACKUP_TEST_DIR/backups/integrity/daily" -name "*$TEST_DB_NAME*" -type f))
        local latest_backup="${backup_file[-1]}"
        
        # Create new database and restore
        local integrity_db="spheroseg_integrity_test"
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS $integrity_db;"
        docker-compose exec -T db psql -U postgres -c "CREATE DATABASE $integrity_db OWNER postgres;"
        
        if zcat "$latest_backup" | docker-compose exec -T db psql -U postgres -d "$integrity_db" >/dev/null 2>&1; then
            # Check if test record exists in restored database
            local record_exists=$(docker-compose exec -T db psql -U postgres -d "$integrity_db" -t -c "SELECT COUNT(*) FROM users WHERE email = 'integrity_test_$integrity_test_id@test.com';" | tr -d ' ')
            
            if [ "$record_exists" = "1" ]; then
                record_test_result "Data Integrity" "PASS" "Test record preserved through backup/restore"
            else
                record_test_result "Data Integrity" "FAIL" "Test record not found in restored database"
            fi
            
            # Cleanup
            docker-compose exec -T db psql -U postgres -c "DROP DATABASE $integrity_db;"
        else
            record_test_result "Data Integrity" "FAIL" "Failed to restore backup for integrity test"
        fi
    else
        record_test_result "Data Integrity" "FAIL" "Failed to create backup for integrity test"
    fi
}

# Function to test backup compression and file formats
test_backup_formats() {
    print_status "Testing different backup formats..."
    
    local formats=("plain" "custom")
    
    for format in "${formats[@]}"; do
        print_status "Testing $format format..."
        
        export BACKUP_DIR="$BACKUP_TEST_DIR/backups/format_$format"
        export DB_NAME="$TEST_DB_NAME"
        export BACKUP_FORMAT="$format"
        mkdir -p "$BACKUP_TEST_DIR/backups/format_$format/daily"
        
        if "$SCRIPT_DIR/backup/backup-database.sh" >/dev/null 2>&1; then
            local backup_files=($(find "$BACKUP_TEST_DIR/backups/format_$format/daily" -name "*$TEST_DB_NAME*" -type f))
            
            if [ ${#backup_files[@]} -gt 0 ]; then
                local backup_file="${backup_files[-1]}"
                local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
                local size_mb=$((file_size / 1024 / 1024))
                
                # Test file integrity based on format
                local integrity_ok=false
                if [ "$format" = "plain" ]; then
                    if gzip -t "$backup_file" 2>/dev/null; then
                        integrity_ok=true
                    fi
                elif [ "$format" = "custom" ]; then
                    if docker-compose exec -T db pg_restore --list "$backup_file" >/dev/null 2>&1; then
                        integrity_ok=true
                    fi
                fi
                
                if [ "$integrity_ok" = true ]; then
                    record_test_result "Backup Format ($format)" "PASS" "Size: ${size_mb}MB"
                else
                    record_test_result "Backup Format ($format)" "FAIL" "File integrity check failed"
                fi
            else
                record_test_result "Backup Format ($format)" "FAIL" "No backup file created"
            fi
        else
            record_test_result "Backup Format ($format)" "FAIL" "Backup creation failed"
        fi
    done
}

# Function to test backup retention policy
test_backup_retention() {
    print_status "Testing backup retention policy..."
    
    export BACKUP_DIR="$BACKUP_TEST_DIR/backups/retention"
    export DB_NAME="$TEST_DB_NAME"
    export BACKUP_FORMAT="plain"
    export RETENTION_DAILY="2"
    mkdir -p "$BACKUP_TEST_DIR/backups/retention/daily"
    
    # Create multiple backups to test retention
    for i in {1..4}; do
        sleep 1 # Ensure different timestamps
        "$SCRIPT_DIR/backup/backup-database.sh" >/dev/null 2>&1
    done
    
    # Count remaining backups
    local backup_count=$(find "$BACKUP_TEST_DIR/backups/retention/daily" -name "*$TEST_DB_NAME*" -type f | wc -l)
    
    if [ "$backup_count" -eq 2 ]; then
        record_test_result "Backup Retention" "PASS" "$backup_count backups retained"
    else
        record_test_result "Backup Retention" "FAIL" "Expected 2 backups, found $backup_count"
    fi
}

# Function to test rollback scenarios
test_rollback_scenarios() {
    if [ "$RUN_ROLLBACK_TESTS" != "true" ]; then
        return 0
    fi
    
    print_status "Testing rollback scenarios..."
    
    # Create a backup for rollback testing
    export BACKUP_DIR="$BACKUP_TEST_DIR/backups/rollback"
    export DB_NAME="$TEST_DB_NAME"
    export BACKUP_FORMAT="plain"
    mkdir -p "$BACKUP_TEST_DIR/backups/rollback/daily"
    
    if "$SCRIPT_DIR/backup/backup-database.sh" >/dev/null 2>&1; then
        local backup_files=($(find "$BACKUP_TEST_DIR/backups/rollback/daily" -name "*$TEST_DB_NAME*" -type f))
        local rollback_backup="${backup_files[-1]}"
        
        # Modify database (simulate corruption or unwanted changes)
        docker-compose exec -T db psql -U postgres -d "$TEST_DB_NAME" -c "
            INSERT INTO users (email, name, password_hash, role) 
            VALUES ('rollback_test@test.com', 'Rollback Test', 'hash', 'user');
        "
        
        # Test rollback using restore script
        local test_db_copy="spheroseg_rollback_test"
        
        # Create copy for rollback testing
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS $test_db_copy;"
        docker-compose exec -T db psql -U postgres -c "CREATE DATABASE $test_db_copy OWNER postgres;"
        
        # Simulate rollback
        if zcat "$rollback_backup" | docker-compose exec -T db psql -U postgres -d "$test_db_copy" >/dev/null 2>&1; then
            # Verify the rollback test user is NOT in the restored database
            local rollback_user_exists=$(docker-compose exec -T db psql -U postgres -d "$test_db_copy" -t -c "SELECT COUNT(*) FROM users WHERE email = 'rollback_test@test.com';" | tr -d ' ')
            
            if [ "$rollback_user_exists" = "0" ]; then
                record_test_result "Rollback Scenario" "PASS" "Database successfully rolled back to previous state"
            else
                record_test_result "Rollback Scenario" "FAIL" "Rollback did not revert changes"
            fi
            
            # Cleanup
            docker-compose exec -T db psql -U postgres -c "DROP DATABASE $test_db_copy;"
        else
            record_test_result "Rollback Scenario" "FAIL" "Rollback restoration failed"
        fi
    else
        record_test_result "Rollback Scenario" "FAIL" "Failed to create backup for rollback test"
    fi
}

# Function to test disaster recovery scenario
test_disaster_recovery() {
    print_status "Testing disaster recovery scenario..."
    
    # Create a complete backup
    export BACKUP_DIR="$BACKUP_TEST_DIR/backups/disaster"
    export DB_NAME="$TEST_DB_NAME"
    export BACKUP_FORMAT="custom"
    mkdir -p "$BACKUP_TEST_DIR/backups/disaster/daily"
    
    if "$SCRIPT_DIR/backup/backup-database.sh" >/dev/null 2>&1; then
        local backup_files=($(find "$BACKUP_TEST_DIR/backups/disaster/daily" -name "*$TEST_DB_NAME*" -type f))
        local disaster_backup="${backup_files[-1]}"
        
        # Simulate complete database loss
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;"
        
        # Attempt complete recovery
        docker-compose exec -T db psql -U postgres -c "CREATE DATABASE $TEST_DB_NAME OWNER postgres;"
        
        if docker-compose exec -T db pg_restore -U postgres -d "$TEST_DB_NAME" "$disaster_backup" >/dev/null 2>&1; then
            # Verify database structure and data
            local table_count=$(docker-compose exec -T db psql -U postgres -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
            local user_count=$(docker-compose exec -T db psql -U postgres -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
            
            if [ "$table_count" -gt 0 ] && [ "$user_count" -gt 0 ]; then
                record_test_result "Disaster Recovery" "PASS" "Database fully recovered ($table_count tables, $user_count users)"
            else
                record_test_result "Disaster Recovery" "FAIL" "Database structure or data incomplete"
            fi
        else
            record_test_result "Disaster Recovery" "FAIL" "Recovery restoration failed"
        fi
    else
        record_test_result "Disaster Recovery" "FAIL" "Failed to create disaster recovery backup"
    fi
}

# Function to test point-in-time recovery simulation
test_point_in_time_recovery() {
    print_status "Testing point-in-time recovery simulation..."
    
    # Create baseline backup
    export BACKUP_DIR="$BACKUP_TEST_DIR/backups/pit"
    export DB_NAME="$TEST_DB_NAME"
    export BACKUP_FORMAT="plain"
    mkdir -p "$BACKUP_TEST_DIR/backups/pit/daily"
    
    if "$SCRIPT_DIR/backup/backup-database.sh" >/dev/null 2>&1; then
        local backup_files=($(find "$BACKUP_TEST_DIR/backups/pit/daily" -name "*$TEST_DB_NAME*" -type f))
        local pit_backup="${backup_files[-1]}"
        
        # Record timestamp and add new data
        local timestamp_marker="pit_test_$(date +%s)"
        docker-compose exec -T db psql -U postgres -d "$TEST_DB_NAME" -c "
            INSERT INTO users (email, name, password_hash, role) 
            VALUES ('$timestamp_marker@test.com', 'PIT Test User', 'hash', 'user');
        "
        
        # Create recovery database
        local pit_db="spheroseg_pit_test"
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS $pit_db;"
        docker-compose exec -T db psql -U postgres -c "CREATE DATABASE $pit_db OWNER postgres;"
        
        # Restore to point before new data was added
        if zcat "$pit_backup" | docker-compose exec -T db psql -U postgres -d "$pit_db" >/dev/null 2>&1; then
            # Verify the timestamp marker is NOT in the restored database
            local marker_exists=$(docker-compose exec -T db psql -U postgres -d "$pit_db" -t -c "SELECT COUNT(*) FROM users WHERE email = '$timestamp_marker@test.com';" | tr -d ' ')
            
            if [ "$marker_exists" = "0" ]; then
                record_test_result "Point-in-Time Recovery" "PASS" "Successfully restored to point before changes"
            else
                record_test_result "Point-in-Time Recovery" "FAIL" "Point-in-time recovery did not exclude later changes"
            fi
            
            # Cleanup
            docker-compose exec -T db psql -U postgres -c "DROP DATABASE $pit_db;"
        else
            record_test_result "Point-in-Time Recovery" "FAIL" "Point-in-time restoration failed"
        fi
    else
        record_test_result "Point-in-Time Recovery" "FAIL" "Failed to create point-in-time backup"
    fi
}

# Function to cleanup test environment
cleanup_test_environment() {
    if [ "$CLEANUP_AFTER_TESTS" = "true" ]; then
        print_status "Cleaning up test environment..."
        
        # Drop test databases
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" >/dev/null 2>&1 || true
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS spheroseg_restore_test;" >/dev/null 2>&1 || true
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS spheroseg_integrity_test;" >/dev/null 2>&1 || true
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS spheroseg_rollback_test;" >/dev/null 2>&1 || true
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS spheroseg_pit_test;" >/dev/null 2>&1 || true
        
        # Remove test backup directory
        rm -rf "$BACKUP_TEST_DIR"
        
        print_success "Test environment cleaned up"
    else
        print_status "Test files preserved in: $BACKUP_TEST_DIR"
    fi
}

# Function to generate test report
generate_test_report() {
    print_status "Generating test report..."
    
    local report_file="$BACKUP_TEST_DIR/backup_recovery_test_report.txt"
    local html_report="$BACKUP_TEST_DIR/backup_recovery_test_report.html"
    
    # Generate text report
    {
        echo "========================================"
        echo "Backup Recovery Testing Report"
        echo "Generated: $(date)"
        echo "========================================"
        echo ""
        echo "Test Summary:"
        echo "  Total Tests: $TESTS_TOTAL"
        echo "  Passed: $TESTS_PASSED"
        echo "  Failed: $TESTS_FAILED"
        echo "  Success Rate: $(( (TESTS_PASSED * 100) / TESTS_TOTAL ))%"
        echo ""
        
        if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
            echo "Failed Tests:"
            for test in "${FAILED_TESTS[@]}"; do
                echo "  - $test"
            done
            echo ""
        fi
        
        echo "Test Configuration:"
        echo "  Test Database: $TEST_DB_NAME"
        echo "  Test Data Scale: $TEST_DATA_SCALE"
        echo "  Performance Tests: $RUN_PERFORMANCE_TESTS"
        echo "  Integrity Tests: $RUN_INTEGRITY_TESTS"
        echo "  Rollback Tests: $RUN_ROLLBACK_TESTS"
        echo "  Test Directory: $BACKUP_TEST_DIR"
        echo ""
        
        echo "Environment Information:"
        echo "  Docker Version: $(docker --version)"
        echo "  PostgreSQL Version: $(docker-compose exec -T db psql -U postgres -t -c "SELECT version();" | head -1 | tr -d ' ')"
        echo "  Available Disk Space: $(df -h "$BACKUP_TEST_DIR" | tail -1 | awk '{print $4}')"
        echo ""
        
        echo "Test Logs:"
        echo "  Full log available at: $LOG_FILE"
        
    } > "$report_file"
    
    # Generate HTML report
    {
        echo "<!DOCTYPE html><html><head><title>Backup Recovery Test Report</title>"
        echo "<style>body{font-family:Arial,sans-serif;margin:20px;}"
        echo ".header{background:#f4f4f4;padding:10px;border-left:4px solid #333;}"
        echo ".pass{color:green;} .fail{color:red;} .summary{background:#e7f3ff;padding:10px;margin:10px 0;}"
        echo "table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;text-align:left;}"
        echo "th{background-color:#f2f2f2;}</style></head><body>"
        echo "<div class='header'><h1>Backup Recovery Testing Report</h1>"
        echo "<p>Generated: $(date)</p></div>"
        echo "<div class='summary'><h2>Test Summary</h2>"
        echo "<p><strong>Total Tests:</strong> $TESTS_TOTAL</p>"
        echo "<p><strong>Passed:</strong> <span class='pass'>$TESTS_PASSED</span></p>"
        echo "<p><strong>Failed:</strong> <span class='fail'>$TESTS_FAILED</span></p>"
        echo "<p><strong>Success Rate:</strong> $(( (TESTS_PASSED * 100) / TESTS_TOTAL ))%</p></div>"
        
        if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
            echo "<h2>Failed Tests</h2><ul>"
            for test in "${FAILED_TESTS[@]}"; do
                echo "<li class='fail'>$test</li>"
            done
            echo "</ul>"
        fi
        
        echo "<h2>Test Configuration</h2><table>"
        echo "<tr><th>Setting</th><th>Value</th></tr>"
        echo "<tr><td>Test Database</td><td>$TEST_DB_NAME</td></tr>"
        echo "<tr><td>Test Data Scale</td><td>$TEST_DATA_SCALE</td></tr>"
        echo "<tr><td>Performance Tests</td><td>$RUN_PERFORMANCE_TESTS</td></tr>"
        echo "<tr><td>Integrity Tests</td><td>$RUN_INTEGRITY_TESTS</td></tr>"
        echo "<tr><td>Rollback Tests</td><td>$RUN_ROLLBACK_TESTS</td></tr>"
        echo "</table></body></html>"
    } > "$html_report"
    
    print_success "Test report generated:"
    print_status "  Text report: $report_file"
    print_status "  HTML report: $html_report"
    print_status "  Log file: $LOG_FILE"
}

# Function to display final summary
display_final_summary() {
    echo ""
    echo "========================================"
    echo "  Backup Recovery Testing Complete"
    echo "========================================"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All tests passed! ✅"
        echo ""
        echo "Your backup and recovery system is working correctly."
        echo "Consider running these tests regularly to ensure ongoing reliability."
    else
        print_error "Some tests failed! ❌"
        echo ""
        echo "Failed tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
        echo ""
        echo "Please review the test results and fix any issues before relying on backups."
    fi
    
    echo ""
    echo "Test Results Summary:"
    echo "  Total: $TESTS_TOTAL"
    echo "  Passed: $TESTS_PASSED"
    echo "  Failed: $TESTS_FAILED"
    echo "  Success Rate: $(( (TESTS_PASSED * 100) / TESTS_TOTAL ))%"
    echo ""
    
    if [ "$CLEANUP_AFTER_TESTS" != "true" ]; then
        echo "Test artifacts preserved in: $BACKUP_TEST_DIR"
    fi
    
    echo "========================================"
}

# Main execution function
main() {
    echo "========================================"
    echo "  Automated Backup Recovery Testing"
    echo "  SpherosegV4 - Comprehensive Test Suite"
    echo "========================================"
    echo ""
    
    # Command line arguments are already parsed before main() is called
    
    # Initialize logging
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "Starting backup recovery testing at $(date)" > "$LOG_FILE"
    
    # Execute test phases
    check_prerequisites
    setup_test_environment
    
    # Run test categories based on filter
    if [ -n "$TEST_FILTER" ]; then
        print_status "Running specific test: $TEST_FILTER"
        case "$TEST_FILTER" in
            "basic_backup")
                test_basic_backup
                ;;
            "restoration")
                test_backup_restoration
                ;;
            "data_integrity")
                test_data_integrity
                ;;
            "performance")
                test_backup_performance
                ;;
            "format_testing")
                test_backup_formats
                ;;
            "retention_policy")
                test_backup_retention
                ;;
            "rollback_scenarios")
                test_rollback_scenarios
                ;;
            "disaster_recovery")
                test_disaster_recovery
                ;;
            "point_in_time")
                test_point_in_time_recovery
                ;;
            *)
                print_error "Unknown test: $TEST_FILTER"
                print_status "Available tests: basic_backup, restoration, data_integrity, performance, format_testing, retention_policy, rollback_scenarios, disaster_recovery, point_in_time"
                exit 1
                ;;
        esac
    else
        print_status "Running all test categories"
        test_basic_backup
        test_backup_restoration
        test_backup_performance
        test_data_integrity
        test_backup_formats
        test_backup_retention
        test_rollback_scenarios
        test_disaster_recovery
        test_point_in_time_recovery
    fi
    
    # Generate reports and cleanup
    generate_test_report
    cleanup_test_environment
    display_final_summary
    
    # Exit with appropriate code
    if [ $TESTS_FAILED -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Error handler
error_handler() {
    print_error "Script failed on line $1"
    cleanup_test_environment
    exit 1
}

trap 'error_handler $LINENO' ERR

# Change to project directory
cd "$PROJECT_ROOT"

# Run main function with all arguments
main "$@"