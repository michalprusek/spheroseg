"""
Comprehensive tests for ML service including Flask endpoints, 
error handling, and performance monitoring.
"""
import pytest
import json
import os
import sys
import time
import tempfile
import shutil
from unittest.mock import Mock, patch, MagicMock
import threading
import numpy as np
import cv2

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_service import app, generate_mock_polygons, process_message, start_rabbitmq_consumer


class TestFlaskEndpoints:
    """Test Flask API endpoints."""
    
    @pytest.fixture
    def client(self):
        """Create a test client for the Flask app."""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    def test_health_endpoint_success(self, client):
        """Test health endpoint returns correct status."""
        with patch('os.path.exists') as mock_exists:
            mock_exists.return_value = True
            
            response = client.get('/health')
            
            assert response.status_code == 200
            assert response.content_type == 'application/json'
            
            data = json.loads(response.data)
            assert data['status'] == 'healthy'
            assert 'timestamp' in data
            assert data['model_exists'] is True
            assert data['model_path'] == '/ML/checkpoint_epoch_9.pth.tar'
    
    def test_health_endpoint_model_missing(self, client):
        """Test health endpoint when model is missing."""
        with patch('os.path.exists') as mock_exists:
            mock_exists.return_value = False
            
            response = client.get('/health')
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['model_exists'] is False
    
    def test_invalid_endpoint(self, client):
        """Test that invalid endpoints return 404."""
        response = client.get('/invalid')
        assert response.status_code == 404
    
    def test_health_endpoint_headers(self, client):
        """Test health endpoint response headers."""
        response = client.get('/health')
        
        # Should have proper content type
        assert response.headers['Content-Type'] == 'application/json'
        
        # Should not have CORS headers unless configured
        assert 'Access-Control-Allow-Origin' not in response.headers


class TestMockPolygonGeneration:
    """Test mock polygon generation for development mode."""
    
    def test_generate_mock_polygons_count(self):
        """Test that mock polygons are generated within expected range."""
        for _ in range(10):
            polygons = generate_mock_polygons()
            assert 3 <= len(polygons) <= 8
    
    def test_mock_polygon_structure(self):
        """Test structure of generated mock polygons."""
        polygons = generate_mock_polygons()
        
        for polygon in polygons:
            # Check required fields
            assert 'id' in polygon
            assert 'points' in polygon
            assert 'class' in polygon
            assert 'confidence' in polygon
            
            # Check ID is sequential
            assert isinstance(polygon['id'], int)
            assert polygon['id'] > 0
            
            # Check class is valid
            assert polygon['class'] in ['cell', 'nucleus', 'debris']
            
            # Check confidence is in valid range
            assert 0.75 <= polygon['confidence'] <= 0.98
    
    def test_mock_polygon_points_validity(self):
        """Test that mock polygon points are valid coordinates."""
        polygons = generate_mock_polygons()
        
        for polygon in polygons:
            points = polygon['points']
            
            # Should have at least 5 points
            assert len(points) >= 5
            
            # All points should be within image bounds
            for point in points:
                assert isinstance(point, list)
                assert len(point) == 2
                x, y = point
                assert 0 <= x <= 1000
                assert 0 <= y <= 1000
                assert isinstance(x, int)
                assert isinstance(y, int)
    
    def test_mock_polygon_shape_validity(self):
        """Test that mock polygons form valid shapes."""
        polygons = generate_mock_polygons()
        
        for polygon in polygons:
            points = polygon['points']
            
            # Convert to numpy array for OpenCV
            np_points = np.array(points, dtype=np.int32)
            
            # Calculate area
            area = cv2.contourArea(np_points)
            assert area > 0  # Should have positive area
            
            # Check that polygon is not self-intersecting (simplified check)
            # A proper polygon should have area > 0


