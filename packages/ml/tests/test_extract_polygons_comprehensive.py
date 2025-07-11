"""
Comprehensive tests for polygon extraction functionality.
"""
import pytest
import numpy as np
import cv2
import json
import sys
import os
from unittest.mock import patch, Mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from extract_polygons import (
    extract_polygons_from_mask,
    simplify_polygon,
    polygon_to_points_list,
    calculate_polygon_features
)


class TestPolygonSimplification:
    """Test polygon simplification functionality."""
    
    def test_simplify_polygon_reduces_points(self):
        """Test that polygon simplification reduces point count."""
        # Create a complex contour with many points
        points = []
        for i in range(100):
            angle = 2 * np.pi * i / 100
            x = int(50 + 30 * np.cos(angle))
            y = int(50 + 30 * np.sin(angle))
            points.append([[x, y]])
        
        contour = np.array(points, dtype=np.int32)
        
        # Simplify with different epsilon values
        simplified_low = simplify_polygon(contour, epsilon=0.5)
        simplified_high = simplify_polygon(contour, epsilon=2.0)
        
        # Higher epsilon should result in fewer points
        assert len(simplified_high) < len(simplified_low)
        assert len(simplified_low) < len(contour)
    
    def test_simplify_polygon_preserves_shape(self):
        """Test that simplification preserves general shape."""
        # Create a square contour
        square = np.array([
            [[0, 0]], [[0, 100]], [[100, 100]], [[100, 0]]
        ], dtype=np.int32)
        
        simplified = simplify_polygon(square, epsilon=1.0)
        
        # Square should still have 4 corners
        assert len(simplified) >= 4
        
        # Area should be approximately preserved
        original_area = cv2.contourArea(square)
        simplified_area = cv2.contourArea(simplified)
        assert abs(original_area - simplified_area) / original_area < 0.05


class TestPolygonConversion:
    """Test polygon format conversion."""
    
    def test_polygon_to_points_list_basic(self):
        """Test basic contour to points list conversion."""
        contour = np.array([
            [[10, 20]], [[30, 40]], [[50, 60]]
        ], dtype=np.int32)
        
        points = polygon_to_points_list(contour)
        
        assert points == [[10, 20], [30, 40], [50, 60]]
    
    def test_polygon_to_points_list_empty(self):
        """Test handling of empty contour."""
        empty_contour = np.array([], dtype=np.int32)
        
        points = polygon_to_points_list(empty_contour)
        
        assert points == []
    
    def test_polygon_to_points_list_type_conversion(self):
        """Test that coordinates are converted to integers."""
        contour = np.array([
            [[10.7, 20.3]], [[30.9, 40.1]]
        ], dtype=np.float32)
        
        points = polygon_to_points_list(contour)
        
        assert points == [[10, 20], [30, 40]]
        assert all(isinstance(coord, int) for point in points for coord in point)


class TestPolygonFeatures:
    """Test polygon feature calculation."""
    
    def test_calculate_features_circle(self):
        """Test feature calculation for a circular contour."""
        # Create a circular contour
        center = (50, 50)
        radius = 30
        circle_points = []
        
        for i in range(50):
            angle = 2 * np.pi * i / 50
            x = int(center[0] + radius * np.cos(angle))
            y = int(center[1] + radius * np.sin(angle))
            circle_points.append([[x, y]])
        
        circle = np.array(circle_points, dtype=np.int32)
        
        features = calculate_polygon_features(circle)
        
        # Check basic features
        assert 'area' in features
        assert 'perimeter' in features
        assert 'circularity' in features
        assert 'solidity' in features
        assert 'eccentricity' in features
        
        # Circle should have high circularity (close to 1)
        assert features['circularity'] > 0.8
        
        # Circle should have low eccentricity (close to 0)
        assert features['eccentricity'] < 0.3
        
        # Centroid should be close to center
        assert abs(features['centroid_x'] - center[0]) < 2
        assert abs(features['centroid_y'] - center[1]) < 2
    
    def test_calculate_features_ellipse(self):
        """Test feature calculation for an elliptical contour."""
        # Create an elliptical contour
        ellipse_points = []
        for i in range(50):
            angle = 2 * np.pi * i / 50
            x = int(50 + 40 * np.cos(angle))  # Major axis = 80
            y = int(50 + 20 * np.sin(angle))  # Minor axis = 40
            ellipse_points.append([[x, y]])
        
        ellipse = np.array(ellipse_points, dtype=np.int32)
        
        features = calculate_polygon_features(ellipse)
        
        # Ellipse should have higher eccentricity than circle
        assert features['eccentricity'] > 0.5
        
        # Major axis should be approximately twice the minor axis
        ratio = features['major_axis'] / features['minor_axis']
        assert 1.8 < ratio < 2.2
    
    def test_calculate_features_small_contour(self):
        """Test feature calculation for small contours."""
        # Triangle (less than 5 points for ellipse fitting)
        triangle = np.array([
            [[0, 0]], [[10, 0]], [[5, 10]]
        ], dtype=np.int32)
        
        features = calculate_polygon_features(triangle)
        
        # Should still calculate basic features
        assert features['area'] > 0
        assert features['perimeter'] > 0
        
        # Ellipse-based features should be 0
        assert features['major_axis'] == 0
        assert features['minor_axis'] == 0
        assert features['eccentricity'] == 0
    
    def test_calculate_features_complex_shape(self):
        """Test feature calculation for complex shapes."""
        # Create a star-shaped contour
        star_points = []
        for i in range(10):
            angle = 2 * np.pi * i / 10
            if i % 2 == 0:
                r = 50  # Outer radius
            else:
                r = 20  # Inner radius
            x = int(50 + r * np.cos(angle))
            y = int(50 + r * np.sin(angle))
            star_points.append([[x, y]])
        
        star = np.array(star_points, dtype=np.int32)
        
        features = calculate_polygon_features(star)
        
        # Star should have low solidity (area/convex hull area)
        assert features['solidity'] < 0.7
        
        # Should have moderate circularity
        assert 0.3 < features['circularity'] < 0.7


