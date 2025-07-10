"""
Pytest configuration for ML service tests.
"""
import os
import sys
import pytest
import tempfile
import shutil
import numpy as np
from PIL import Image

# Add parent directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


@pytest.fixture
def test_image_path(tmp_path):
    """Create a test image and return its path."""
    img_path = tmp_path / "test_image.png"
    # Create a simple test image (100x100 RGB)
    img_array = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    img = Image.fromarray(img_array)
    img.save(str(img_path))
    return str(img_path)


@pytest.fixture
def mock_checkpoint_path(tmp_path):
    """Create a mock checkpoint file path."""
    checkpoint_path = tmp_path / "mock_checkpoint.pth.tar"
    # Create an empty file to simulate checkpoint
    checkpoint_path.touch()
    return str(checkpoint_path)


@pytest.fixture
def temp_output_dir(tmp_path):
    """Create a temporary output directory."""
    output_dir = tmp_path / "output"
    output_dir.mkdir()
    return str(output_dir)


@pytest.fixture
def sample_task():
    """Return a sample segmentation task."""
    return {
        'taskId': 'test-task-123',
        'imageId': 42,
        'imagePath': '/ML/uploads/test_image.png',
        'parameters': {
            'threshold': 0.5,
            'min_area': 100
        },
        'callbackUrl': 'http://backend:5001/api/segmentation/callback'
    }


@pytest.fixture
def mock_polygons():
    """Generate mock polygon data."""
    return [
        {
            'id': 1,
            'points': [[10, 10], [20, 10], [20, 20], [10, 20]],
            'class': 'cell',
            'confidence': 0.95
        },
        {
            'id': 2,
            'points': [[30, 30], [40, 30], [40, 40], [30, 40]],
            'class': 'nucleus',
            'confidence': 0.88
        }
    ]