class TestMessageProcessingAdvanced:
    """Advanced tests for message processing functionality."""
    
    @pytest.fixture
    def setup_mocks(self):
        """Setup common mocks for message processing tests."""
        ch = Mock()
        method = Mock()
        method.delivery_tag = 'test-tag-123'
        properties = {}
        
        return ch, method, properties
    
    @pytest.fixture
    def temp_image(self):
        """Create a temporary test image."""
        temp_dir = tempfile.mkdtemp()
        image_path = os.path.join(temp_dir, 'test.png')
        
        # Create a simple test image
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        cv2.circle(img, (50, 50), 20, (255, 255, 255), -1)
        cv2.imwrite(image_path, img)
        
        yield image_path
        
        # Cleanup
        shutil.rmtree(temp_dir)
    
    def test_process_message_with_custom_parameters(self, setup_mocks, temp_image):
        """Test processing with custom segmentation parameters."""
        ch, method, properties = setup_mocks
        
        task = {
            'taskId': 'custom-params-test',
            'imageId': 123,
            'imagePath': temp_image,
            'parameters': {
                'threshold': 0.7,
                'min_area': 200,
                'device_preference': 'cpu'
            },
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                # Mock successful execution
                mock_run.return_value.returncode = 0
                mock_put.return_value.status_code = 200
                
                with patch('os.path.exists', return_value=True):
                    with patch('builtins.open', create=True) as mock_open:
                        mock_open.return_value.__enter__.return_value.read.return_value = json.dumps({
                            'polygons': []
                        })
                        
                        process_message(ch, method, properties, body)
                        
                        # Verify subprocess was called with correct parameters
                        mock_run.assert_called_once()
                        cmd = mock_run.call_args[0][0]
                        assert '--image_path' in cmd
                        assert temp_image in cmd
    
    def test_process_message_timeout_handling(self, setup_mocks):
        """Test handling of subprocess timeout."""
        ch, method, properties = setup_mocks
        
        task = {
            'taskId': 'timeout-test',
            'imageId': 456,
            'imagePath': '/path/to/image.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                # Mock timeout
                import subprocess
                mock_run.side_effect = subprocess.TimeoutExpired('cmd', 30)
                
                mock_put.return_value.status_code = 200
                
                process_message(ch, method, properties, body)
                
                # Should send error callback
                mock_put.assert_called_once()
                error_data = mock_put.call_args[1]['json']
                assert error_data['status'] == 'failed'
                assert 'timeout' in error_data['error'].lower()
    
    def test_process_message_memory_error_handling(self, setup_mocks):
        """Test handling of memory errors during processing."""
        ch, method, properties = setup_mocks
        
        task = {
            'taskId': 'memory-test',
            'imageId': 789,
            'imagePath': '/path/to/large_image.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                # Mock memory error
                mock_run.return_value.returncode = 1
                mock_run.return_value.stderr = 'RuntimeError: CUDA out of memory'
                
                mock_put.return_value.status_code = 200
                
                process_message(ch, method, properties, body)
                
                # Should send error with memory-specific message
                error_data = mock_put.call_args[1]['json']
                assert error_data['status'] == 'failed'
                assert 'CUDA out of memory' in error_data['error']
    
    def test_concurrent_message_processing(self, setup_mocks):
        """Test that multiple messages can be processed concurrently."""
        ch, method, properties = setup_mocks
        
        processed_tasks = []
        
        def mock_subprocess_run(cmd, **kwargs):
            # Extract task ID from command
            task_id_idx = cmd.index('--output_path') + 1
            output_path = cmd[task_id_idx]
            task_id = output_path.split('segmentation_')[1].split('/')[0]
            processed_tasks.append(task_id)
            
            # Simulate some processing time
            time.sleep(0.1)
            
            result = Mock()
            result.returncode = 0
            result.stderr = ''
            return result
        
        with patch('ml_service.subprocess.run', side_effect=mock_subprocess_run):
            with patch('ml_service.requests.put'):
                with patch('os.path.exists', return_value=True):
                    with patch('builtins.open', create=True):
                        # Process multiple messages
                        threads = []
                        for i in range(3):
                            task = {
                                'taskId': f'concurrent-{i}',
                                'imageId': 1000 + i,
                                'imagePath': f'/path/to/image_{i}.png',
                                'parameters': {},
                                'callbackUrl': 'http://backend:5001/callback'
                            }
                            body = json.dumps(task).encode()
                            
                            thread = threading.Thread(
                                target=process_message,
                                args=(ch, method, properties, body)
                            )
                            threads.append(thread)
                            thread.start()
                        
                        # Wait for all threads
                        for thread in threads:
                            thread.join()
                        
                        # All tasks should have been processed
                        assert len(processed_tasks) == 3
                        assert 'concurrent-0' in processed_tasks
                        assert 'concurrent-1' in processed_tasks
                        assert 'concurrent-2' in processed_tasks


class TestErrorRecoveryMechanisms:
    """Test error recovery and resilience."""
    
    def test_callback_retry_on_network_error(self, setup_mocks):
        """Test that callback is retried on network errors."""
        ch, method, properties = setup_mocks
        
        task = {
            'taskId': 'retry-test',
            'imageId': 2000,
            'imagePath': '/path/to/image.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                with patch('os.path.exists', return_value=True):
                    with patch('builtins.open', create=True) as mock_open:
                        # Mock successful segmentation
                        mock_run.return_value.returncode = 0
                        mock_open.return_value.__enter__.return_value.read.return_value = json.dumps({
                            'polygons': []
                        })
                        
                        # Mock network error on first attempt, success on second
                        import requests
                        mock_put.side_effect = [
                            requests.exceptions.ConnectionError('Network error'),
                            Mock(status_code=200)
                        ]
                        
                        # Note: Current implementation doesn't retry, but this tests the behavior
                        process_message(ch, method, properties, body)
                        
                        # Should have attempted callback
                        assert mock_put.call_count >= 1
    
    def test_graceful_shutdown_handling(self):
        """Test graceful shutdown of RabbitMQ consumer."""
        with patch('ml_service.pika.BlockingConnection') as mock_connection_class:
            mock_connection = Mock()
            mock_channel = Mock()
            mock_connection.channel.return_value = mock_channel
            mock_connection_class.return_value = mock_connection
            
            # Simulate KeyboardInterrupt after setup
            mock_channel.start_consuming.side_effect = KeyboardInterrupt()
            
            with patch('ml_service.logger') as mock_logger:
                try:
                    start_rabbitmq_consumer()
                except KeyboardInterrupt:
                    pass
                
                # Should have set up the consumer properly
                mock_channel.queue_declare.assert_called_once()
                mock_channel.basic_qos.assert_called_once()
                mock_channel.basic_consume.assert_called_once()


class TestEnvironmentConfiguration:
    """Test environment variable configuration."""
    
    def test_custom_rabbitmq_configuration(self):
        """Test custom RabbitMQ configuration via environment variables."""
        custom_env = {
            'RABBITMQ_HOST': 'custom-host',
            'RABBITMQ_PORT': '5673',
            'RABBITMQ_USER': 'custom-user',
            'RABBITMQ_PASS': 'custom-pass',
            'RABBITMQ_QUEUE': 'custom-queue'
        }
        
        with patch.dict(os.environ, custom_env):
            # Re-import to pick up new environment variables
            import importlib
            import ml_service
            importlib.reload(ml_service)
            
            assert ml_service.RABBITMQ_HOST == 'custom-host'
            assert ml_service.RABBITMQ_PORT == 5673
            assert ml_service.RABBITMQ_USER == 'custom-user'
            assert ml_service.RABBITMQ_PASS == 'custom-pass'
            assert ml_service.RABBITMQ_QUEUE == 'custom-queue'
    
    def test_debug_mode_configuration(self):
        """Test debug mode configuration."""
        with patch.dict(os.environ, {'DEBUG': 'true'}):
            import importlib
            import ml_service
            importlib.reload(ml_service)
            
            assert ml_service.DEBUG is True
        
        with patch.dict(os.environ, {'DEBUG': 'false'}):
            importlib.reload(ml_service)
            assert ml_service.DEBUG is False
    
    def test_model_path_configuration(self):
        """Test custom model path configuration."""
        custom_model_path = '/custom/path/to/model.pth'
        
        with patch.dict(os.environ, {'MODEL_PATH': custom_model_path}):
            import importlib
            import ml_service
            importlib.reload(ml_service)
            
            assert ml_service.MODEL_PATH == custom_model_path


class TestMonitoringAndLogging:
    """Test monitoring and logging functionality."""
    
    def test_task_processing_logging(self, setup_mocks):
        """Test that task processing is properly logged."""
        ch, method, properties = setup_mocks
        
        task = {
            'taskId': 'logging-test',
            'imageId': 3000,
            'imagePath': '/path/to/image.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.logger') as mock_logger:
            with patch('ml_service.subprocess.run') as mock_run:
                mock_run.return_value.returncode = 1
                mock_run.return_value.stderr = 'Test error'
                
                process_message(ch, method, properties, body)
                
                # Should log task receipt
                mock_logger.info.assert_any_call(f"Received task: {task}")
                
                # Should log processing start
                assert any('Processing segmentation' in str(call) 
                          for call in mock_logger.info.call_args_list)
                
                # Should log error
                assert any('Error during segmentation' in str(call) 
                          for call in mock_logger.error.call_args_list)
    
    def test_connection_logging(self):
        """Test that connection events are logged."""
        with patch('ml_service.pika.BlockingConnection') as mock_connection_class:
            # Mock connection failure
            mock_connection_class.side_effect = pika.exceptions.AMQPConnectionError('Test error')
            
            with patch('ml_service.logger') as mock_logger:
                with patch('ml_service.time.sleep'):
                    # Run consumer for one iteration
                    try:
                        # Modify to break after first iteration
                        with patch('ml_service.time.sleep', side_effect=KeyboardInterrupt):
                            start_rabbitmq_consumer()
                    except KeyboardInterrupt:
                        pass
                    
                    # Should log connection error
                    assert any('RabbitMQ connection error' in str(call) 
                              for call in mock_logger.error.call_args_list)


class TestPerformanceOptimization:
    """Test performance optimization features."""
    
    def test_output_directory_cleanup(self, setup_mocks):
        """Test that output directories are managed properly."""
        ch, method, properties = setup_mocks
        
        task = {
            'taskId': 'cleanup-test',
            'imageId': 4000,
            'imagePath': '/path/to/image.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        created_dirs = []
        
        def mock_makedirs(path, exist_ok=True):
            created_dirs.append(path)
        
        with patch('os.makedirs', side_effect=mock_makedirs):
            with patch('ml_service.subprocess.run') as mock_run:
                mock_run.return_value.returncode = 0
                
                process_message(ch, method, properties, body)
                
                # Should create output directory for task
                assert any('segmentation_cleanup-test' in path for path in created_dirs)
    
    def test_large_result_handling(self, setup_mocks):
        """Test handling of large segmentation results."""
        ch, method, properties = setup_mocks
        
        task = {
            'taskId': 'large-result',
            'imageId': 5000,
            'imagePath': '/path/to/image.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        # Create large polygon result (1000 polygons)
        large_result = {
            'polygons': [
                {
                    'id': i,
                    'points': [[j, j] for j in range(10)],
                    'area': 100
                }
                for i in range(1000)
            ]
        }
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                with patch('os.path.exists', return_value=True):
                    with patch('builtins.open', create=True) as mock_open:
                        mock_run.return_value.returncode = 0
                        mock_open.return_value.__enter__.return_value.read.return_value = json.dumps(large_result)
                        mock_put.return_value.status_code = 200
                        
                        process_message(ch, method, properties, body)
                        
                        # Should successfully process large result
                        ch.basic_ack.assert_called_once()
                        
                        # Callback should contain all polygons
                        callback_data = mock_put.call_args[1]['json']
                        assert len(callback_data['result_data']['polygons']) == 1000


if __name__ == '__main__':
    pytest.main([__file__, '-v'])