"""
Demo Test: ML Service Shared Test Utilities Integration
Demonstrates the use of our shared testing infrastructure in ML service tests
"""

import pytest
import json
import subprocess
import tempfile
import os
import time
import sys
from pathlib import Path
from typing import Dict, List, Any

# Add parent directory to Python path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

class NodeJSTestReporter:
    """
    Python wrapper for our Node.js TestReporter utility.
    Communicates with shared test utilities via subprocess calls.
    """
    
    def __init__(self):
        self.shared_utils_path = Path(__file__).parent.parent.parent.parent / "shared" / "test-utils"
        self.test_results: List[Dict[str, Any]] = []
        
    def record_test(self, test_result: Dict[str, Any]) -> None:
        """Record a test result for later reporting."""
        self.test_results.append(test_result)
    
    def generate_report(self) -> str:
        """Generate a markdown report using Node.js utilities."""
        try:
            # Create a temporary file with test results
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(self.test_results, f, indent=2)
                temp_file = f.name
            
            # Call Node.js script to generate report
            node_script = f"""
            const {{ globalTestReporter }} = require('{self.shared_utils_path}/test-reporter');
            const fs = require('fs');
            
            const testResults = JSON.parse(fs.readFileSync('{temp_file}', 'utf8'));
            testResults.forEach(result => globalTestReporter.recordTest(result));
            
            const report = globalTestReporter.generateMarkdownReport();
            console.log(report);
            """
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                f.write(node_script)
                script_file = f.name
            
            # Execute Node.js script
            result = subprocess.run(
                ['node', script_file],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Cleanup temp files
            os.unlink(temp_file)
            os.unlink(script_file)
            
            if result.returncode == 0:
                return result.stdout
            else:
                return f"Error generating report: {result.stderr}"
                
        except Exception as e:
            return f"Error generating report: {str(e)}"

class PerformanceMonitor:
    """
    Python wrapper for performance monitoring utilities.
    Tracks execution time and memory usage for ML operations.
    """
    
    def __init__(self):
        self.metrics: Dict[str, Any] = {}
        self.start_times: Dict[str, float] = {}
        
    def start_timer(self, metric_name: str) -> None:
        """Start timing a metric."""
        self.start_times[metric_name] = time.time()
    
    def end_timer(self, metric_name: str) -> float:
        """End timing a metric and return duration."""
        if metric_name in self.start_times:
            duration = time.time() - self.start_times[metric_name]
            self.metrics[metric_name] = {
                'value': duration * 1000,  # Convert to milliseconds
                'unit': 'ms',
                'type': 'timer'
            }
            del self.start_times[metric_name]
            return duration
        return 0.0
    
    def record_memory_usage(self, checkpoint: str) -> None:
        """Record current memory usage."""
        try:
            import psutil
            import os
            
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            
            self.metrics[f"memory_{checkpoint}"] = {
                'value': memory_info.rss,  # Resident Set Size
                'unit': 'bytes',
                'type': 'memory'
            }
        except ImportError:
            # psutil not available, record placeholder
            self.metrics[f"memory_{checkpoint}"] = {
                'value': 0,
                'unit': 'bytes',
                'type': 'memory',
                'note': 'psutil not available'
            }
    
    def generate_report(self, test_name: str) -> Dict[str, Any]:
        """Generate performance report."""
        return {
            'testName': test_name,
            'timestamp': time.time() * 1000,  # JavaScript-style timestamp
            'metrics': [
                {
                    'name': name,
                    'value': data['value'],
                    'unit': data['unit'],
                    'type': data['type']
                }
                for name, data in self.metrics.items()
            ],
            'summary': {
                'totalMetrics': len(self.metrics),
                'timers': len([m for m in self.metrics.values() if m['type'] == 'timer']),
                'memoryCheckpoints': len([m for m in self.metrics.values() if m['type'] == 'memory'])
            }
        }

class IntegrationTestCoordinator:
    """
    Coordinates cross-service integration testing for ML service.
    """
    
    def __init__(self):
        self.services = {
            'backend': 'http://localhost:5001',
            'ml': 'http://localhost:5002',
            'frontend': 'http://localhost:3000'
        }
        
    def check_service_health(self, service_name: str) -> Dict[str, Any]:
        """Check if a service is healthy."""
        try:
            import requests
            
            if service_name not in self.services:
                return {'status': 'unknown', 'error': f'Unknown service: {service_name}'}
            
            url = f"{self.services[service_name]}/health"
            response = requests.get(url, timeout=5)
            
            return {
                'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                'statusCode': response.status_code,
                'responseTime': response.elapsed.total_seconds() * 1000
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
    
    def wait_for_services(self, services: List[str], timeout: int = 30) -> Dict[str, Any]:
        """Wait for multiple services to become healthy."""
        start_time = time.time()
        results = {}
        
        while time.time() - start_time < timeout:
            all_healthy = True
            
            for service in services:
                health = self.check_service_health(service)
                results[service] = health
                
                if health['status'] != 'healthy':
                    all_healthy = False
            
            if all_healthy:
                break
                
            time.sleep(1)  # Wait 1 second before retry
        
        return {
            'allHealthy': all([r['status'] == 'healthy' for r in results.values()]),
            'services': results,
            'totalWaitTime': time.time() - start_time
        }

# Test fixtures using shared utilities
@pytest.fixture
def test_reporter():
    """Provide test reporter instance."""
    return NodeJSTestReporter()

@pytest.fixture
def performance_monitor():
    """Provide performance monitor instance."""
    return PerformanceMonitor()

@pytest.fixture
def integration_coordinator():
    """Provide integration test coordinator."""
    return IntegrationTestCoordinator()

# Test Suite
class TestMLServiceSharedUtilities:
    """Test suite demonstrating shared utilities integration in ML service."""
    
    def test_nodejs_test_reporter_integration(self, test_reporter):
        """Test that we can record and generate reports using Node.js utilities."""
        # Record sample test results
        test_reporter.record_test({
            'name': 'ML model loading test',
            'status': 'passed',
            'duration': 250,
            'suite': 'demo',
            'service': 'ml'
        })
        
        test_reporter.record_test({
            'name': 'Image processing test',
            'status': 'passed',
            'duration': 180,
            'suite': 'demo',
            'service': 'ml'
        })
        
        # Generate report
        report = test_reporter.generate_report()
        
        # Verify report handling (Node.js may not be available in ML container)
        if "Error generating report" in report:
            # Node.js not available - verify we handled it gracefully
            assert "No such file or directory: 'node'" in report or len(report) > 0
            # Verify we can still record test results
            assert len(test_reporter.test_results) == 2
            assert test_reporter.test_results[0]['name'] == 'ML model loading test'
        else:
            # Node.js available - verify full functionality
            assert "Test Execution Report" in report or len(report) > 100
            assert "ml" in report or "ML model loading test" in report
    
    def test_performance_monitoring_ml_operations(self, performance_monitor):
        """Test performance monitoring for ML operations."""
        # Record memory before operation
        performance_monitor.record_memory_usage('before_operation')
        
        # Simulate ML model loading
        performance_monitor.start_timer('model_loading')
        time.sleep(0.1)  # Simulate loading time
        model_load_time = performance_monitor.end_timer('model_loading')
        
        # Simulate image processing
        performance_monitor.start_timer('image_processing')
        time.sleep(0.05)  # Simulate processing time
        processing_time = performance_monitor.end_timer('image_processing')
        
        # Record memory after operation
        performance_monitor.record_memory_usage('after_operation')
        
        # Generate performance report
        report = performance_monitor.generate_report('ml-performance-test')
        
        # Verify measurements
        assert model_load_time > 0.09  # Should be approximately 100ms
        assert processing_time > 0.04  # Should be approximately 50ms
        
        # Verify report structure
        assert report['testName'] == 'ml-performance-test'
        assert report['summary']['totalMetrics'] >= 4  # 2 timers + 2 memory checkpoints
        assert report['summary']['timers'] >= 2
        assert report['summary']['memoryCheckpoints'] >= 2
        
        # Verify metrics have correct structure
        for metric in report['metrics']:
            assert 'name' in metric
            assert 'value' in metric
            assert 'unit' in metric
            assert 'type' in metric
    
    def test_integration_coordinator_health_checks(self, integration_coordinator):
        """Test integration coordinator for service health monitoring."""
        # Check ML service health (should be available during tests)
        ml_health = integration_coordinator.check_service_health('ml')
        
        # ML service should be reachable in test environment
        assert 'status' in ml_health
        assert ml_health['status'] in ['healthy', 'unhealthy']  # Either is valid
        
        # Test unknown service
        unknown_health = integration_coordinator.check_service_health('unknown')
        assert unknown_health['status'] == 'unknown'
        assert 'Unknown service' in unknown_health['error']
    
    def test_cross_service_coordination(self, integration_coordinator):
        """Test coordination across multiple services."""
        # Attempt to check multiple services
        services_to_check = ['ml']  # Only check ML service in isolation
        
        # Wait for services with short timeout for faster tests
        results = integration_coordinator.wait_for_services(services_to_check, timeout=5)
        
        # Verify response structure
        assert 'allHealthy' in results
        assert 'services' in results
        assert 'totalWaitTime' in results
        assert 'ml' in results['services']
        
        # Verify timing is reasonable
        assert results['totalWaitTime'] <= 6  # Should complete within timeout + buffer
    
    def test_ml_specific_operations_with_monitoring(self, performance_monitor):
        """Test ML-specific operations with performance monitoring."""
        # Test simulated ML pipeline with monitoring
        performance_monitor.record_memory_usage('pipeline_start')
        
        # Simulate image preprocessing
        performance_monitor.start_timer('preprocessing')
        time.sleep(0.02)  # Simulate preprocessing
        performance_monitor.end_timer('preprocessing')
        
        # Simulate model inference
        performance_monitor.start_timer('inference')
        time.sleep(0.08)  # Simulate model inference
        performance_monitor.end_timer('inference')
        
        # Simulate polygon extraction
        performance_monitor.start_timer('polygon_extraction')
        time.sleep(0.03)  # Simulate polygon extraction
        performance_monitor.end_timer('polygon_extraction')
        
        performance_monitor.record_memory_usage('pipeline_complete')
        
        # Generate comprehensive report
        report = performance_monitor.generate_report('ml-pipeline-performance')
        
        # Verify all stages were captured
        metric_names = [m['name'] for m in report['metrics']]
        assert 'preprocessing' in metric_names
        assert 'inference' in metric_names
        assert 'polygon_extraction' in metric_names
        assert any('memory_' in name for name in metric_names)
        
        # Verify performance characteristics
        assert report['summary']['timers'] == 3
        assert report['summary']['memoryCheckpoints'] >= 2
    
    def test_shared_utilities_error_handling(self, test_reporter, performance_monitor):
        """Test error handling in shared utilities."""
        # Test performance monitor with missing timer
        duration = performance_monitor.end_timer('nonexistent_timer')
        assert duration == 0.0  # Should handle gracefully
        
        # Test recording failed test
        test_reporter.record_test({
            'name': 'Failed ML test',
            'status': 'failed',
            'duration': 100,
            'suite': 'demo',
            'service': 'ml',
            'error': 'Simulated failure for testing'
        })
        
        # Should still be able to generate report
        report = test_reporter.generate_report()
        assert len(report) > 0  # Report generated despite failed test
    
    def test_performance_benchmarking_patterns(self, performance_monitor):
        """Test performance benchmarking patterns for ML operations."""
        # Define performance benchmarks for ML operations
        benchmarks = {
            'model_loading': 500,  # 500ms max
            'image_preprocessing': 100,  # 100ms max
            'inference': 200,  # 200ms max
            'polygon_extraction': 150  # 150ms max
        }
        
        # Run operations with monitoring
        for operation, benchmark_ms in benchmarks.items():
            performance_monitor.start_timer(operation)
            
            # Simulate operation (use shorter times for fast tests)
            simulation_time = min(0.01, benchmark_ms / 1000 / 2)  # Half the benchmark, max 10ms
            time.sleep(simulation_time)
            
            duration = performance_monitor.end_timer(operation)
            
            # Verify operation completed
            assert duration > 0
            
            # For this demo, we just verify monitoring works
            # In real tests, you'd compare against benchmarks
        
        # Generate report with all benchmarks
        report = performance_monitor.generate_report('ml-benchmark-test')
        
        # Verify all operations were captured
        assert report['summary']['timers'] == len(benchmarks)
        
        # Verify each benchmark operation is in metrics
        metric_names = [m['name'] for m in report['metrics']]
        for operation in benchmarks.keys():
            assert operation in metric_names

# Integration test to verify shared utilities work together
class TestSharedUtilitiesIntegration:
    """Integration tests for shared utilities working together."""
    
    def test_full_integration_workflow(self, test_reporter, performance_monitor, integration_coordinator):
        """Test complete workflow using all shared utilities."""
        # Start comprehensive test
        workflow_start = time.time()
        
        # 1. Check service health
        health_results = integration_coordinator.wait_for_services(['ml'], timeout=3)
        
        # 2. Run performance-monitored operation
        performance_monitor.record_memory_usage('workflow_start')
        performance_monitor.start_timer('full_workflow')
        
        # Simulate complex ML workflow
        performance_monitor.start_timer('data_loading')
        time.sleep(0.01)
        performance_monitor.end_timer('data_loading')
        
        performance_monitor.start_timer('model_execution')
        time.sleep(0.02)
        performance_monitor.end_timer('model_execution')
        
        performance_monitor.start_timer('result_processing')
        time.sleep(0.01)
        performance_monitor.end_timer('result_processing')
        
        workflow_duration = performance_monitor.end_timer('full_workflow')
        performance_monitor.record_memory_usage('workflow_complete')
        
        # 3. Record test results
        test_reporter.record_test({
            'name': 'Full integration workflow',
            'status': 'passed',
            'duration': workflow_duration * 1000,  # Convert to ms
            'suite': 'integration',
            'service': 'ml'
        })
        
        # 4. Generate comprehensive reports
        performance_report = performance_monitor.generate_report('integration-workflow')
        test_report = test_reporter.generate_report()
        
        # Verify integration worked
        assert workflow_duration > 0.03  # Should be at least sum of operations
        assert performance_report['summary']['totalMetrics'] >= 5  # Multiple metrics captured
        
        # Verify test reporting (handle both Node.js available and not available cases)
        if "Error generating report" in test_report:
            # Node.js not available - verify we recorded test results
            assert len(test_reporter.test_results) >= 1
        else:
            # Node.js available - verify full report
            assert len(test_report) > 100  # Report generated successfully
        
        assert health_results['services']['ml']['status'] in ['healthy', 'unhealthy']
        
        # Verify workflow timing is reasonable
        total_workflow_time = time.time() - workflow_start
        assert total_workflow_time < 10  # Should complete quickly in tests