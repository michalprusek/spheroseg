#!/bin/bash

# SpheroSeg Development Environment Manager
# This script provides a unified interface for managing the application's development environment

BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
CYAN="\033[36m"
RESET="\033[0m"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function print_header() {
  clear
  echo -e "${BOLD}${BLUE}"
  echo "  ___ _    _           ___ ___ ___ "
  echo " / __| |_ | |_  ___ _ / __| __/ __|"
  echo " \__ \ ' \| ' \/ -_) '_\__ \ _| (_ |"
  echo " |___/_||_|_||_\___|_| |___/___\___|"
  echo -e "${RESET}"
  echo -e "${BOLD}Development Environment${RESET}"
  echo ""
}

function start_frontend() {
  print_header
  echo -e "${BOLD}Starting frontend development server...${RESET}"
  echo ""
  
  cd "$PROJECT_DIR" || exit 1
  npm run dev
}

function start_backend() {
  print_header
  echo -e "${BOLD}Starting backend server...${RESET}"
  echo ""
  
  cd "$PROJECT_DIR/backend" || exit 1
  python main.py
}

function start_mcp() {
  print_header
  echo -e "${BOLD}Starting MCP Dashboard...${RESET}"
  echo ""
  
  "$PROJECT_DIR/MCP/dashboard.sh"
}

function open_browser_tools() {
  print_header
  echo -e "${BOLD}Opening browser tools VNC viewer...${RESET}"
  echo ""
  
  echo -e "${CYAN}Opening Chrome VNC viewer at: http://localhost:7900${RESET}"
  echo -e "Password: ${YELLOW}secret${RESET}"
  echo ""
  
  # Open Chrome VNC viewer in the default browser
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:7900"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:7900"
  else
    echo -e "${YELLOW}Couldn't automatically open the browser.${RESET}"
    echo -e "Please manually open: ${CYAN}http://localhost:7900${RESET}"
  fi
  
  echo "Press Enter to return to the menu..."
  read -r
}

function open_minio() {
  print_header
  echo -e "${BOLD}Opening MinIO Console...${RESET}"
  echo ""
  
  echo -e "${CYAN}Opening MinIO Console at: http://localhost:9001${RESET}"
  echo -e "Username: ${YELLOW}minioadmin${RESET}"
  echo -e "Password: ${YELLOW}minioadmin${RESET}"
  echo ""
  
  # Open MinIO Console in the default browser
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:9001"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:9001"
  else
    echo -e "${YELLOW}Couldn't automatically open the browser.${RESET}"
    echo -e "Please manually open: ${CYAN}http://localhost:9001${RESET}"
  fi
  
  echo "Press Enter to return to the menu..."
  read -r
}

function build_docker_images() {
  print_header
  echo -e "${BOLD}Building Docker images...${RESET}"
  echo ""
  
  cd "$PROJECT_DIR" || exit 1
  
  echo -e "${CYAN}Building frontend image...${RESET}"
  docker build -t spheroseg-frontend -f Dockerfile.frontend .
  
  echo -e "${CYAN}Building backend image...${RESET}"
  docker build -t spheroseg-backend -f Dockerfile .
  
  echo -e "${GREEN}Images built successfully!${RESET}"
  echo ""
  echo "Press Enter to return to the menu..."
  read -r
}

function check_environment() {
  print_header
  echo -e "${BOLD}Checking development environment...${RESET}"
  echo ""
  
  # Check Node.js and npm
  if command -v node >/dev/null 2>&1; then
    node_version=$(node -v)
    echo -e "Node.js: ${GREEN}$node_version${RESET}"
  else
    echo -e "Node.js: ${RED}Not installed${RESET}"
  fi
  
  if command -v npm >/dev/null 2>&1; then
    npm_version=$(npm -v)
    echo -e "npm: ${GREEN}$npm_version${RESET}"
  else
    echo -e "npm: ${RED}Not installed${RESET}"
  fi
  
  # Check Python
  if command -v python3 >/dev/null 2>&1; then
    python_version=$(python3 --version)
    echo -e "Python: ${GREEN}$python_version${RESET}"
  else
    echo -e "Python: ${RED}Not installed${RESET}"
  fi
  
  # Check Docker
  if command -v docker >/dev/null 2>&1; then
    docker_version=$(docker --version)
    echo -e "Docker: ${GREEN}$docker_version${RESET}"
    
    # Check if Docker is running
    if docker info >/dev/null 2>&1; then
      echo -e "Docker status: ${GREEN}Running${RESET}"
    else
      echo -e "Docker status: ${RED}Not running${RESET}"
    fi
  else
    echo -e "Docker: ${RED}Not installed${RESET}"
  fi
  
  # Check Docker Compose
  if command -v docker-compose >/dev/null 2>&1; then
    compose_version=$(docker-compose --version)
    echo -e "Docker Compose: ${GREEN}$compose_version${RESET}"
  else
    echo -e "Docker Compose: ${RED}Not installed${RESET}"
  fi
  
  # Check MCP services
  echo ""
  echo -e "${BOLD}MCP Services:${RESET}"
  
  if docker ps --format "{{.Names}}" | grep -q "spheroseg-postgres"; then
    echo -e "PostgreSQL: ${GREEN}Running${RESET}"
  else
    echo -e "PostgreSQL: ${RED}Not running${RESET}"
  fi
  
  if docker ps --format "{{.Names}}" | grep -q "spheroseg-minio"; then
    echo -e "MinIO: ${GREEN}Running${RESET}"
  else
    echo -e "MinIO: ${RED}Not running${RESET}"
  fi
  
  if docker ps --format "{{.Names}}" | grep -q "spheroseg-browser-tools"; then
    echo -e "Browser Tools: ${GREEN}Running${RESET}"
  else
    echo -e "Browser Tools: ${RED}Not running${RESET}"
  fi
  
  if docker ps --format "{{.Names}}" | grep -q "spheroseg-chrome"; then
    echo -e "Chrome: ${GREEN}Running${RESET}"
  else
    echo -e "Chrome: ${RED}Not running${RESET}"
  fi
  
  echo ""
  echo "Press Enter to return to the menu..."
  read -r
}

function show_menu() {
  print_header
  echo -e "${BOLD}MENU OPTIONS${RESET}"
  echo -e "${BOLD}------------------------------------${RESET}"
  echo -e "1) ${GREEN}Start Frontend Server${RESET}"
  echo -e "2) ${GREEN}Start Backend Server${RESET}"
  echo -e "3) ${BLUE}Start MCP Dashboard${RESET}"
  echo -e "4) ${BLUE}Open Browser Tools VNC${RESET}"
  echo -e "5) ${BLUE}Open MinIO Console${RESET}"
  echo -e "6) ${YELLOW}Build Docker Images${RESET}"
  echo -e "7) ${CYAN}Check Environment${RESET}"
  echo -e "8) ${RED}Exit${RESET}"
  echo -e "${BOLD}------------------------------------${RESET}"
  echo -e "Enter your choice: "
  read -r choice
  
  case $choice in
    1) start_frontend ;;
    2) start_backend ;;
    3) start_mcp ;;
    4) open_browser_tools ;;
    5) open_minio ;;
    6) build_docker_images ;;
    7) check_environment ;;
    8) exit 0 ;;
    *) 
      echo "Invalid option. Press Enter to continue..."
      read -r
      ;;
  esac
  
  # Return to menu
  show_menu
}

# Main program
show_menu