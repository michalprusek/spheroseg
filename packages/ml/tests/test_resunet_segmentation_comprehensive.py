"""
Comprehensive tests for the ResUNet segmentation script.
"""
import pytest
import torch
import numpy as np
import cv2
import json
import os
import sys
import tempfile
import shutil
from unittest.mock import Mock, patch, MagicMock, call
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import resunet_segmentation
from resunet_segmentation import (
    load_model, preprocess_image, segment_image, segment_batch,
    remove_module_prefix, load_checkpoint, preprocess_mask,
    parse_args, main
)


class TestHelperFunctions:
    """Test helper functions for model loading and preprocessing."""
    
    def test_remove_module_prefix_with_prefix(self):
        """Test removing 'module.' prefix from state dict keys."""
        state_dict = {
            'module.conv1.weight': torch.randn(64, 3, 3, 3),
            'module.conv1.bias': torch.randn(64),
            'module.fc.weight': torch.randn(10, 64)
        }
        
        cleaned = remove_module_prefix(state_dict)
        
        assert 'conv1.weight' in cleaned
        assert 'conv1.bias' in cleaned
        assert 'fc.weight' in cleaned
        assert 'module.conv1.weight' not in cleaned
    
    def test_remove_module_prefix_without_prefix(self):
        """Test that keys without prefix remain unchanged."""
        state_dict = {
            'conv1.weight': torch.randn(64, 3, 3, 3),
            'conv1.bias': torch.randn(64)
        }
        
        cleaned = remove_module_prefix(state_dict)
        
        assert 'conv1.weight' in cleaned
        assert 'conv1.bias' in cleaned
        assert len(cleaned) == len(state_dict)
    
    def test_preprocess_mask_binary(self):
        """Test mask preprocessing for binary masks."""
        # Create a noisy binary mask
        mask = np.zeros((200, 200), dtype=np.uint8)
        # Add main shape
        cv2.circle(mask, (100, 100), 50, 255, -1)
        # Add noise
        noise_points = np.random.randint(0, 200, (20, 2))
        for point in noise_points:
            mask[point[1], point[0]] = 255
        
        processed = preprocess_mask(mask)
        
        # Processed mask should have less noise
        # Count non-zero pixels
        original_pixels = np.count_nonzero(mask)
        processed_pixels = np.count_nonzero(processed)
        
        # Should remove some noise
        assert processed_pixels < original_pixels
        
        # Main shape should be preserved
        assert processed_pixels > 7000  # Approximate area of circle


class TestModelLoading:
    """Test model loading functionality."""
    
    @patch('resunet_segmentation.torch.load')
    @patch('resunet_segmentation.ResUNet')
    def test_load_model_success(self, mock_resunet_class, mock_torch_load):
        """Test successful model loading."""
        # Mock model
        mock_model = Mock()
        mock_resunet_class.return_value = mock_model
        
        # Mock checkpoint
        mock_checkpoint = {
            'state_dict': {
                'conv1.weight': torch.randn(64, 3, 3, 3)
            }
        }
        mock_torch_load.return_value = mock_checkpoint
        
        model = load_model('/path/to/model.pth', device='cpu')
        
        assert model == mock_model
        mock_model.eval.assert_called_once()
        mock_model.load_state_dict.assert_called_once()
    
    @patch('resunet_segmentation.torch.load')
    def test_load_model_file_not_found(self, mock_torch_load):
        """Test model loading with missing file."""
        mock_torch_load.side_effect = FileNotFoundError()
        
        with pytest.raises(ValueError) as exc_info:
            load_model('/nonexistent/model.pth')
        
        assert 'Failed to load model' in str(exc_info.value)
    
    @patch('resunet_segmentation.torch.load')
    @patch('resunet_segmentation.ResUNet')
    def test_load_model_cuda_device(self, mock_resunet_class, mock_torch_load):
        """Test model loading on CUDA device."""
        mock_model = Mock()
        mock_resunet_class.return_value = mock_model
        mock_torch_load.return_value = {'state_dict': {}}
        
        with patch('torch.cuda.is_available', return_value=True):
            model = load_model('/path/to/model.pth', device='cuda')
            
            # Should move model to CUDA
            mock_model.to.assert_called()
            device_arg = mock_model.to.call_args[0][0]
            assert device_arg.type == 'cuda'


