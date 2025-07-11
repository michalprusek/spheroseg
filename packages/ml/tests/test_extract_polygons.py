"""
Tests for polygon extraction from segmentation masks.
"""
import pytest
import numpy as np
import cv2
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from extract_polygons import (
    extract_polygons_from_mask,
    simplify_polygon,
    polygon_to_points_list,
    calculate_polygon_features
)


class TestPolygonExtraction:
    """Test polygon extraction functions."""
    
    @pytest.fixture
    def simple_mask(self):
        """Create a simple binary mask with one rectangle."""
        mask = np.zeros((100, 100), dtype=np.uint8)
        mask[20:40, 30:60] = 255  # Rectangle
        return mask
    
    @pytest.fixture
    def complex_mask(self):
        """Create a mask with multiple objects."""
        mask = np.zeros((200, 200), dtype=np.uint8)
        # Circle
        cv2.circle(mask, (50, 50), 20, 255, -1)
        # Rectangle
        cv2.rectangle(mask, (100, 100), (150, 150), 255, -1)
        # Triangle
        pts = np.array([[170, 20], [190, 60], [150, 60]], np.int32)
        cv2.fillPoly(mask, [pts], 255)
        return mask
    
    def test_extract_polygons_from_simple_mask(self, simple_mask):
        """Test polygon extraction from simple mask."""
        polygons = extract_polygons_from_mask(simple_mask)
        
        assert len(polygons) == 1
        polygon = polygons[0]
        
        # Check polygon structure
        assert 'contour' in polygon
        assert 'area' in polygon
        assert 'perimeter' in polygon
        assert 'centroid' in polygon
        
        # Check values
        assert polygon['area'] > 0
        assert polygon['perimeter'] > 0
        assert len(polygon['centroid']) == 2
    
    def test_extract_polygons_from_complex_mask(self, complex_mask):
        """Test polygon extraction from mask with multiple objects."""
        polygons = extract_polygons_from_mask(complex_mask)
        
        assert len(polygons) == 3  # Circle, rectangle, triangle
        
        for polygon in polygons:
            assert polygon['area'] > 0
            assert polygon['perimeter'] > 0
            assert isinstance(polygon['contour'], np.ndarray)
    
    def test_extract_polygons_with_min_area(self, complex_mask):
        """Test polygon extraction with minimum area filter."""
        # Extract with high minimum area
        polygons = extract_polygons_from_mask(complex_mask, min_area=2000)
        
        # Should filter out smaller objects
        assert len(polygons) < 3
        
        for polygon in polygons:
            assert polygon['area'] >= 2000
    
    def test_extract_polygons_empty_mask(self):
        """Test polygon extraction from empty mask."""
        empty_mask = np.zeros((100, 100), dtype=np.uint8)
        polygons = extract_polygons_from_mask(empty_mask)
        
        assert len(polygons) == 0


class TestPolygonSimplification:
    """Test polygon simplification."""
    
    def test_simplify_polygon(self):
        """Test polygon simplification."""
        # Create a polygon with many points
        contour = np.array([
            [[0, 0]], [[1, 0]], [[2, 0]], [[3, 0]], [[4, 0]],
            [[4, 1]], [[4, 2]], [[4, 3]], [[4, 4]],
            [[3, 4]], [[2, 4]], [[1, 4]], [[0, 4]],
            [[0, 3]], [[0, 2]], [[0, 1]]
        ], dtype=np.int32)
        
        simplified = simplify_polygon(contour, epsilon=1.0)
        
        # Should have fewer points
        assert len(simplified) < len(contour)
        # Should still be a valid polygon
        assert len(simplified) >= 3
    
    def test_simplify_polygon_preserves_shape(self):
        """Test that simplification preserves general shape."""
        # Create a square
        square = np.array([
            [[0, 0]], [[10, 0]], [[10, 10]], [[0, 10]]
        ], dtype=np.int32)
        
        simplified = simplify_polygon(square, epsilon=0.1)
        
        # Square should remain a square
        assert len(simplified) == 4


class TestPolygonConversion:
    """Test polygon format conversion."""
    
    def test_polygon_to_points_list(self):
        """Test converting opencv contour to points list."""
        contour = np.array([
            [[10, 20]], [[30, 40]], [[50, 60]]
        ], dtype=np.int32)
        
        points = polygon_to_points_list(contour)
        
        assert isinstance(points, list)
        assert len(points) == 3
        assert points[0] == [10, 20]
        assert points[1] == [30, 40]
        assert points[2] == [50, 60]
    
    def test_polygon_to_points_list_empty(self):
        """Test converting empty contour."""
        empty_contour = np.array([], dtype=np.int32).reshape(0, 1, 2)
        points = polygon_to_points_list(empty_contour)
        
        assert points == []


class TestPolygonFeatures:
    """Test polygon feature calculation."""
    
    def test_calculate_polygon_features(self):
        """Test feature calculation for polygon."""
        # Create a square polygon
        contour = np.array([
            [[0, 0]], [[10, 0]], [[10, 10]], [[0, 10]]
        ], dtype=np.int32)
        
        features = calculate_polygon_features(contour)
        
        # Check all features are present
        expected_features = [
            'area', 'perimeter', 'circularity', 'solidity',
            'eccentricity', 'major_axis', 'minor_axis',
            'orientation', 'centroid_x', 'centroid_y'
        ]
        
        for feature in expected_features:
            assert feature in features
            assert isinstance(features[feature], (int, float))
        
        # Check specific values for square
        assert features['area'] == 100  # 10x10 square
        assert features['perimeter'] == 40  # 4*10
        assert 0 <= features['circularity'] <= 1
        assert 0 <= features['solidity'] <= 1
    
    def test_calculate_polygon_features_circle(self):
        """Test features for circular polygon."""
        # Create approximate circle
        angles = np.linspace(0, 2*np.pi, 20, endpoint=False)
        radius = 10
        circle_points = np.array([
            [[int(radius * np.cos(a) + 20), int(radius * np.sin(a) + 20)]]
            for a in angles
        ], dtype=np.int32)
        
        features = calculate_polygon_features(circle_points)
        
        # Circle should have high circularity
        assert features['circularity'] > 0.8
        # Circle should have similar major and minor axes
        assert abs(features['major_axis'] - features['minor_axis']) < 5


class TestIntegration:
    """Integration tests for complete polygon extraction pipeline."""
    
    def test_complete_pipeline(self):
        """Test complete extraction pipeline."""
        # Create test image with shapes
        mask = np.zeros((300, 300), dtype=np.uint8)
        cv2.circle(mask, (100, 100), 30, 255, -1)
        cv2.rectangle(mask, (200, 200), (250, 250), 255, -1)
        
        # Extract polygons
        polygons = extract_polygons_from_mask(mask, min_area=100)
        
        assert len(polygons) == 2
        
        # Convert to format for API
        output_polygons = []
        for i, poly_data in enumerate(polygons):
            points = polygon_to_points_list(poly_data['contour'])
            features = calculate_polygon_features(poly_data['contour'])
            
            output_polygons.append({
                'id': i + 1,
                'points': points,
                'features': features,
                'area': poly_data['area'],
                'perimeter': poly_data['perimeter']
            })
        
        assert len(output_polygons) == 2
        assert all('points' in p for p in output_polygons)
        assert all('features' in p for p in output_polygons)