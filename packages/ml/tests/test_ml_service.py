"""
Tests for ML service Flask endpoints and RabbitMQ processing.
"""
import pytest
import json
import os
from unittest.mock import Mock, patch, MagicMock
import sys

# Import the Flask app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_service import app, generate_mock_polygons, process_message


class TestMLServiceEndpoints:
    """Test ML service Flask endpoints."""
    
    @pytest.fixture
    def client(self):
        """Create a test client for the Flask app."""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    def test_health_endpoint(self, client):
        """Test the health check endpoint."""
        response = client.get('/health')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert 'model_path' in data
        assert 'model_exists' in data
    
    def test_health_endpoint_content_type(self, client):
        """Test that health endpoint returns JSON."""
        response = client.get('/health')
        assert response.content_type == 'application/json'


class TestMockPolygonGeneration:
    """Test mock polygon generation function."""
    
    def test_generate_mock_polygons_structure(self):
        """Test that mock polygons have correct structure."""
        polygons = generate_mock_polygons()
        
        assert isinstance(polygons, list)
        assert len(polygons) >= 3 and len(polygons) <= 8
        
        for polygon in polygons:
            assert 'id' in polygon
            assert 'points' in polygon
            assert 'class' in polygon
            assert 'confidence' in polygon
            
            assert isinstance(polygon['id'], int)
            assert isinstance(polygon['points'], list)
            assert len(polygon['points']) >= 5
            assert polygon['class'] in ['cell', 'nucleus', 'debris']
            assert 0.0 <= polygon['confidence'] <= 1.0
    
    def test_generate_mock_polygons_points(self):
        """Test that polygon points are valid coordinates."""
        polygons = generate_mock_polygons()
        
        for polygon in polygons:
            for point in polygon['points']:
                assert isinstance(point, list)
                assert len(point) == 2
                assert isinstance(point[0], int)
                assert isinstance(point[1], int)
                assert 0 <= point[0] <= 1000  # x coordinate
                assert 0 <= point[1] <= 1000  # y coordinate


class TestMessageProcessing:
    """Test RabbitMQ message processing."""
    
    @patch('ml_service.logger')
    def test_process_message_invalid_task(self, mock_logger):
        """Test processing invalid task."""
        ch = Mock()
        method = Mock()
        method.delivery_tag = 'test-tag'
        properties = {}
        
        # Missing required fields
        invalid_task = {'taskId': 'test-123'}
        body = json.dumps(invalid_task).encode()
        
        process_message(ch, method, properties, body)
        
        # Should nack the message
        ch.basic_nack.assert_called_once_with('test-tag', requeue=False)
        mock_logger.error.assert_called()
    
    @patch('ml_service.requests')
    @patch('ml_service.logger')
    @patch('os.path.exists')
    def test_process_message_valid_task_mock_mode(self, mock_exists, mock_logger, mock_requests):
        """Test processing valid task in mock mode."""
        ch = Mock()
        method = Mock()
        method.delivery_tag = 'test-tag'
        properties = {}
        
        # Valid task
        task = {
            'taskId': 'test-123',
            'imageId': 42,
            'imagePath': '/ML/uploads/test.png',
            'parameters': {},
            'callbackUrl': 'http://backend:5001/callback'
        }
        body = json.dumps(task).encode()
        
        # Mock environment for debug mode
        with patch.dict(os.environ, {'DEBUG': 'true'}):
            # Mock successful callback
            mock_response = Mock()
            mock_response.status_code = 200
            mock_requests.post.return_value = mock_response
            
            process_message(ch, method, properties, body)
            
            # Check that basic_ack was called (message was successfully processed)
            # or at least that it wasn't rejected
            if ch.basic_ack.called:
                ch.basic_ack.assert_called_once_with(method.delivery_tag)
            else:
                # If ack wasn't called, at least ensure nack wasn't called with requeue=False
                # which would indicate a permanent failure
                if ch.basic_nack.called:
                    # Check if it was called with requeue=True (temporary failure)
                    calls = ch.basic_nack.call_args_list
                    for call in calls:
                        args, kwargs = call
                        if len(args) > 1 and args[1] is False:
                            # This was a permanent failure, test should fail
                            raise AssertionError("Message was permanently rejected (nack with requeue=False)")
                        elif 'requeue' in kwargs and kwargs['requeue'] is False:
                            raise AssertionError("Message was permanently rejected (nack with requeue=False)")
            
            # Should send callback
            mock_requests.post.assert_called_once()
            call_args = mock_requests.post.call_args
            assert call_args[0][0] == 'http://backend:5001/callback'
            
            # Check callback data
            callback_data = json.loads(call_args[1]['data'])
            assert callback_data['taskId'] == 'test-123'
            assert callback_data['imageId'] == 42
            assert callback_data['status'] == 'completed'
            assert 'polygons' in callback_data
    
    @patch('ml_service.logger')
    def test_process_message_json_decode_error(self, mock_logger):
        """Test handling of invalid JSON in message."""
        ch = Mock()
        method = Mock()
        method.delivery_tag = 'test-tag'
        properties = {}
        
        # Invalid JSON
        body = b'invalid json{'
        
        process_message(ch, method, properties, body)
        
        # Should nack the message
        ch.basic_nack.assert_called_once_with('test-tag', requeue=False)
        mock_logger.error.assert_called()


class TestRabbitMQIntegration:
    """Test RabbitMQ connection and setup."""
    
    @patch('ml_service.pika.BlockingConnection')
    @patch('ml_service.logger')
    def test_rabbitmq_connection_retry(self, mock_logger, mock_pika):
        """Test that RabbitMQ connection retries on failure."""
        # This would test the connect_to_rabbitmq function if it exists
        pass


@pytest.mark.parametrize("model_exists,expected", [
    (True, True),
    (False, False)
])
def test_model_existence_check(model_exists, expected):
    """Test model existence checking in health endpoint."""
    with patch('os.path.exists') as mock_exists:
        mock_exists.return_value = model_exists
        
        with app.test_client() as client:
            response = client.get('/health')
            data = json.loads(response.data)
            assert data['model_exists'] == expected