class TestImagePreprocessing:
    """Test image preprocessing functionality."""
    
    def test_preprocess_rgb_image(self):
        """Test preprocessing of RGB image."""
        # Create test RGB image
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        tensor = preprocess_image(image, target_size=(256, 256))
        
        assert isinstance(tensor, torch.Tensor)
        assert tensor.shape == (1, 3, 256, 256)
        assert tensor.dtype == torch.float32
        assert 0 <= tensor.min() <= tensor.max() <= 1
    
    def test_preprocess_grayscale_image(self):
        """Test preprocessing of grayscale image."""
        # Create grayscale image
        image = np.random.randint(0, 255, (480, 640), dtype=np.uint8)
        
        tensor = preprocess_image(image, target_size=(512, 512))
        
        assert tensor.shape == (1, 3, 512, 512)  # Should be converted to RGB
    
    def test_preprocess_rgba_image(self):
        """Test preprocessing of RGBA image."""
        # Create RGBA image
        image = np.random.randint(0, 255, (480, 640, 4), dtype=np.uint8)
        
        tensor = preprocess_image(image, target_size=(256, 256))
        
        assert tensor.shape == (1, 3, 256, 256)  # Alpha channel removed
    
    def test_preprocess_none_image(self):
        """Test preprocessing with None image."""
        with pytest.raises(ValueError) as exc_info:
            preprocess_image(None)
        
        assert 'Image is None' in str(exc_info.value)
    
    def test_preprocess_different_sizes(self):
        """Test preprocessing with different target sizes."""
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Test various sizes
        sizes = [(128, 128), (256, 256), (512, 512), (1024, 1024)]
        
        for size in sizes:
            tensor = preprocess_image(image, target_size=size)
            assert tensor.shape == (1, 3, size[0], size[1])


