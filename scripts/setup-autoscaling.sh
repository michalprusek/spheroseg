#!/bin/bash

# Auto-Scaling Setup Script
# 
# Sets up auto-scaling infrastructure, configurations, and monitoring
# for the SpherosegV4 application.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AUTOSCALE_CONFIG_DIR="$PROJECT_ROOT/config/autoscaling"
DATA_DIR="$PROJECT_ROOT/data"

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

# Function to check if Docker and Docker Compose are available
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are available"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating auto-scaling directories..."
    
    mkdir -p "$AUTOSCALE_CONFIG_DIR"
    mkdir -p "$DATA_DIR/scaling"
    mkdir -p "$DATA_DIR/redis-scaling"
    mkdir -p "$PROJECT_ROOT/logs/autoscaling"
    
    print_success "Directories created"
}

# Function to create auto-scaling configuration files
create_autoscaling_configs() {
    print_status "Creating auto-scaling configuration files..."
    
    # Create default scaling policies configuration
    cat > "$AUTOSCALE_CONFIG_DIR/policies.json" << 'EOF'
{
  "version": "1.0",
  "defaultSettings": {
    "cooldownPeriod": 300,
    "evaluationInterval": 120,
    "enabled": false
  },
  "policies": [
    {
      "name": "backend-production-scaling",
      "service": "backend",
      "description": "Production backend auto-scaling policy",
      "minReplicas": 2,
      "maxReplicas": 8,
      "metrics": [
        {
          "name": "cpu_usage",
          "type": "cpu",
          "source": "system",
          "aggregation": "avg",
          "window": 5,
          "weight": 0.4
        },
        {
          "name": "memory_usage",
          "type": "memory",
          "source": "system",
          "aggregation": "avg",
          "window": 5,
          "weight": 0.3
        },
        {
          "name": "request_rate",
          "type": "requests",
          "source": "business_metrics",
          "aggregation": "avg",
          "window": 5,
          "weight": 0.3
        }
      ],
      "thresholds": [
        {
          "metric": "cpu_usage",
          "scaleUp": 70,
          "scaleDown": 25,
          "comparison": "greater_than"
        },
        {
          "metric": "memory_usage",
          "scaleUp": 80,
          "scaleDown": 35,
          "comparison": "greater_than"
        },
        {
          "metric": "request_rate",
          "scaleUp": 150,
          "scaleDown": 30,
          "comparison": "greater_than"
        }
      ],
      "cooldownPeriod": 300,
      "scaleUpBy": 1,
      "scaleDownBy": 1,
      "evaluationInterval": 120,
      "enabled": false
    },
    {
      "name": "ml-processing-scaling",
      "service": "ml",
      "description": "ML service auto-scaling based on queue length",
      "minReplicas": 1,
      "maxReplicas": 4,
      "metrics": [
        {
          "name": "processing_queue_length",
          "type": "queue_length",
          "source": "business_metrics",
          "aggregation": "avg",
          "window": 10,
          "weight": 0.7
        },
        {
          "name": "processing_failure_rate",
          "type": "errors",
          "source": "business_metrics",
          "aggregation": "avg",
          "window": 15,
          "weight": 0.3
        }
      ],
      "thresholds": [
        {
          "metric": "processing_queue_length",
          "scaleUp": 15,
          "scaleDown": 3,
          "comparison": "greater_than"
        },
        {
          "metric": "processing_failure_rate",
          "scaleUp": 8,
          "scaleDown": 2,
          "comparison": "greater_than"
        }
      ],
      "cooldownPeriod": 600,
      "scaleUpBy": 1,
      "scaleDownBy": 1,
      "evaluationInterval": 300,
      "enabled": false
    }
  ]
}
EOF

    # Create scaling environment configuration
    cat > "$AUTOSCALE_CONFIG_DIR/.env.autoscaling" << 'EOF'
# Auto-Scaling Environment Configuration

# Global auto-scaling settings
AUTOSCALING_ENABLED=false
AUTOSCALING_LOG_LEVEL=info
AUTOSCALING_METRICS_RETENTION_DAYS=30

# Docker configuration
DOCKER_COMPOSE_PROJECT_NAME=spheroseg
DOCKER_COMPOSE_FILE=docker-compose.yml
DOCKER_COMPOSE_AUTOSCALE_FILE=docker-compose.autoscale.yml

# Redis configuration for scaling metrics
REDIS_SCALING_DB=2
REDIS_SCALING_KEY_PREFIX=autoscaling:
REDIS_SCALING_TTL=2592000

# Metric collection intervals (seconds)
SYSTEM_METRICS_INTERVAL=60
BUSINESS_METRICS_INTERVAL=120
HEALTH_CHECK_INTERVAL=30

# Safety limits
MAX_TOTAL_REPLICAS=20
MIN_AVAILABLE_MEMORY_MB=512
MIN_AVAILABLE_CPU_PERCENT=10

# Notification settings
SCALING_NOTIFICATIONS_ENABLED=true
SCALING_WEBHOOK_URL=
SCALING_EMAIL_ENABLED=false
SCALING_EMAIL_TO=

# Development/testing settings
AUTOSCALING_DRY_RUN=false
AUTOSCALING_SIMULATE_METRICS=false
AUTOSCALING_LOG_SCALING_DECISIONS=true
EOF

    # Create Nginx upstream configuration template
    cat > "$AUTOSCALE_CONFIG_DIR/nginx-upstream.conf.template" << 'EOF'
# Auto-generated Nginx upstream configuration for scaled services
# This file is regenerated automatically by the auto-scaler

upstream backend_upstream {
    least_conn;
    
    # Backend service instances (auto-generated)
    # server backend:5001 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}

upstream ml_upstream {
    least_conn;
    
    # ML service instances (auto-generated)
    # server ml:5002 max_fails=2 fail_timeout=60s;
    
    keepalive 8;
    keepalive_requests 50;
    keepalive_timeout 120s;
}

# Health check configurations
location /api/health {
    proxy_pass http://backend_upstream;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Health check specific settings
    proxy_connect_timeout 5s;
    proxy_send_timeout 10s;
    proxy_read_timeout 10s;
}

location /ml/health {
    proxy_pass http://ml_upstream;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # ML health check specific settings
    proxy_connect_timeout 10s;
    proxy_send_timeout 15s;
    proxy_read_timeout 15s;
}
EOF

    print_success "Auto-scaling configuration files created"
}

# Function to create monitoring dashboard configuration
create_monitoring_dashboard() {
    print_status "Creating monitoring dashboard configuration..."
    
    cat > "$AUTOSCALE_CONFIG_DIR/dashboard-config.json" << 'EOF'
{
  "dashboard": {
    "title": "SpherosegV4 Auto-Scaling Dashboard",
    "refreshInterval": 30,
    "panels": [
      {
        "title": "Service Replica Counts",
        "type": "stat",
        "metrics": [
          "autoscaling_replicas_backend",
          "autoscaling_replicas_ml",
          "autoscaling_replicas_nginx"
        ]
      },
      {
        "title": "CPU Usage by Service",
        "type": "timeseries",
        "metrics": [
          "system_cpu_usage_backend",
          "system_cpu_usage_ml"
        ]
      },
      {
        "title": "Memory Usage by Service",
        "type": "timeseries",
        "metrics": [
          "system_memory_usage_backend",
          "system_memory_usage_ml"
        ]
      },
      {
        "title": "Request Rate",
        "type": "timeseries",
        "metrics": [
          "business_request_rate",
          "business_error_rate"
        ]
      },
      {
        "title": "ML Processing Queue",
        "type": "timeseries",
        "metrics": [
          "business_processing_queue_length",
          "business_processing_failure_rate"
        ]
      },
      {
        "title": "Scaling Events",
        "type": "table",
        "metrics": [
          "autoscaling_events_last_24h"
        ]
      }
    ]
  },
  "alerts": [
    {
      "name": "High CPU Usage",
      "condition": "system_cpu_usage_backend > 85",
      "severity": "warning",
      "duration": "5m"
    },
    {
      "name": "Scaling Failure",
      "condition": "autoscaling_errors > 0",
      "severity": "critical",
      "duration": "1m"
    },
    {
      "name": "ML Queue Overflow",
      "condition": "business_processing_queue_length > 50",
      "severity": "warning",
      "duration": "10m"
    }
  ]
}
EOF

    print_success "Monitoring dashboard configuration created"
}

# Function to create auto-scaling management scripts
create_management_scripts() {
    print_status "Creating auto-scaling management scripts..."
    
    # Create scaling control script
    cat > "$PROJECT_ROOT/scripts/autoscaling-control.sh" << 'EOF'
#!/bin/bash

# Auto-Scaling Control Script
# Provides commands to manage auto-scaling policies and monitor scaling status

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
API_URL="http://localhost:5001/api"

# Function to get admin auth token
get_auth_token() {
    local email="${ADMIN_EMAIL:-testuser@test.com}"
    local password="${ADMIN_PASSWORD:-testuser123}"
    
    local response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    echo "$response" | jq -r '.token // empty'
}

# Function to call auto-scaling API
call_api() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="$3"
    local token=$(get_auth_token)
    
    if [ -z "$token" ]; then
        echo "Failed to get authentication token"
        exit 1
    fi
    
    local curl_cmd="curl -s -X $method '$API_URL/autoscaling$endpoint' -H 'Authorization: Bearer $token'"
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    eval "$curl_cmd"
}

# Command functions
cmd_status() {
    echo "Getting auto-scaling status..."
    call_api "/status" | jq '.'
}

cmd_enable() {
    echo "Enabling auto-scaling..."
    call_api "/enable" "POST" '{"enabled": true}' | jq '.'
}

cmd_disable() {
    echo "Disabling auto-scaling..."
    call_api "/enable" "POST" '{"enabled": false}' | jq '.'
}

cmd_policies() {
    echo "Getting scaling policies..."
    call_api "/policies" | jq '.'
}

cmd_history() {
    local service="${1:-backend}"
    echo "Getting scaling history for $service..."
    call_api "/history/$service" | jq '.'
}

cmd_metrics() {
    echo "Getting available metrics..."
    call_api "/metrics" | jq '.'
}

cmd_services() {
    echo "Getting available services..."
    call_api "/services" | jq '.'
}

cmd_recommendations() {
    echo "Getting scaling recommendations..."
    call_api "/recommendations" | jq '.'
}

# Main command handling
case "${1:-help}" in
    status)
        cmd_status
        ;;
    enable)
        cmd_enable
        ;;
    disable)
        cmd_disable
        ;;
    policies)
        cmd_policies
        ;;
    history)
        cmd_history "$2"
        ;;
    metrics)
        cmd_metrics
        ;;
    services)
        cmd_services
        ;;
    recommendations)
        cmd_recommendations
        ;;
    help|*)
        echo "Auto-Scaling Control Script"
        echo "Usage: $0 <command> [arguments]"
        echo ""
        echo "Commands:"
        echo "  status           - Show auto-scaling status"
        echo "  enable           - Enable auto-scaling"
        echo "  disable          - Disable auto-scaling"
        echo "  policies         - List scaling policies"
        echo "  history [service] - Show scaling history"
        echo "  metrics          - List available metrics"
        echo "  services         - List available services"
        echo "  recommendations  - Get scaling recommendations"
        echo "  help             - Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  ADMIN_EMAIL      - Admin email (default: testuser@test.com)"
        echo "  ADMIN_PASSWORD   - Admin password (default: testuser123)"
        ;;