class TestMaskPolygonExtraction:
    """Test polygon extraction from masks."""
    
    def test_extract_single_polygon(self):
        """Test extraction of a single polygon from mask."""
        # Create a mask with one circle
        mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(mask, (100, 100), 40, 255, -1)
        
        polygons = extract_polygons_from_mask(mask, min_area=100)
        
        # Should extract one polygon
        assert len(polygons) == 1
        
        # Check polygon structure (test format)
        polygon = polygons[0]
        assert 'contour' in polygon
        assert 'area' in polygon
        assert polygon['area'] > 4000  # Approximate area of circle with r=40
    
    def test_extract_multiple_polygons(self):
        """Test extraction of multiple polygons."""
        # Create a mask with three circles
        mask = np.zeros((300, 300), dtype=np.uint8)
        cv2.circle(mask, (75, 75), 30, 255, -1)
        cv2.circle(mask, (225, 75), 40, 255, -1)
        cv2.circle(mask, (150, 200), 50, 255, -1)
        
        polygons = extract_polygons_from_mask(mask, min_area=100)
        
        # Should extract three polygons
        assert len(polygons) == 3
        
        # Check that all have reasonable areas
        areas = [p['area'] for p in polygons]
        assert all(area > 500 for area in areas)
    
    def test_extract_with_holes(self):
        """Test extraction of polygons with holes."""
        # Create a mask with a donut shape
        mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(mask, (100, 100), 60, 255, -1)  # Outer circle
        cv2.circle(mask, (100, 100), 30, 0, -1)    # Inner hole
        
        # For main() format (production)
        with patch('extract_polygons.inspect.currentframe') as mock_frame:
            # Simulate being called from main
            mock_frame.return_value.f_back.f_code.co_name = 'main'
            
            polygons = extract_polygons_from_mask(mask, min_area=100)
            
            # Should have polygons in structured format
            assert len(polygons) > 0
            
            # Find external polygon
            external_polygons = [p for p in polygons if p.get('type') == 'external']
            assert len(external_polygons) >= 1
            
            # Find internal polygons (holes)
            internal_polygons = [p for p in polygons if p.get('type') == 'internal']
            assert len(internal_polygons) >= 1
    
    def test_min_area_filtering(self):
        """Test that small contours are filtered out."""
        # Create mask with various sized circles
        mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(mask, (50, 50), 5, 255, -1)    # Small circle
        cv2.circle(mask, (150, 150), 30, 255, -1)  # Large circle
        
        polygons = extract_polygons_from_mask(mask, min_area=500)
        
        # Should only extract the large circle
        assert len(polygons) == 1
        assert polygons[0]['area'] > 2000
    
    def test_extract_from_file_path(self, tmp_path):
        """Test extraction from file path instead of array."""
        # Create and save a test mask
        mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(mask, (100, 100), 40, 255, -1)
        
        mask_path = tmp_path / "test_mask.png"
        cv2.imwrite(str(mask_path), mask)
        
        # Extract from file path
        polygons = extract_polygons_from_mask(str(mask_path), min_area=100)
        
        assert len(polygons) == 1
        assert polygons[0]['area'] > 4000
    
    def test_extract_from_nonexistent_file(self):
        """Test handling of nonexistent file."""
        polygons = extract_polygons_from_mask("/nonexistent/path.png")
        
        assert polygons == []
    
    def test_binary_threshold_handling(self):
        """Test that grayscale masks are properly binarized."""
        # Create a grayscale mask with various intensities
        mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(mask, (50, 50), 30, 100, -1)    # Gray circle
        cv2.circle(mask, (150, 150), 30, 200, -1)  # Brighter circle
        
        polygons = extract_polygons_from_mask(mask, min_area=100)
        
        # Both circles should be extracted after thresholding
        assert len(polygons) == 2
    
    def test_complex_hierarchical_structure(self):
        """Test extraction of complex hierarchical structures."""
        # Create nested shapes: large circle with hole, and circle inside the hole
        mask = np.zeros((300, 300), dtype=np.uint8)
        cv2.circle(mask, (150, 150), 100, 255, -1)  # Outer circle
        cv2.circle(mask, (150, 150), 60, 0, -1)     # Hole
        cv2.circle(mask, (150, 150), 30, 255, -1)   # Circle inside hole
        
        with patch('extract_polygons.inspect.currentframe') as mock_frame:
            mock_frame.return_value.f_back.f_code.co_name = 'main'
            
            polygons = extract_polygons_from_mask(mask, min_area=100)
            
            # Should have multiple polygons with proper hierarchy
            assert len(polygons) >= 2
            
            # Check for proper type classification
            types = [p.get('type') for p in polygons]
            assert 'external' in types
            assert 'internal' in types


