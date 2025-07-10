#!/usr/bin/env python3
"""
Test runner for ML service with proper environment setup and reporting.
"""
import os
import sys
import subprocess
import argparse
from pathlib import Path


def setup_environment():
    """Setup test environment variables and paths."""
    # Add parent directory to Python path
    parent_dir = Path(__file__).parent.parent
    sys.path.insert(0, str(parent_dir))
    
    # Set test environment variables
    os.environ['TESTING'] = 'true'
    os.environ['DEBUG'] = 'false'
    os.environ['MODEL_PATH'] = '/ML/checkpoint_epoch_9.pth.tar'
    os.environ['DEVICE_PREFERENCE'] = 'cpu'  # Use CPU for tests
    
    # Create test directories
    test_dirs = ['test_outputs', 'test_uploads', '.pytest_cache']
    for dir_name in test_dirs:
        Path(dir_name).mkdir(exist_ok=True)


def run_tests(args):
    """Run pytest with specified arguments."""
    pytest_args = ['python', '-m', 'pytest']
    
    # Add verbosity
    if args.verbose:
        pytest_args.append('-v')
    else:
        pytest_args.append('-q')
    
    # Add coverage if requested
    if args.coverage:
        pytest_args.extend(['--cov=..', '--cov-report=html', '--cov-report=term'])
    
    # Add specific test file/directory
    if args.target:
        pytest_args.append(args.target)
    else:
        pytest_args.append('.')
    
    # Add markers
    if args.markers:
        pytest_args.extend(['-m', args.markers])
    
    # Add additional pytest arguments
    if args.pytest_args:
        pytest_args.extend(args.pytest_args.split())
    
    # Show test output
    if args.show_output:
        pytest_args.append('-s')
    
    # Run tests
    print(f"Running: {' '.join(pytest_args)}")
    result = subprocess.run(pytest_args)
    
    return result.returncode


def main():
    """Main test runner function."""
    parser = argparse.ArgumentParser(description='Run ML service tests')
    parser.add_argument('target', nargs='?', help='Specific test file or directory')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    parser.add_argument('-c', '--coverage', action='store_true', help='Generate coverage report')
    parser.add_argument('-m', '--markers', help='Run tests matching given mark expression')
    parser.add_argument('-s', '--show-output', action='store_true', help='Show print statements')
    parser.add_argument('--pytest-args', help='Additional pytest arguments (quoted)')
    
    args = parser.parse_args()
    
    # Setup environment
    setup_environment()
    
    # Run tests
    exit_code = run_tests(args)
    
    # Print results
    if exit_code == 0:
        print("\n✅ All tests passed!")
    else:
        print(f"\n❌ Tests failed with exit code: {exit_code}")
    
    return exit_code


if __name__ == '__main__':
    sys.exit(main())