esac
EOF

    chmod +x "$PROJECT_ROOT/scripts/autoscaling-control.sh"
    
    # Create scaling monitoring script
    cat > "$PROJECT_ROOT/scripts/monitor-autoscaling.sh" << 'EOF'
#!/bin/bash

# Auto-Scaling Monitoring Script
# Continuously monitors scaling status and displays real-time information

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to display scaling status
display_status() {
    clear
    echo "========================================"
    echo "  SpherosegV4 Auto-Scaling Monitor"
    echo "  $(date)"
    echo "========================================"
    echo ""
    
    # Get current replica counts
    echo "Current Service Replicas:"
    docker-compose ps --format "table {{.Service}}\t{{.State}}\t{{.Ports}}" | grep -E "(backend|ml|nginx)" || echo "No services running"
    echo ""
    
    # Get auto-scaling status
    echo "Auto-Scaling Status:"
    "$SCRIPT_DIR/autoscaling-control.sh" status 2>/dev/null | jq -r '
        if .success then
            "Enabled: " + (.status.enabled | tostring) + "\n" +
            "Policies: " + (.status.policies | length | tostring) + "\n" +
            (.status.policies[] | "  " + .name + " (" + .service + "): " + (.currentReplicas | tostring) + " replicas")
        else
            "API not available or not authenticated"
        end
    ' 2>/dev/null || echo "Auto-scaling API not available"
    echo ""
    
    # Get recent scaling events
    echo "Recent Scaling Events:"
    "$SCRIPT_DIR/autoscaling-control.sh" history backend 2>/dev/null | jq -r '
        if .success and (.history | length > 0) then
            .history[0:3][] | 
            "  " + .timestamp + " - " + .service + ": " + .action + " (" + (.fromReplicas | tostring) + " -> " + (.toReplicas | tostring) + ")"
        else
            "  No recent scaling events"
        end
    ' 2>/dev/null || echo "  History not available"
    echo ""
    
    echo "Press Ctrl+C to exit"
}

