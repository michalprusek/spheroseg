#!/bin/bash
# Setup script for ML service testing environment

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Setting up ML service test environment..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install test requirements
echo "Installing test requirements..."
pip install -r requirements-test.txt

# Install main requirements if they exist
if [ -f "requirements.txt" ]; then
    echo "Installing main requirements..."
    pip install -r requirements.txt
fi

# Create necessary directories
echo "Creating test directories..."
mkdir -p tests/__pycache__
mkdir -p test_outputs
mkdir -p .pytest_cache

# Set PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

echo -e "${GREEN}✓ Test environment setup complete!${NC}"
echo ""
echo "To run tests:"
echo "  source venv/bin/activate"
echo "  python -m pytest tests/ -v"
echo ""
echo "To run with coverage:"
echo "  python -m pytest tests/ --cov=. --cov-report=html -v"
echo ""
echo "To run specific test file:"
echo "  python -m pytest tests/test_ml_service.py -v"