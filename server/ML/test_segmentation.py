#!/usr/bin/env python3
"""
Test script for segmentation with holes.
This script tests the extraction of polygons from a segmentation mask with holes.
"""

import os
import sys
import json
import numpy as np
import cv2
from extract_polygons import extract_polygons_from_mask

def create_test_mask(width=512, height=512):
    """Create a test mask with holes for testing polygon extraction"""
    # Create an empty mask
    mask = np.zeros((height, width), dtype=np.uint8)
    
    # Draw a filled circle (main object)
    cv2.circle(mask, (width // 2, height // 2), 200, 255, -1)
    
    # Draw a smaller filled circle inside (hole)
    cv2.circle(mask, (width // 2, height // 2), 100, 0, -1)
    
    # Draw another object
    cv2.circle(mask, (width // 4, height // 4), 80, 255, -1)
    
    # Draw a hole in the second object
    cv2.circle(mask, (width // 4, height // 4), 40, 0, -1)
    
    return mask

def main():
    # Create output directory if it doesn't exist
    output_dir = "test_output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Create a test mask
    print("Creating test mask...")
    mask = create_test_mask()
    
    # Save the mask
    mask_path = os.path.join(output_dir, "test_mask.png")
    cv2.imwrite(mask_path, mask)
    print(f"Saved test mask to {mask_path}")
    
    # Extract polygons from the mask
    print("Extracting polygons from mask...")
    polygons = extract_polygons_from_mask(mask)
    
    # Count external and internal polygons
    external_count = sum(1 for p in polygons if p.get("type") == "external")
    internal_count = sum(1 for p in polygons if p.get("type") == "internal")
    print(f"Found {len(polygons)} polygons: {external_count} external, {internal_count} internal")
    
    # Save the polygons to a JSON file
    result = {
        "success": True,
        "polygons": polygons
    }
    
    result_path = os.path.join(output_dir, "test_result.json")
    with open(result_path, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"Saved polygon data to {result_path}")
    
    # Create a visualization of the polygons
    vis_mask = np.zeros((mask.shape[0], mask.shape[1], 3), dtype=np.uint8)
    
    # Draw external polygons in green
    for polygon in polygons:
        if polygon.get("type") == "external":
            points = polygon.get("points", [])
            if points:
                # Convert points to numpy array
                pts = np.array([[p["x"], p["y"]] for p in points], np.int32)
                pts = pts.reshape((-1, 1, 2))
                cv2.polylines(vis_mask, [pts], True, (0, 255, 0), 2)
    
    # Draw internal polygons (holes) in red
    for polygon in polygons:
        if polygon.get("type") == "internal":
            points = polygon.get("points", [])
            if points:
                # Convert points to numpy array
                pts = np.array([[p["x"], p["y"]] for p in points], np.int32)
                pts = pts.reshape((-1, 1, 2))
                cv2.polylines(vis_mask, [pts], True, (0, 0, 255), 2)
    
    # Save the visualization
    vis_path = os.path.join(output_dir, "test_visualization.png")
    cv2.imwrite(vis_path, vis_mask)
    print(f"Saved visualization to {vis_path}")
    
    print("Test completed successfully!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