# Monitor loop
echo "Starting auto-scaling monitor..."
echo "Press Ctrl+C to exit"

while true; do
    display_status
    sleep 30
done
EOF

    chmod +x "$PROJECT_ROOT/scripts/monitor-autoscaling.sh"
    
    print_success "Management scripts created"
}

# Function to validate configuration
validate_configuration() {
    print_status "Validating auto-scaling configuration..."
    
    # Check if required files exist
    local required_files=(
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/docker-compose.autoscale.yml"
        "$AUTOSCALE_CONFIG_DIR/policies.json"
        "$AUTOSCALE_CONFIG_DIR/.env.autoscaling"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file missing: $file"
            exit 1
        fi
    done
    
    # Validate JSON configuration files
    if ! jq empty "$AUTOSCALE_CONFIG_DIR/policies.json" 2>/dev/null; then
        print_error "Invalid JSON in policies.json"
        exit 1
    fi
    
    if ! jq empty "$AUTOSCALE_CONFIG_DIR/dashboard-config.json" 2>/dev/null; then
        print_error "Invalid JSON in dashboard-config.json"
        exit 1
    fi
    
    print_success "Configuration validation passed"
}

# Function to create systemd service (optional)
create_systemd_service() {
    if [ "$EUID" -eq 0 ] && command -v systemctl &> /dev/null; then
        print_status "Creating systemd service for auto-scaling..."
        
        cat > /etc/systemd/system/spheroseg-autoscaling.service << EOF
[Unit]
Description=SpherosegV4 Auto-Scaling Service
After=docker.service
Requires=docker.service

[Service]
Type=forking
User=$USER
Group=$USER
WorkingDirectory=$PROJECT_ROOT
ExecStart=/usr/bin/docker-compose -f docker-compose.yml -f docker-compose.autoscale.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.yml -f docker-compose.autoscale.yml down
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

        systemctl daemon-reload
        
        print_success "Systemd service created. Enable with: sudo systemctl enable spheroseg-autoscaling"
    else
        print_warning "Skipping systemd service creation (requires root or systemd not available)"
    fi
}

# Function to display setup summary
display_summary() {
    echo ""
    echo "========================================"
    echo "  Auto-Scaling Setup Complete!"
    echo "========================================"
    echo ""
    echo "Configuration files created:"
    echo "  - $AUTOSCALE_CONFIG_DIR/policies.json"
    echo "  - $AUTOSCALE_CONFIG_DIR/.env.autoscaling"
    echo "  - $AUTOSCALE_CONFIG_DIR/dashboard-config.json"
    echo "  - $PROJECT_ROOT/docker-compose.autoscale.yml"
    echo ""
    echo "Management scripts:"
    echo "  - $PROJECT_ROOT/scripts/autoscaling-control.sh"
    echo "  - $PROJECT_ROOT/scripts/monitor-autoscaling.sh"
    echo ""
    echo "Next steps:"
    echo "1. Review and customize the configuration files"
    echo "2. Start services with auto-scaling:"
    echo "   docker-compose -f docker-compose.yml -f docker-compose.autoscale.yml up -d"
    echo "3. Enable auto-scaling:"
    echo "   ./scripts/autoscaling-control.sh enable"
    echo "4. Monitor scaling status:"
    echo "   ./scripts/monitor-autoscaling.sh"
    echo ""
    echo "API endpoints available at:"
    echo "  http://localhost:5001/api/autoscaling/status"
    echo "  http://localhost:5001/api/autoscaling/policies"
    echo ""
    print_warning "Auto-scaling is disabled by default for safety!"
    print_warning "Review all configurations before enabling in production."
    echo ""
}

# Main execution
main() {
    echo "========================================"
    echo "  SpherosegV4 Auto-Scaling Setup"
    echo "========================================"
    echo ""
    
    # Parse command line arguments
    local create_systemd=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --systemd)
                create_systemd=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --systemd    Create systemd service"
                echo "  --help, -h   Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute setup steps
    check_docker
    create_directories
    create_autoscaling_configs
    create_monitoring_dashboard
    create_management_scripts
    validate_configuration
    
    if [ "$create_systemd" = true ]; then
        create_systemd_service
    fi
    
    display_summary
}

# Run main function with all arguments
main "$@"
EOF

chmod +x "$PROJECT_ROOT/scripts/setup-autoscaling.sh"