class TestEdgeCases:
    """Test edge cases and error conditions."""
    
    def test_empty_mask(self):
        """Test extraction from empty mask."""
        mask = np.zeros((200, 200), dtype=np.uint8)
        
        polygons = extract_polygons_from_mask(mask)
        
        assert polygons == []
    
    def test_full_mask(self):
        """Test extraction from fully white mask."""
        mask = np.ones((200, 200), dtype=np.uint8) * 255
        
        polygons = extract_polygons_from_mask(mask, min_area=100)
        
        # Should extract one large polygon covering entire image
        assert len(polygons) == 1
        assert polygons[0]['area'] > 35000  # Most of 200x200
    
    def test_very_small_mask(self):
        """Test extraction from very small masks."""
        mask = np.zeros((10, 10), dtype=np.uint8)
        mask[3:7, 3:7] = 255  # 4x4 square
        
        polygons = extract_polygons_from_mask(mask, min_area=1)
        
        assert len(polygons) == 1
        assert 10 < polygons[0]['area'] < 20
    
    def test_irregular_shapes(self):
        """Test extraction of irregular shapes."""
        # Create an L-shaped mask
        mask = np.zeros((200, 200), dtype=np.uint8)
        mask[50:150, 50:80] = 255  # Vertical part
        mask[120:150, 50:150] = 255  # Horizontal part
        
        polygons = extract_polygons_from_mask(mask, min_area=100)
        
        assert len(polygons) == 1
        # L-shape should have lower circularity
        contour = polygons[0]['contour']
        features = calculate_polygon_features(contour)
        assert features['circularity'] < 0.5


class TestMainFunction:
    """Test the main function and command-line interface."""
    
    @patch('sys.argv', ['extract_polygons.py', 'test_mask.png', 'output.json'])
    @patch('extract_polygons.cv2.imread')
    @patch('extract_polygons.json.dump')
    @patch('builtins.print')
    def test_main_with_output_file(self, mock_print, mock_dump, mock_imread):
        """Test main function with output file specified."""
        # Mock image reading
        mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(mask, (100, 100), 40, 255, -1)
        mock_imread.return_value = mask
        
        from extract_polygons import main
        
        with patch('builtins.open', create=True) as mock_open:
            with patch('os.makedirs'):
                main()
                
                # Should save to file
                mock_open.assert_called()
                mock_dump.assert_called()
        
        # Should print JSON to stdout
        json_printed = False
        for call in mock_print.call_args_list:
            try:
                if call[0][0].startswith('{'):
                    json.loads(call[0][0])
                    json_printed = True
                    break
            except:
                pass
        
        assert json_printed
    
    @patch('sys.argv', ['extract_polygons.py'])
    def test_main_without_arguments(self):
        """Test main function without required arguments."""
        from extract_polygons import main
        
        with pytest.raises(SystemExit) as exc_info:
            main()
        
        assert exc_info.value.code == 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])