class TestSegmentImage:
    """Test single image segmentation."""
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test outputs."""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def test_image_path(self, temp_dir):
        """Create a test image file."""
        image_path = os.path.join(temp_dir, 'test_image.png')
        image = np.zeros((200, 200, 3), dtype=np.uint8)
        cv2.circle(image, (100, 100), 50, (255, 255, 255), -1)
        cv2.imwrite(image_path, image)
        return image_path
    
    @patch('resunet_segmentation.load_model')
    def test_segment_image_success(self, mock_load_model, test_image_path, temp_dir):
        """Test successful image segmentation."""
        # Mock model
        mock_model = Mock()
        
        def mock_forward(x):
            # Return mock segmentation mask
            batch_size = x.shape[0]
            return torch.ones(batch_size, 1, x.shape[2], x.shape[3]) * 5.0  # High values for sigmoid
        
        mock_model.return_value = mock_forward
        mock_load_model.return_value = mock_model
        
        result = segment_image(
            test_image_path,
            '/fake/model.pth',
            output_dir=temp_dir,
            return_polygons=True
        )
        
        # Check result structure
        assert 'mask_path' in result
        assert 'metadata' in result
        assert 'polygons' in result
        
        # Check mask was saved
        assert os.path.exists(result['mask_path'])
        
        # Check metadata
        assert 'original_shape' in result['metadata']
        assert 'timestamp' in result['metadata']
    
    def test_segment_image_nonexistent_file(self):
        """Test segmentation with nonexistent image file."""
        with pytest.raises(FileNotFoundError):
            segment_image('/nonexistent/image.png', '/fake/model.pth')
    
    @patch('cv2.imread')
    def test_segment_image_invalid_file(self, mock_imread):
        """Test segmentation with invalid image file."""
        mock_imread.return_value = None
        
        with pytest.raises(ValueError) as exc_info:
            segment_image('/path/to/invalid.png', '/fake/model.pth')
        
        assert 'Failed to load image' in str(exc_info.value)
    
    @patch('resunet_segmentation.load_model')
    @patch('resunet_segmentation.extract_polygons_from_mask')
    def test_segment_image_polygon_extraction(self, mock_extract, mock_load_model, test_image_path):
        """Test polygon extraction from segmentation."""
        # Mock model
        mock_model = Mock()
        mock_model.return_value = torch.ones(1, 1, 1024, 1024) * 5.0
        mock_load_model.return_value = mock_model
        
        # Mock polygon extraction
        mock_polygons = [
            {'id': 1, 'points': [[10, 10], [20, 10], [20, 20]], 'area': 100},
            {'id': 2, 'points': [[30, 30], [40, 30], [40, 40]], 'area': 100}
        ]
        mock_extract.return_value = mock_polygons
        
        result = segment_image(test_image_path, '/fake/model.pth', return_polygons=True)
        
        assert 'polygons' in result
        assert len(result['polygons']) == 2
        mock_extract.assert_called_once()


class TestBatchSegmentation:
    """Test batch segmentation functionality."""
    
    @pytest.fixture
    def test_images(self, temp_dir):
        """Create multiple test images."""
        image_paths = []
        for i in range(3):
            image_path = os.path.join(temp_dir, f'test_image_{i}.png')
            image = np.zeros((200, 200, 3), dtype=np.uint8)
            cv2.circle(image, (100, 100), 30 + i * 10, (255, 255, 255), -1)
            cv2.imwrite(image_path, image)
            image_paths.append(image_path)
        return image_paths
    
    @patch('resunet_segmentation.load_model')
    def test_segment_batch_success(self, mock_load_model, test_images, temp_dir):
        """Test successful batch segmentation."""
        # Mock model
        mock_model = Mock()
        mock_model.return_value = torch.ones(1, 1, 1024, 1024) * 5.0
        mock_load_model.return_value = mock_model
        
        results = segment_batch(test_images, '/fake/model.pth', temp_dir, batch_size=2)
        
        assert len(results) == 3
        
        for i, result in enumerate(results):
            assert result['image_path'] == test_images[i]
            assert result['status'] == 'success'
            assert 'mask_path' in result
    
    @patch('resunet_segmentation.load_model')
    def test_segment_batch_with_errors(self, mock_load_model, test_images, temp_dir):
        """Test batch segmentation with some failures."""
        # Add a nonexistent image to the batch
        test_images.append('/nonexistent/image.png')
        
        # Mock model
        mock_model = Mock()
        mock_model.return_value = torch.ones(1, 1, 1024, 1024) * 5.0
        mock_load_model.return_value = mock_model
        
        results = segment_batch(test_images, '/fake/model.pth', temp_dir)
        
        assert len(results) == 4
        
        # First three should succeed
        for i in range(3):
            assert results[i]['status'] == 'success'
        
        # Last one should fail
        assert results[3]['status'] == 'error'
        assert 'error' in results[3]
    
    @patch('resunet_segmentation.load_model')
    def test_segment_batch_memory_efficient(self, mock_load_model, test_images):
        """Test that batch segmentation loads model only once."""
        mock_model = Mock()
        mock_model.return_value = torch.ones(1, 1, 1024, 1024) * 5.0
        mock_load_model.return_value = mock_model
        
        segment_batch(test_images, '/fake/model.pth', '/tmp')
        
        # Model should be loaded only once
        mock_load_model.assert_called_once()


class TestMainFunction:
    """Test the main function and CLI."""
    
    def test_parse_args(self):
        """Test command line argument parsing."""
        test_args = [
            '--image_path', '/path/to/image.png',
            '--output_path', '/path/to/output.json',
            '--checkpoint_path', '/path/to/model.pth',
            '--output_dir', '/path/to/output',
            '--model_type', 'resunet'
        ]
        
        with patch('sys.argv', ['script.py'] + test_args):
            args = parse_args()
            
            assert args.image_path == '/path/to/image.png'
            assert args.output_path == '/path/to/output.json'
            assert args.checkpoint_path == '/path/to/model.pth'
            assert args.output_dir == '/path/to/output'
            assert args.model_type == 'resunet'
    
    @patch('cv2.imread')
    @patch('resunet_segmentation.load_checkpoint')
    @patch('resunet_segmentation.extract_polygons_from_mask')
    @patch('cv2.imwrite')
    @patch('builtins.open', create=True)
    @patch('json.dump')
    def test_main_success(self, mock_json_dump, mock_open, mock_imwrite, 
                         mock_extract, mock_load_checkpoint, mock_imread):
        """Test successful execution of main function."""
        # Setup mocks
        mock_imread.return_value = np.zeros((200, 200, 3), dtype=np.uint8)
        mock_imwrite.return_value = True
        mock_extract.return_value = [{'id': 1, 'points': [[10, 10]]}]
        
        # Mock args
        test_args = [
            'script.py',
            '--image_path', '/test/image.png',
            '--output_path', '/test/output.json',
            '--checkpoint_path', '/test/model.pth',
            '--output_dir', '/test/output'
        ]
        
        with patch('sys.argv', test_args):
            with patch('resunet_segmentation.ResUNet') as mock_model_class:
                mock_model = Mock()
                mock_model.eval = Mock()
                mock_model.return_value = torch.ones(1, 1, 1024, 1024) * 5.0
                mock_model_class.return_value = mock_model
                
                with patch('os.makedirs'):
                    # Run main
                    exit_code = main()
                    
                    assert exit_code == 0
                    
                    # Check that result was saved
                    mock_json_dump.assert_called()
                    result_data = mock_json_dump.call_args[0][0]
                    assert result_data['status'] == 'completed'
                    assert result_data['success'] is True
    
    @patch('cv2.imread')
    def test_main_image_not_found(self, mock_imread):
        """Test main function with image not found."""
        mock_imread.return_value = None
        
        test_args = [
            'script.py',
            '--image_path', '/nonexistent/image.png',
            '--output_path', '/test/output.json',
            '--checkpoint_path', '/test/model.pth',
            '--output_dir', '/test/output'
        ]
        
        with patch('sys.argv', test_args):
            with patch('os.makedirs'):
                exit_code = main()
                
                assert exit_code == 1
    
    @patch('cv2.imread')
    @patch('resunet_segmentation.ResUNet')
    def test_main_cuda_error_handling(self, mock_model_class, mock_imread):
        """Test CUDA error handling in main function."""
        mock_imread.return_value = np.zeros((200, 200, 3), dtype=np.uint8)
        
        # Mock CUDA OOM error
        mock_model = Mock()
        mock_model.side_effect = torch.cuda.OutOfMemoryError('CUDA OOM')
        mock_model_class.return_value.side_effect = torch.cuda.OutOfMemoryError('CUDA OOM')
        
        test_args = [
            'script.py',
            '--image_path', '/test/image.png',
            '--output_path', '/test/output.json',
            '--checkpoint_path', '/test/model.pth',
            '--output_dir', '/test/output'
        ]
        
        with patch('sys.argv', test_args):
            with patch('os.makedirs'):
                with patch('json.dump') as mock_json_dump:
                    exit_code = main()
                    
                    assert exit_code == 3  # Special code for CUDA errors
                    
                    # Error should be saved to JSON
                    if mock_json_dump.called:
                        error_data = mock_json_dump.call_args[0][0]
                        assert error_data['status'] == 'failed'
                        assert error_data['error_type'] == 'cuda_out_of_memory'
    
    @patch('cv2.imread')
    def test_main_path_fixing(self, mock_imread):
        """Test path fixing for duplicated 'uploads' directories."""
        mock_imread.return_value = np.zeros((200, 200, 3), dtype=np.uint8)
        
        test_args = [
            'script.py',
            '--image_path', 'uploads/uploads/project/image.png',  # Duplicated uploads
            '--output_path', '/test/output.json',
            '--checkpoint_path', '/test/model.pth',
            '--output_dir', '/test/output'
        ]
        
        with patch('sys.argv', test_args):
            with patch('os.makedirs'):
                with patch('resunet_segmentation.ResUNet'):
                    with patch('builtins.print') as mock_print:
                        main()
                        
                        # Should log path fixing
                        assert any('Fixed duplicated uploads path' in str(call) 
                                  for call in mock_print.call_args_list)


class TestDeviceSelection:
    """Test device selection logic."""
    
    @patch('torch.cuda.is_available')
    @patch('hasattr')
    def test_device_preference_best_cuda(self, mock_hasattr, mock_cuda_available):
        """Test 'best' device preference with CUDA available."""
        mock_cuda_available.return_value = True
        mock_hasattr.return_value = False  # No MPS
        
        with patch.dict(os.environ, {'DEVICE_PREFERENCE': 'best'}):
            # Would need to test within main() context
            pass
    
    @patch('torch.cuda.is_available')
    def test_device_preference_cpu_forced(self, mock_cuda_available):
        """Test forced CPU device preference."""
        mock_cuda_available.return_value = True  # CUDA available but ignored
        
        with patch.dict(os.environ, {'DEVICE_PREFERENCE': 'cpu'}):
            # Would need to test within main() context
            pass


class TestErrorRecovery:
    """Test error recovery mechanisms."""
    
    @patch('cv2.imread')
    @patch('cv2.imwrite')
    def test_mask_save_failure_handling(self, mock_imwrite, mock_imread):
        """Test handling of mask save failures."""
        mock_imread.return_value = np.zeros((200, 200, 3), dtype=np.uint8)
        mock_imwrite.return_value = False  # Simulate write failure
        
        test_args = [
            'script.py',
            '--image_path', '/test/image.png',
            '--output_path', '/test/output.json',
            '--checkpoint_path', '/test/model.pth',
            '--output_dir', '/test/output'
        ]
        
        with patch('sys.argv', test_args):
            with patch('os.makedirs'):
                with patch('resunet_segmentation.ResUNet'):
                    exit_code = main()
                    
                    assert exit_code == 1  # Should fail gracefully


if __name__ == '__main__':
    pytest.main([__file__, '-v'])