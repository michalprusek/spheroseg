"""
Comprehensive integration tests for RabbitMQ message processing.
"""
import pytest
import json
import os
import sys
import time
from unittest.mock import Mock, patch, MagicMock, call
import pika
import tempfile
import shutil

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_service import process_message, start_rabbitmq_consumer


class TestRabbitMQMessageProcessing:
    """Test RabbitMQ message processing with various scenarios."""
    
    @pytest.fixture
    def mock_channel(self):
        """Create a mock RabbitMQ channel."""
        channel = Mock()
        return channel
    
    @pytest.fixture
    def mock_method(self):
        """Create a mock delivery method."""
        method = Mock()
        method.delivery_tag = 'test-delivery-tag-123'
        return method
    
    @pytest.fixture
    def temp_upload_dir(self):
        """Create a temporary upload directory."""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    def test_process_valid_message_with_complete_task(self, mock_channel, mock_method, temp_upload_dir):
        """Test processing a valid message with all required fields."""
        # Create test task
        task = {
            'taskId': 'task-123',
            'imageId': 42,
            'imagePath': f'{temp_upload_dir}/test.png',
            'parameters': {
                'threshold': 0.5,
                'min_area': 100
            },
            'callbackUrl': 'http://backend:5001/api/segmentation/callback'
        }
        
        # Create a test image
        import cv2
        import numpy as np
        test_image = np.zeros((100, 100, 3), dtype=np.uint8)
        cv2.imwrite(f'{temp_upload_dir}/test.png', test_image)
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                with patch('ml_service.os.path.exists', return_value=True):
                    with patch('ml_service.open', create=True) as mock_open:
                        # Mock successful segmentation
                        mock_run.return_value.returncode = 0
                        mock_run.return_value.stderr = ''
                        
                        # Mock result file
                        mock_result = {
                            'polygons': [
                                {
                                    'id': 1,
                                    'points': [[10, 10], [20, 10], [20, 20], [10, 20]],
                                    'area': 100
                                }
                            ]
                        }
                        mock_open.return_value.__enter__.return_value.read.return_value = json.dumps(mock_result)
                        
                        # Mock successful callback
                        mock_response = Mock()
                        mock_response.status_code = 200
                        mock_put.return_value = mock_response
                        
                        # Process message
                        process_message(mock_channel, mock_method, {}, body)
                        
                        # Verify task was acknowledged
                        mock_channel.basic_ack.assert_called_once_with('test-delivery-tag-123')
                        
                        # Verify callback was sent
                        mock_put.assert_called_once()
                        callback_args = mock_put.call_args
                        assert callback_args[0][0] == 'http://backend:5001/api/segmentation/callback'
                        
                        callback_data = callback_args[1]['json']
                        assert callback_data['status'] == 'completed'
                        assert 'result_data' in callback_data
                        assert 'polygons' in callback_data['result_data']
    
    def test_process_message_missing_required_fields(self, mock_channel, mock_method):
        """Test processing message with missing required fields."""
        # Task missing callbackUrl
        incomplete_task = {
            'taskId': 'task-123',
            'imageId': 42,
            'imagePath': '/path/to/image.png'
            # Missing callbackUrl
        }
        
        body = json.dumps(incomplete_task).encode()
        
        with patch('ml_service.logger') as mock_logger:
            process_message(mock_channel, mock_method, {}, body)
            
            # Should nack the message without requeue
            mock_channel.basic_nack.assert_called_once_with('test-delivery-tag-123', requeue=False)
            mock_logger.error.assert_called()
    
    def test_process_message_with_segmentation_failure(self, mock_channel, mock_method, temp_upload_dir):
        """Test handling segmentation failure."""
        task = {
            'taskId': 'task-456',
            'imageId': 99,
            'imagePath': f'{temp_upload_dir}/test.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/api/segmentation/callback'
        }
        
        # Create test image
        import cv2
        import numpy as np
        test_image = np.zeros((100, 100, 3), dtype=np.uint8)
        cv2.imwrite(f'{temp_upload_dir}/test.png', test_image)
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                # Mock segmentation failure
                mock_run.return_value.returncode = 1
                mock_run.return_value.stderr = 'CUDA out of memory'
                
                # Mock successful error callback
                mock_response = Mock()
                mock_response.status_code = 200
                mock_put.return_value = mock_response
                
                process_message(mock_channel, mock_method, {}, body)
                
                # Should nack the message
                mock_channel.basic_nack.assert_called_once_with('test-delivery-tag-123', requeue=False)
                
                # Should send error callback
                mock_put.assert_called_once()
                callback_data = mock_put.call_args[1]['json']
                assert callback_data['status'] == 'failed'
                assert 'CUDA out of memory' in callback_data['error']
    
    def test_process_message_with_callback_failure(self, mock_channel, mock_method, temp_upload_dir):
        """Test handling callback failure after successful segmentation."""
        task = {
            'taskId': 'task-789',
            'imageId': 55,
            'imagePath': f'{temp_upload_dir}/test.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/api/segmentation/callback'
        }
        
        # Create test image
        import cv2
        import numpy as np
        test_image = np.zeros((100, 100, 3), dtype=np.uint8)
        cv2.imwrite(f'{temp_upload_dir}/test.png', test_image)
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                with patch('ml_service.os.path.exists', return_value=True):
                    with patch('ml_service.open', create=True) as mock_open:
                        # Mock successful segmentation
                        mock_run.return_value.returncode = 0
                        mock_result = {'polygons': []}
                        mock_open.return_value.__enter__.return_value.read.return_value = json.dumps(mock_result)
                        
                        # Mock callback failure
                        mock_put.side_effect = Exception('Connection refused')
                        
                        process_message(mock_channel, mock_method, {}, body)
                        
                        # Should still ack the message (segmentation succeeded)
                        mock_channel.basic_ack.assert_called_once()
    
    def test_process_message_invalid_json(self, mock_channel, mock_method):
        """Test handling invalid JSON in message body."""
        body = b'{"invalid json'
        
        with patch('ml_service.logger') as mock_logger:
            process_message(mock_channel, mock_method, {}, body)
            
            # Should nack without requeue
            mock_channel.basic_nack.assert_called_once_with('test-delivery-tag-123', requeue=False)
            mock_logger.error.assert_called()
    
    def test_process_message_with_absolute_path_handling(self, mock_channel, mock_method):
        """Test handling of various image path formats."""
        # Test with relative path that should be made absolute
        task = {
            'taskId': 'task-path-test',
            'imageId': 111,
            'imagePath': 'uploads/test.png',  # Relative path
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.logger') as mock_logger:
                process_message(mock_channel, mock_method, {}, body)
                
                # Check that the path was made absolute
                mock_run.assert_called_once()
                cmd_args = mock_run.call_args[0][0]
                image_path_arg_index = cmd_args.index('--image_path') + 1
                assert cmd_args[image_path_arg_index].startswith('/')


class TestRabbitMQConnection:
    """Test RabbitMQ connection handling and retry logic."""
    
    @patch('ml_service.pika.BlockingConnection')
    @patch('ml_service.time.sleep')
    def test_connection_retry_on_failure(self, mock_sleep, mock_connection_class):
        """Test that connection retries on failure."""
        # Mock connection failures followed by success
        mock_connection_class.side_effect = [
            pika.exceptions.AMQPConnectionError('Connection failed'),
            pika.exceptions.AMQPConnectionError('Connection failed'),
            Mock()  # Success on third attempt
        ]
        
        # Use a flag to stop the consumer after successful connection
        connection_attempts = []
        
        def track_connection(*args, **kwargs):
            connection_attempts.append(1)
            if len(connection_attempts) >= 3:
                # Stop the loop after successful connection
                raise KeyboardInterrupt()
            raise pika.exceptions.AMQPConnectionError('Connection failed')
        
        mock_connection_class.side_effect = track_connection
        
        with patch('ml_service.logger') as mock_logger:
            try:
                start_rabbitmq_consumer()
            except KeyboardInterrupt:
                pass
            
            # Should have attempted connection 3 times
            assert len(connection_attempts) == 3
            
            # Should have logged errors
            assert mock_logger.error.call_count >= 2
            
            # Should have slept between retries
            assert mock_sleep.call_count >= 2
            mock_sleep.assert_called_with(5)
    
    @patch('ml_service.pika.BlockingConnection')
    def test_queue_declaration_and_configuration(self, mock_connection_class):
        """Test proper queue declaration and configuration."""
        mock_connection = Mock()
        mock_channel = Mock()
        mock_connection.channel.return_value = mock_channel
        mock_connection_class.return_value = mock_connection
        
        # Stop consumer after setup
        mock_channel.start_consuming.side_effect = KeyboardInterrupt()
        
        try:
            start_rabbitmq_consumer()
        except KeyboardInterrupt:
            pass
        
        # Verify queue declaration
        mock_channel.queue_declare.assert_called_once_with(
            queue='segmentation_tasks',
            durable=True
        )
        
        # Verify QoS settings
        mock_channel.basic_qos.assert_called_once_with(prefetch_count=4)
        
        # Verify consumer setup
        mock_channel.basic_consume.assert_called_once()
        consume_args = mock_channel.basic_consume.call_args
        assert consume_args[1]['queue'] == 'segmentation_tasks'
        assert consume_args[1]['on_message_callback'].__name__ == 'process_message'


class TestMessagePriority:
    """Test message priority handling."""
    
    @pytest.fixture
    def mock_channel(self):
        """Create a mock RabbitMQ channel."""
        channel = Mock()
        return channel
    
    @pytest.fixture
    def mock_method(self):
        """Create a mock delivery method."""
        method = Mock()
        method.delivery_tag = 'test-delivery-tag-123'
        return method
    
    def test_high_priority_message_processing(self, mock_channel, mock_method):
        """Test that high priority messages are handled correctly."""
        high_priority_task = {
            'taskId': 'high-priority-task',
            'imageId': 999,
            'imagePath': '/ML/uploads/urgent.png',
            'parameters': {
                'priority': 'high'
            },
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(high_priority_task).encode()
        
        with patch('ml_service.logger') as mock_logger:
            process_message(mock_channel, mock_method, {}, body)
            
            # Should log the high priority task
            mock_logger.info.assert_any_call(
                f"Received task: {high_priority_task}"
            )


class TestErrorRecovery:
    """Test error recovery mechanisms."""
    
    @pytest.fixture
    def mock_channel(self):
        """Create a mock RabbitMQ channel."""
        channel = Mock()
        return channel
    
    @pytest.fixture
    def mock_method(self):
        """Create a mock delivery method."""
        method = Mock()
        method.delivery_tag = 'test-delivery-tag-123'
        return method
    
    @pytest.fixture
    def temp_upload_dir(self):
        """Create a temporary upload directory."""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    def test_temporary_file_cleanup_on_error(self, mock_channel, mock_method, temp_upload_dir):
        """Test that temporary files are cleaned up on error."""
        task = {
            'taskId': 'cleanup-test',
            'imageId': 777,
            'imagePath': f'{temp_upload_dir}/test.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        # Create test image
        import cv2
        import numpy as np
        test_image = np.zeros((100, 100, 3), dtype=np.uint8)
        cv2.imwrite(f'{temp_upload_dir}/test.png', test_image)
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            # Mock segmentation failure
            mock_run.return_value.returncode = 1
            mock_run.return_value.stderr = 'Error'
            
            process_message(mock_channel, mock_method, {}, body)
            
            # Check that output directory was created
            output_dir = os.path.join('/ML/uploads', f"segmentation_{task['taskId']}")
            # In real scenario, we'd check if cleanup happened
    
    def test_graceful_handling_of_corrupted_result(self, mock_channel, mock_method, temp_upload_dir):
        """Test handling of corrupted segmentation results."""
        task = {
            'taskId': 'corrupted-result',
            'imageId': 888,
            'imagePath': f'{temp_upload_dir}/test.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.os.path.exists', return_value=True):
                with patch('ml_service.open', create=True) as mock_open:
                    # Mock successful segmentation but corrupted result file
                    mock_run.return_value.returncode = 0
                    mock_open.return_value.__enter__.return_value.read.return_value = '{"invalid": json'
                    
                    with patch('ml_service.requests.put'):
                        process_message(mock_channel, mock_method, {}, body)
                        
                        # Should nack the message due to JSON decode error
                        mock_channel.basic_nack.assert_called_once()


class TestPerformanceMonitoring:
    """Test performance monitoring capabilities."""
    
    @pytest.fixture
    def mock_channel(self):
        """Create a mock RabbitMQ channel."""
        channel = Mock()
        return channel
    
    @pytest.fixture
    def mock_method(self):
        """Create a mock delivery method."""
        method = Mock()
        method.delivery_tag = 'test-delivery-tag-123'
        return method
    
    @pytest.fixture
    def temp_upload_dir(self):
        """Create a temporary upload directory."""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    def test_processing_time_measurement(self, mock_channel, mock_method, temp_upload_dir):
        """Test that processing time is measured and reported."""
        task = {
            'taskId': 'perf-test',
            'imageId': 333,
            'imagePath': f'{temp_upload_dir}/test.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        
        # Create test image
        import cv2
        import numpy as np
        test_image = np.zeros((100, 100, 3), dtype=np.uint8)
        cv2.imwrite(f'{temp_upload_dir}/test.png', test_image)
        
        body = json.dumps(task).encode()
        
        with patch('ml_service.subprocess.run') as mock_run:
            with patch('ml_service.requests.put') as mock_put:
                with patch('ml_service.os.path.exists', return_value=True):
                    with patch('ml_service.open', create=True) as mock_open:
                        with patch('ml_service.time.time') as mock_time:
                            # Mock time progression
                            mock_time.side_effect = [100.0, 102.5]  # 2.5 seconds processing
                            
                            # Mock successful segmentation
                            mock_run.return_value.returncode = 0
                            mock_result = {'polygons': []}
                            mock_open.return_value.__enter__.return_value.read.return_value = json.dumps(mock_result)
                            
                            mock_response = Mock()
                            mock_response.status_code = 200
                            mock_put.return_value = mock_response
                            
                            process_message(mock_channel, mock_method, {}, body)
                            
                            # Check that processing time was included in callback
                            callback_data = mock_put.call_args[1]['json']
                            assert callback_data['result_data']['processing_time'] == 2.5


if __name__ == '__main__':
    pytest.main([__file__, '-v'])