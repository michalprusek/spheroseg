#!/usr/bin/env python3
"""
Script to extract polygons from a segmentation mask.
Handles hierarchical contours including holes in spheroids.
"""

import cv2
import json
import sys
import os
import uuid


def extract_polygons_from_mask(mask_path, min_area=100):
    """
    Extract polygons from a binary segmentation mask with proper hierarchy.

    Args:
        mask_path: Path to the segmentation mask image or numpy array
        min_area: Minimum contour area to consider

    Returns:
        List of polygons with proper parent-child relationships
    """
    # Handle both file paths and numpy arrays
    if isinstance(mask_path, str):
        # Read the mask from file
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            print(f"Error: Could not read mask from {mask_path}",
                  file=sys.stderr)
            return []
    else:
        # Assume it's already a numpy array
        mask = mask_path

    # Ensure binary mask
    _, binary_mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    # Find contours with hierarchical information
    # Use CHAIN_APPROX_NONE to get all contour points without approximation
    contours, hierarchy = cv2.findContours(
        binary_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE
    )

    # Define colors for different polygons
    colors = [
        "#FF5733", "#33FF57", "#3357FF", "#F033FF", "#FF33F0",
        "#33FFF0", "#F0FF33", "#FF3333", "#33FF33", "#3333FF"
    ]

    # Create a structured result with proper hierarchy
    result_polygons = []

    # Process contour hierarchy
    if hierarchy is not None and len(hierarchy) > 0:
        # Create a map of parent-child relationships
        parent_child_map = {}
        for i, h in enumerate(hierarchy[0]):
            parent_idx = h[3]  # Parent index is in the 4th position
            if parent_idx != -1:  # Has a parent
                if parent_idx not in parent_child_map:
                    parent_child_map[parent_idx] = []
                parent_child_map[parent_idx].append(i)

        # Process external contours (those without parents)
        for i, contour in enumerate(contours):
            if hierarchy[0][i][3] == -1:  # No parent = external contour
                # Filter small contours
                area = cv2.contourArea(contour)
                if area < min_area:
                    continue

                # Use the original contour without approximation
                # Convert to list of [x, y] points
                points = []
                for point in contour:
                    x, y = point[0]
                    points.append({"x": int(x), "y": int(y)})

                # Generate a unique ID for this polygon
                polygon_id = f"polygon-{str(uuid.uuid4())[:8]}"

                # Create polygon object with a color from our palette
                polygon = {
                    "id": polygon_id,
                    "points": points,
                    "type": "external",
                    "class": "spheroid",
                    "color": colors[i % len(colors)],
                    "holes": []  # Initialize holes array
                }

                # Add holes (children) to this polygon
                if i in parent_child_map:
                    for child_idx in parent_child_map[i]:
                        child_contour = contours[child_idx]
                        child_area = cv2.contourArea(child_contour)
                        # Lower threshold for holes
                        if child_area < min_area / 2:
                            continue

                        # Use the original contour without approximation
                        # Convert to list of [x, y] points
                        child_points = []
                        for point in child_contour:
                            x, y = point[0]
                            child_points.append({"x": int(x), "y": int(y)})

                        # Create hole polygon with reference to parent
                        hole = {
                            "id": f"hole-{str(uuid.uuid4())[:8]}",
                            "points": child_points,
                            "type": "internal",
                            "parentId": polygon_id,
                            "class": "hole",
                            "color": colors[(child_idx + 5) % len(colors)]
                        }

                        # Add hole to parent's holes array
                        polygon["holes"].append(hole)

                # Add the polygon to our result
                result_polygons.append(polygon)
    else:
        # If no hierarchy, process all contours as external
        for i, contour in enumerate(contours):
            # Filter small contours
            area = cv2.contourArea(contour)
            if area < min_area:
                continue

            # Use the original contour without approximation
            # Convert to list of [x, y] points
            points = []
            for point in contour:
                x, y = point[0]
                points.append({"x": int(x), "y": int(y)})

            # Create polygon object with a color from our palette
            polygon = {
                "id": f"polygon-{str(uuid.uuid4())[:8]}",
                "points": points,
                "type": "external",
                "class": "spheroid",
                "color": colors[i % len(colors)],
                "holes": []  # Empty holes array
            }

            result_polygons.append(polygon)

    # Process the result to create a flat list with proper references
    flat_polygons = []
    for polygon in result_polygons:
        # Create a copy of the polygon without the holes array
        main_polygon = polygon.copy()
        holes = main_polygon.pop("holes", [])
        flat_polygons.append(main_polygon)

        # Add all holes as separate polygons in the flat list
        flat_polygons.extend(holes)

    return flat_polygons


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_polygons.py <mask_path> [output_path]",
              file=sys.stderr)
        sys.exit(1)

    mask_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    polygons = extract_polygons_from_mask(mask_path)

    # Log the number of polygons found
    print(f"Found {len(polygons)} polygons in the mask")

    # Count external and internal polygons
    external_count = sum(1 for p in polygons if p.get("type") == "external")
    internal_count = sum(1 for p in polygons if p.get("type") == "internal")
    print(f"External polygons: {external_count}, "
          f"Internal polygons (holes): {internal_count}")

    result = {
        "success": True,
        "polygons": polygons
    }

    # Print to stdout
    print(json.dumps(result))

    # Save to file if output path is provided
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(result, f)


if __name__ == "__main__":
    main()
