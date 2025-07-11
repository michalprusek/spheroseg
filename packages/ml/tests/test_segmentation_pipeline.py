"""
Tests for the complete segmentation pipeline.
"""
import pytest
import numpy as np
import torch
import cv2
import json
import os
import sys
from unittest.mock import Mock, patch, MagicMock
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class TestSegmentationPipeline:
    """Test the complete segmentation pipeline."""
    
    @pytest.fixture
    def mock_model(self):
        """Create a mock model that returns a binary mask."""
        model = Mock()
        
        def mock_forward(x):
            batch_size = x.shape[0]
            # Return a tensor with some "segmented" regions
            output = torch.zeros(batch_size, 1, x.shape[2], x.shape[3])
            # Add some fake segmented regions
            output[:, :, 10:30, 10:30] = 5.0  # Will be > 0.5 after sigmoid
            output[:, :, 50:70, 50:70] = 5.0
            return output
        
        model.forward = mock_forward
        model.__call__ = mock_forward  # Make sure __call__ also returns tensor
        model.eval = Mock(return_value=model)
        model.to = Mock(return_value=model)
        # Add named_parameters for state dict loading test
        model.named_parameters = Mock(return_value=[])
        return model
    
    @pytest.fixture
    def test_image(self, tmp_path):
        """Create a test image file."""
        img_path = tmp_path / "test_image.png"
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        # Add some features to the image
        cv2.circle(img, (25, 25), 10, (255, 255, 255), -1)
        cv2.rectangle(img, (60, 60), (80, 80), (255, 255, 255), -1)
        cv2.imwrite(str(img_path), img)
        return str(img_path)
    
    @patch('torch.load')
    def test_model_loading(self, mock_torch_load, mock_model):
        """Test model checkpoint loading."""
        # Mock checkpoint with proper state dict
        mock_state_dict = {}
        for name, param in mock_model.named_parameters():
            mock_state_dict[name] = param.data
        
        mock_checkpoint = {
            'state_dict': mock_state_dict,
            'epoch': 9,
            'loss': 0.05
        }
        mock_torch_load.return_value = mock_checkpoint
        
        # Test loading
        from resunet_segmentation import load_model
        
        with patch('resunet_segmentation.ResUNet', return_value=mock_model):
            model = load_model('/path/to/checkpoint.pth')
            assert model is not None
            mock_torch_load.assert_called_once()
    
    def test_image_preprocessing(self, test_image):
        """Test image preprocessing pipeline."""
        from resunet_segmentation import preprocess_image
        
        # Load image
        image = cv2.imread(test_image)
        
        # Preprocess
        processed = preprocess_image(image, target_size=(256, 256))
        
        # Check output
        assert isinstance(processed, torch.Tensor)
        assert processed.shape == (1, 3, 256, 256)  # batch, channels, height, width
        assert processed.dtype == torch.float32
        assert 0 <= processed.min() <= processed.max() <= 1  # Normalized
    
    def test_full_segmentation_pipeline(self, mock_model, test_image, tmp_path):
        """Test complete segmentation pipeline."""
        # Patch load_model to return our mock model
        with patch('resunet_segmentation.load_model', return_value=mock_model):
            from resunet_segmentation import segment_image
            
            output_dir = tmp_path / "output"
            output_dir.mkdir()
            
            # Run segmentation
            result = segment_image(
                image_path=test_image,
                model_path='/fake/model.pth',
                output_dir=str(output_dir),
                return_polygons=True
            )
            
            # Check result structure
            assert isinstance(result, dict)
            assert 'mask_path' in result
            assert 'polygons' in result
            assert 'metadata' in result
            
            # Check polygons
            assert isinstance(result['polygons'], list)
        if len(result['polygons']) > 0:
            polygon = result['polygons'][0]
            assert 'id' in polygon
            assert 'points' in polygon
            assert 'area' in polygon
    
    def test_error_handling_missing_image(self):
        """Test error handling for missing image."""
        from resunet_segmentation import segment_image
        
        with pytest.raises(FileNotFoundError):
            segment_image(
                image_path='/non/existent/image.png',
                model_path='/fake/model.pth'
            )
    
    def test_error_handling_invalid_image(self, tmp_path):
        """Test error handling for invalid image file."""
        # Create invalid image file
        invalid_path = tmp_path / "invalid.png"
        invalid_path.write_text("not an image")
        
        from resunet_segmentation import segment_image
        
        with pytest.raises(ValueError):
            segment_image(
                image_path=str(invalid_path),
                model_path='/fake/model.pth'
            )


class TestBatchProcessing:
    """Test batch processing capabilities."""
    
    @pytest.fixture
    def batch_images(self, tmp_path):
        """Create multiple test images."""
        image_paths = []
        for i in range(3):
            img_path = tmp_path / f"test_image_{i}.png"
            img = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
            cv2.imwrite(str(img_path), img)
            image_paths.append(str(img_path))
        return image_paths
    
    @patch('resunet_segmentation.load_model')
    def test_batch_segmentation(self, mock_load_model, mock_model, batch_images, tmp_path):
        """Test batch segmentation processing."""
        mock_load_model.return_value = mock_model
        
        from resunet_segmentation import segment_batch
        
        output_dir = tmp_path / "output"
        output_dir.mkdir()
        
        # Process batch
        results = segment_batch(
            image_paths=batch_images,
            model_path='/fake/model.pth',
            output_dir=str(output_dir),
            batch_size=2
        )
        
        # Check results
        assert len(results) == len(batch_images)
        for i, result in enumerate(results):
            assert result['image_path'] == batch_images[i]
            assert 'status' in result
            assert result['status'] in ['success', 'error']


class TestPerformanceMetrics:
    """Test performance and resource usage."""
    
    def test_memory_usage(self, mock_model):
        """Test that model doesn't leak memory during inference."""
        import psutil
        import gc
        
        initial_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        
        # Run multiple inferences
        for _ in range(10):
            with torch.no_grad():
                x = torch.randn(1, 3, 256, 256)
                output = mock_model(x)
                del output
            gc.collect()
        
        final_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be minimal
        assert memory_increase < 100  # Less than 100MB increase
    
    def test_inference_speed(self, mock_model):
        """Test inference speed."""
        import time
        
        # Warm up
        x = torch.randn(1, 3, 512, 512)
        with torch.no_grad():
            _ = mock_model(x)
        
        # Time inference
        start_time = time.time()
        num_iterations = 10
        
        for _ in range(num_iterations):
            with torch.no_grad():
                _ = mock_model(x)
        
        elapsed_time = time.time() - start_time
        avg_time = elapsed_time / num_iterations
        
        # Should be reasonably fast (adjust threshold as needed)
        assert avg_time < 1.0  # Less than 1 second per image