#!/usr/bin/env python3
"""
Test script for segmentation with nested objects (holes).
This script creates a test mask with multiple objects and holes,
extracts polygons, and verifies that the parent-child relationships are preserved.
"""

import os
import sys
import json
import numpy as np
import cv2
from extract_polygons import extract_polygons_from_mask

def create_complex_test_mask(width=512, height=512):
    """Create a complex test mask with multiple objects and holes"""
    # Create an empty mask
    mask = np.zeros((height, width), dtype=np.uint8)
    
    # Draw a filled circle (main object 1)
    cv2.circle(mask, (width // 2, height // 2), 200, 255, -1)
    
    # Draw a smaller filled circle inside (hole in object 1)
    cv2.circle(mask, (width // 2, height // 2), 100, 0, -1)
    
    # Draw another smaller filled circle inside the hole (object 2 inside hole of object 1)
    cv2.circle(mask, (width // 2, height // 2), 50, 255, -1)
    
    # Draw another object (object 3)
    cv2.circle(mask, (width // 4, height // 4), 80, 255, -1)
    
    # Draw a hole in object 3
    cv2.circle(mask, (width // 4, height // 4), 40, 0, -1)
    
    # Draw an ellipse (object 4)
    cv2.ellipse(mask, (3*width//4, 3*height//4), (100, 50), 45, 0, 360, 255, -1)
    
    # Draw a hole in the ellipse
    cv2.ellipse(mask, (3*width//4, 3*height//4), (50, 25), 45, 0, 360, 0, -1)
    
    return mask

def verify_parent_child_relationships(polygons):
    """Verify that parent-child relationships are correctly preserved"""
    # Count external and internal polygons
    external_count = sum(1 for p in polygons if p.get("type") == "external")
    internal_count = sum(1 for p in polygons if p.get("type") == "internal")
    
    print(f"Found {len(polygons)} polygons: {external_count} external, {internal_count} internal")
    
    # Verify that all internal polygons have a parentId
    internal_with_parent = sum(1 for p in polygons if p.get("type") == "internal" and "parentId" in p)
    if internal_with_parent != internal_count:
        print(f"ERROR: Not all internal polygons have a parentId. {internal_with_parent}/{internal_count}")
        return False
    
    # Verify that all parentIds reference valid external polygons
    parent_ids = set(p.get("id") for p in polygons if p.get("type") == "external")
    valid_parent_refs = sum(1 for p in polygons if p.get("type") == "internal" and p.get("parentId") in parent_ids)
    
    if valid_parent_refs != internal_count:
        print(f"ERROR: Not all parentIds reference valid external polygons. {valid_parent_refs}/{internal_count}")
        return False
    
    print("All parent-child relationships are correctly preserved!")
    return True

def main():
    # Create output directory if it doesn't exist
    output_dir = "test_output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Create a complex test mask
    print("Creating complex test mask with nested objects...")
    mask = create_complex_test_mask()
    
    # Save the mask
    mask_path = os.path.join(output_dir, "complex_test_mask.png")
    cv2.imwrite(mask_path, mask)
    print(f"Saved complex test mask to {mask_path}")
    
    # Extract polygons from the mask
    print("Extracting polygons from mask...")
    polygons = extract_polygons_from_mask(mask)
    
    # Verify parent-child relationships
    success = verify_parent_child_relationships(polygons)
    
    # Save the polygons to a JSON file
    result = {
        "success": success,
        "polygons": polygons
    }
    
    result_path = os.path.join(output_dir, "complex_test_result.json")
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
                # Add polygon ID as text
                centroid_x = sum(p["x"] for p in points) // len(points)
                centroid_y = sum(p["y"] for p in points) // len(points)
                cv2.putText(vis_mask, polygon.get("id", ""), (centroid_x, centroid_y), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    
    # Draw internal polygons (holes) in red
    for polygon in polygons:
        if polygon.get("type") == "internal":
            points = polygon.get("points", [])
            if points:
                # Convert points to numpy array
                pts = np.array([[p["x"], p["y"]] for p in points], np.int32)
                pts = pts.reshape((-1, 1, 2))
                cv2.polylines(vis_mask, [pts], True, (0, 0, 255), 2)
                # Add polygon ID and parent ID as text
                centroid_x = sum(p["x"] for p in points) // len(points)
                centroid_y = sum(p["y"] for p in points) // len(points)
                cv2.putText(vis_mask, f"{polygon.get('id', '')} -> {polygon.get('parentId', '')}", 
                           (centroid_x, centroid_y), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
    
    # Save the visualization
    vis_path = os.path.join(output_dir, "complex_test_visualization.png")
    cv2.imwrite(vis_path, vis_mask)
    print(f"Saved visualization to {vis_path}")
    
    if success:
        print("Test completed successfully!")
        return 0
    else:
        print("Test failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
