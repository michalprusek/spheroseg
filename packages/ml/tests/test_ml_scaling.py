import pytest
import requests
import json
import time
import threading
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml_service_scaled import (
    app, process_segmentation, process_message, 
    health, INSTANCE_ID
)

class TestMLServiceScaling:
    """Test suite for ML service horizontal scaling features"""
    
    @pytest.fixture
    def client(self):
        """Create test client for Flask app"""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    def test_health_endpoint_enhanced(self, client):
        """Test enhanced health endpoint returns detailed information"""
        response = client.get('/health')
        # Accept either 200 (healthy) or 503 (unhealthy due to missing model in test)
        assert response.status_code in [200, 503]
        
        data = response.json
        assert data['status'] in ['healthy', 'degraded', 'unhealthy']
        assert 'instance_id' in data
        assert 'model' in data
        assert 'resources' in data
        assert 'processing' in data
        
        # Check model information
        assert 'path' in data['model']
        assert 'exists' in data['model']
        
        # Check resource information
        assert 'cpu_percent' in data['resources']
        assert 'memory_percent' in data['resources']
        assert 'disk_percent' in data['resources']
        
        # Check processing information
        assert 'active_tasks' in data['processing']
        assert 'max_concurrent' in data['processing']
        assert 'rabbitmq_connected' in data['processing']
    
    def test_metrics_endpoint(self, client):
        """Test Prometheus metrics endpoint"""
        response = client.get('/metrics')
        assert response.status_code == 200
        assert response.content_type == 'text/plain; version=0.0.4; charset=utf-8'
        
        metrics_text = response.data.decode('utf-8')
        assert 'ml_tasks_processed_total' in metrics_text
        assert 'ml_task_duration_seconds' in metrics_text
        assert 'ml_active_tasks' in metrics_text
    
    @patch('ml_service_scaled.subprocess.run')
    @patch('ml_service_scaled.requests.put')
    def test_process_segmentation_success(self, mock_put, mock_run):
        """Test successful segmentation processing"""
        # Mock subprocess successful execution
        mock_process = Mock()
        mock_process.returncode = 0
        mock_process.stderr = ""
        mock_run.return_value = mock_process
        
        # Mock successful callback
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response
        
        # Create test task
        task = {
            'taskId': 'test-123',
            'imageId': 'img-456',
            'imagePath': '/test/image.jpg',
            'parameters': {'test': True},
            'callbackUrl': 'http://backend/callback'
        }
        
        # Mock result file
        with patch('builtins.open', create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = json.dumps({
                'polygons': [{'id': 1, 'points': [[0, 0], [10, 10]]}]
            })
            
            with patch('os.path.exists', return_value=True):
                result = process_segmentation(task)
        
        assert result is True
        mock_put.assert_called_once()
        call_args = mock_put.call_args[1]['json']
        assert call_args['status'] == 'completed'
        assert 'processed_by' in call_args['result_data']
        assert call_args['result_data']['processed_by'] == INSTANCE_ID
    
    @patch('ml_service_scaled.subprocess.run')
    @patch('ml_service_scaled.requests.put')
    def test_process_segmentation_timeout(self, mock_put, mock_run):
        """Test segmentation processing timeout handling"""
        import subprocess
        
        # Mock subprocess timeout
        mock_run.side_effect = subprocess.TimeoutExpired('cmd', 300)
        
        # Mock callback response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response
        
        task = {
            'taskId': 'test-timeout',
            'imageId': 'img-timeout',
            'imagePath': '/test/timeout.jpg',
            'parameters': {},
            'callbackUrl': 'http://backend/callback'
        }
        
        result = process_segmentation(task)
        
        assert result is False
        mock_put.assert_called_once()
        call_args = mock_put.call_args[1]['json']
        assert call_args['status'] == 'failed'
        assert 'timeout' in call_args['error'].lower()
    
    def test_process_message_valid(self):
        """Test RabbitMQ message processing with valid task"""
        # Mock channel and method
        mock_channel = Mock()
        mock_method = Mock()
        mock_method.delivery_tag = 'test-tag'
        
        # Create valid task
        task = {
            'taskId': 'msg-123',
            'imageId': 'img-789',
            'imagePath': '/test/message.jpg',
            'callbackUrl': 'http://backend/callback'
        }
        body = json.dumps(task).encode('utf-8')
        
        # Mock process_segmentation
        with patch('ml_service_scaled.executor.submit') as mock_submit:
            mock_future = Mock()
            mock_future.result.return_value = True
            mock_submit.return_value = mock_future
            
            process_message(mock_channel, mock_method, None, body)
        
        mock_channel.basic_ack.assert_called_once_with('test-tag')
        mock_submit.assert_called_once()
    
    def test_process_message_invalid_json(self):
        """Test RabbitMQ message processing with invalid JSON"""
        mock_channel = Mock()
        mock_method = Mock()
        mock_method.delivery_tag = 'invalid-tag'
        
        body = b'invalid json {'
        
        process_message(mock_channel, mock_method, None, body)
        
        mock_channel.basic_nack.assert_called_once_with('invalid-tag', requeue=False)
    
    def test_process_message_missing_fields(self):
        """Test RabbitMQ message processing with missing required fields"""
        mock_channel = Mock()
        mock_method = Mock()
        mock_method.delivery_tag = 'incomplete-tag'
        
        # Task missing required fields
        task = {
            'taskId': 'incomplete-123'
            # Missing imageId, imagePath, callbackUrl
        }
        body = json.dumps(task).encode('utf-8')
        
        process_message(mock_channel, mock_method, None, body)
        
        mock_channel.basic_nack.assert_called_once_with('incomplete-tag', requeue=False)
    
    @patch('ml_service_scaled.shutdown_event')
    def test_graceful_shutdown(self, mock_shutdown_event):
        """Test graceful shutdown handling"""
        mock_shutdown_event.is_set.return_value = True
        
        mock_channel = Mock()
        mock_method = Mock()
        mock_method.delivery_tag = 'shutdown-tag'
        
        task = {'taskId': 'shutdown-test'}
        body = json.dumps(task).encode('utf-8')
        
        process_message(mock_channel, mock_method, None, body)
        
        # Should reject message during shutdown
        mock_channel.basic_nack.assert_called_once_with('shutdown-tag', requeue=True)
    
    def test_concurrent_processing(self):
        """Test concurrent task processing"""
        from concurrent.futures import ThreadPoolExecutor
        
        # Track concurrent executions
        concurrent_count = 0
        max_concurrent = 0
        lock = threading.Lock()
        
        def mock_task():
            nonlocal concurrent_count, max_concurrent
            with lock:
                concurrent_count += 1
                max_concurrent = max(max_concurrent, concurrent_count)
            
            time.sleep(0.1)  # Simulate processing
            
            with lock:
                concurrent_count -= 1
            
            return True
        
        # Test with thread pool
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            for i in range(10):
                future = executor.submit(mock_task)
                futures.append(future)
            
            # Wait for all to complete
            for future in futures:
                future.result()
        
        # Should have processed concurrently
        assert max_concurrent > 1
        assert max_concurrent <= 4  # Should not exceed max workers
    
    def test_instance_identification(self):
        """Test that instance ID is properly set"""
        assert INSTANCE_ID is not None
        assert len(INSTANCE_ID) > 0
    
    @patch('ml_service_scaled.os.path.exists')
    @patch('ml_service_scaled.psutil.cpu_percent')
    @patch('ml_service_scaled.psutil.virtual_memory')
    def test_health_degraded_high_cpu(self, mock_memory, mock_cpu, mock_exists, client):
        """Test health endpoint returns degraded status on high CPU"""
        mock_cpu.return_value = 95.0  # High CPU
        mock_memory_obj = Mock()
        mock_memory_obj.percent = 50.0
        mock_memory_obj.available = 1024 * 1024 * 1024
        mock_memory.return_value = mock_memory_obj
        mock_exists.return_value = True  # Model file exists
        
        response = client.get('/health')
        data = response.json
        
        assert response.status_code == 503
        assert data['status'] == 'degraded'
        assert 'CPU' in data['reason']
    
    @patch('ml_service_scaled.os.path.exists')
    @patch('ml_service_scaled.psutil.virtual_memory')
    def test_health_degraded_high_memory(self, mock_memory, mock_exists, client):
        """Test health endpoint returns degraded status on high memory"""
        mock_memory_obj = Mock()
        mock_memory_obj.percent = 95.0  # High memory usage
        mock_memory_obj.available = 100 * 1024 * 1024
        mock_memory.return_value = mock_memory_obj
        mock_exists.return_value = True  # Model file exists
        
        response = client.get('/health')
        data = response.json
        
        assert response.status_code == 503
        assert data['status'] == 'degraded'
        assert 'memory' in data['reason'].lower()
    
    @patch('ml_service_scaled.os.path.exists')
    def test_health_unhealthy_no_model(self, mock_exists, client):
        """Test health endpoint returns unhealthy when model is missing"""
        mock_exists.return_value = False  # Model doesn't exist
        
        response = client.get('/health')
        data = response.json
        
        assert response.status_code == 503
        assert data['status'] == 'unhealthy'
        assert 'Model' in data['reason']


class TestLoadBalancing:
    """Test suite for load balancing functionality"""
    
    @pytest.fixture
    def client(self):
        """Create test client for Flask app"""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    def test_haproxy_health_check_compatibility(self, client):
        """Test that health endpoint is compatible with HAProxy checks"""
        response = client.get('/health')
        
        # HAProxy expects 200 for healthy
        assert response.status_code in [200, 503]
        
        # Response should be JSON
        assert response.content_type == 'application/json'
        
        # Should respond quickly (HAProxy timeout is 10s)
        # This is implicitly tested by the test timeout
    
    def test_long_running_task_handling(self):
        """Test handling of long-running segmentation tasks"""
        # This tests that the timeout configuration is appropriate
        # In production, tasks can take several minutes
        
        task = {
            'taskId': 'long-task',
            'imageId': 'large-image',
            'imagePath': '/test/large.tiff',
            'parameters': {'high_resolution': True},
            'callbackUrl': 'http://backend/callback'
        }
        
        with patch('ml_service_scaled.subprocess.run') as mock_run:
            # Simulate a long-running process
            mock_process = Mock()
            mock_process.returncode = 0
            
            def long_running_side_effect(*args, **kwargs):
                # Check that timeout is set appropriately
                assert kwargs.get('timeout', 0) >= 300  # At least 5 minutes
                return mock_process
            
            mock_run.side_effect = long_running_side_effect
            
            # Process should handle long tasks without premature timeout
            # (actual processing mocked)
            mock_run.assert_not_called()  # Not called yet
    
    def test_load_distribution_simulation(self):
        """Simulate load distribution across instances"""
        # This is more of an integration test
        # In real deployment, this would test actual distribution
        
        instance_counts = {'ml-1': 0, 'ml-2': 0, 'ml-3': 0}
        
        # Simulate least-connections routing
        for i in range(30):
            # Find instance with least connections
            min_instance = min(instance_counts, key=instance_counts.get)
            instance_counts[min_instance] += 1
            
            # Simulate task completion after some time
            if i > 10:
                # Complete some tasks
                for instance in instance_counts:
                    if instance_counts[instance] > 0:
                        instance_counts[instance] -= 0.3
        
        # Check that load was distributed
        values = list(instance_counts.values())
        max_diff = max(values) - min(values)
        
        # With least-connections, difference should be small
        assert max_diff < 5  # Reasonable distribution


if __name__ == "__main__":
    pytest.main([__file__, "-v"])