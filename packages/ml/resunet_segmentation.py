#!/usr/bin/env python3
"""
ResUNet Segmentation - Script for segmenting spheroid images using ResUNet.
This script loads a pre-trained ResUNet model and performs segmentation on an input image.
"""

import os
import sys
import json
import argparse
import numpy as np
import cv2
import torch
from collections import OrderedDict
try:
    from extract_polygons import extract_polygons_from_mask
except ImportError:
    # If extract_polygons.py is not available, use built-in function
    print("Warning: extract_polygons module not found, using built-in function")

from ResUnet import ResUNet
import logging

# --- Helper Functions ---
def remove_module_prefix(state_dict):
    """Remove 'module.' prefix from state_dict keys."""
    new_state_dict = OrderedDict()
    for k, v in state_dict.items():
        name = k[7:] if k.startswith("module.") else k
        new_state_dict[name] = v
    return new_state_dict

def load_checkpoint(checkpoint_path, model, device):
    """Load model checkpoint, handling DataParallel prefix."""
    print(f"=> Loading checkpoint from {checkpoint_path}")
    try:
        # Use weights_only=True for security (prevents arbitrary code execution during unpickling)
        checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=True)
        state_dict = checkpoint.get('state_dict', checkpoint)
        state_dict = remove_module_prefix(state_dict)
        model.load_state_dict(state_dict)
        print("=> Checkpoint loaded successfully")
    except FileNotFoundError:
        print(f"Error: Checkpoint file not found at {checkpoint_path}")
        # Try to find the checkpoint in the ML directory
        ml_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ML')
        alt_checkpoint_path = os.path.join(ml_dir, os.path.basename(checkpoint_path))
        print(f"Trying alternative checkpoint path: {alt_checkpoint_path}")

        try:
            checkpoint = torch.load(alt_checkpoint_path, map_location=device, weights_only=True)
            state_dict = checkpoint.get('state_dict', checkpoint)
            state_dict = remove_module_prefix(state_dict)
            model.load_state_dict(state_dict)
            print("=> Checkpoint loaded successfully from alternative path")
        except Exception as e:
            print(f"Error loading checkpoint from alternative path: {e}")
            raise
    except Exception as e:
        print(f"Error loading checkpoint: {e}")
        raise


# Function to preprocess the mask before extracting polygons
def preprocess_mask(mask):
    """
    Preprocess the segmentation mask to clean it up before extracting polygons.

    Args:
        mask: Binary segmentation mask as numpy array

    Returns:
        Preprocessed binary mask
    """
    # Ensure binary mask
    _, binary_mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    # Apply morphological operations to clean up the mask
    kernel = np.ones((3, 3), np.uint8)
    binary_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    binary_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    return binary_mask


# If extract_polygons module was not imported, define the function here
if 'extract_polygons_from_mask' not in globals():
    def extract_polygons_from_mask(mask, min_area=30):
        """Extract polygons from binary mask using contour detection."""
        # Find contours in the binary mask
        contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        polygons = []
        for i, contour in enumerate(contours):
            # Filter out small contours
            area = cv2.contourArea(contour)
            if area < min_area:
                continue

            # Simplify contour to reduce number of points
            epsilon = 0.001 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)

            # Convert to list of points
            points = approx.reshape(-1, 2).tolist()

            # Create polygon object
            polygon = {
                "id": f"polygon_{i}",
                "type": "external",
                "points": points
            }

            polygons.append(polygon)

        return polygons


def parse_args():
    parser = argparse.ArgumentParser(description='Segment spheroid images using ResUNet.')
    parser.add_argument('--image_path', type=str, required=True,
                        help='Path to the input image file.')
    parser.add_argument('--output_path', type=str, required=True,
                        help='Path to save the output JSON file containing segmentation results.')
    parser.add_argument('--checkpoint_path', type=str, required=True,
                        help='Path to the model checkpoint file (.pth).')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Directory to save intermediate outputs like masks and visualizations.')
    parser.add_argument('--model_type', type=str, default='resunet',
                        help='Model type (resunet)')
    return parser.parse_args()


def main():
    # Parse arguments
    args = parse_args()

    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(args.output_path), exist_ok=True)
    os.makedirs(args.output_dir, exist_ok=True)

    # Log the model type being used
    print(f"Using model type: {args.model_type}")

    try:
        # Detect available device (CUDA, MPS, CPU)
        # Check for device preference in environment variables
        device_preference = os.environ.get('DEVICE_PREFERENCE', 'best')
        print(f"Device preference: {device_preference}")

        # Podle požadavku: nejdřív CUDA, pak MPS, pak CPU
        if device_preference == 'best':
            # Automaticky vybrat nejlepší dostupné zařízení
            if torch.cuda.is_available():
                device = torch.device("cuda")
                print(f"Using CUDA device (best available): {torch.cuda.get_device_name(0)}")
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                device = torch.device("mps")
                print("Using MPS device (best available)")
            else:
                device = torch.device("cpu")
                print("Using CPU device (best available)")
        elif device_preference == 'cpu':
            device = torch.device("cpu")
            print("Using CPU device (forced by preference)")
        elif device_preference == 'cuda' and torch.cuda.is_available():
            device = torch.device("cuda")
            print(f"Using CUDA device (by preference): {torch.cuda.get_device_name(0)}")
        elif device_preference == 'mps' and hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            device = torch.device("mps")
            print("Using MPS device (by preference)")
        else:
            # Fallback na CPU, pokud požadované zařízení není dostupné
            device = torch.device("cpu")
            print(f"Requested device '{device_preference}' not available, falling back to CPU")

        # Fix path issues with duplicated 'uploads' prefix
        image_path = args.image_path

        # Handle multiple occurrences of 'uploads/' in the path
        while 'uploads/uploads/' in image_path:
            fixed_path = image_path.replace('uploads/uploads/', 'uploads/')
            print(f"Fixed duplicated uploads path: {image_path} -> {fixed_path}")
            image_path = fixed_path

        # Try to load the image from the fixed path
        print(f"Attempting to load image from: {image_path}")
        image = cv2.imread(image_path)

        # If image is still None, try with server/uploads prefix
        if image is None and not image_path.startswith('server/'):
            server_path = os.path.join('server', image_path)
            print(f"Trying with server/ prefix: {server_path}")
            image = cv2.imread(server_path)

        # If image is still None, try alternative paths
        if image is None:
            print(f"Error: Could not read image from {image_path}", file=sys.stderr)

            # Try alternative paths
            alt_paths = []

            # Extract filename from path
            filename = os.path.basename(image_path)

            # Try to extract project ID from path
            path_parts = image_path.split('/')
            project_id = None
            for part in path_parts:
                if len(part) == 36 and '-' in part:  # Simple UUID check
                    project_id = part
                    break

            # Add alternative paths to try
            if project_id:
                # Try server/uploads/project_id/filename
                alt_paths.append(f"server/uploads/{project_id}/{filename}")
                # Try uploads/project_id/filename
                alt_paths.append(f"uploads/{project_id}/{filename}")
                # Try /uploads/project_id/filename
                alt_paths.append(f"/uploads/{project_id}/{filename}")

            # Try direct filename paths
            alt_paths.append(f"server/uploads/{filename}")
            alt_paths.append(f"uploads/{filename}")
            alt_paths.append(f"/uploads/{filename}")

            # Try each alternative path
            for alt_path in alt_paths:
                print(f"Trying alternative path: {alt_path}")
                image = cv2.imread(alt_path)
                if image is not None:
                    print(f"Successfully loaded image from alternative path: {alt_path}")
                    break

            # If still None after trying all alternatives, return error
            if image is None:
                print(f"Error: Could not read image from any path. Tried: {[image_path] + alt_paths}", file=sys.stderr)
                return 1

        # Convert to RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        original_height, original_width = image.shape[:2]

        # Resize image to model input size
        input_size = (1024, 1024)  # Standard size for ResUNet
        image_resized = cv2.resize(image_rgb, input_size)

        # Normalize and convert to tensor
        image_tensor = torch.from_numpy(image_resized.transpose(2, 0, 1)).float().to(device) / 255.0
        image_tensor = image_tensor.unsqueeze(0)  # Add batch dimension

        # Initialize model
        model = ResUNet(in_channels=3, out_channels=1).to(device)

        # Load checkpoint
        load_checkpoint(args.checkpoint_path, model, device)

        # Set model to evaluation mode
        model.eval()

        # Perform inference
        with torch.no_grad():
            output = model(image_tensor)
            output = torch.sigmoid(output)  # Apply sigmoid to get probability map
            mask = (output > 0.5).float()  # Threshold to get binary mask

        # Convert mask to numpy array
        mask_np = mask.squeeze().cpu().numpy()

        # Resize mask to original image size
        mask_resized = cv2.resize(mask_np, (original_width, original_height), interpolation=cv2.INTER_NEAREST)

        # Convert to uint8 for saving
        mask_uint8 = (mask_resized * 255).astype(np.uint8)

        # Save the mask
        mask_image_path = os.path.join(args.output_dir, 'mask.png')
        if not cv2.imwrite(mask_image_path, mask_uint8):
            print(f"Error writing mask image to {mask_image_path}")
            return 1 # Indicate error

        # Create a visualization (original image with mask overlay)
        overlay = np.zeros((original_height, original_width, 4), dtype=np.uint8)
        for y in range(original_height):
            for x in range(original_width):
                if mask_resized[y, x] > 0:
                    overlay[y, x] = [255, 0, 0, 128]  # Red with 50% opacity

        # Convert original image to RGBA
        image_rgba = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)

        # Overlay the mask on the original image
        for y in range(original_height):
            for x in range(original_width):
                if overlay[y, x, 3] > 0:
                    alpha = overlay[y, x, 3] / 255.0
                    image_rgba[y, x] = [
                        int((1 - alpha) * image_rgba[y, x, 0] + alpha * overlay[y, x, 0]),
                        int((1 - alpha) * image_rgba[y, x, 1] + alpha * overlay[y, x, 1]),
                        int((1 - alpha) * image_rgba[y, x, 2] + alpha * overlay[y, x, 2]),
                        255
                    ]

        # Save the visualization
        vis_path = os.path.join(args.output_dir, 'visualization.png')
        if not cv2.imwrite(vis_path, image_rgba):
            print(f"Error writing visualization image to {vis_path}")
            return 1 # Indicate error

        # Preprocess the mask
        preprocessed_mask = preprocess_mask(mask_uint8)

        # Extract polygons from the preprocessed mask
        polygons = extract_polygons_from_mask(preprocessed_mask)

        # If no polygons found, try with a lower threshold
        if len(polygons) == 0:
            print("No polygons found with standard threshold, trying lower threshold...")
            _, lower_threshold_mask = cv2.threshold(mask_uint8, 50, 255, cv2.THRESH_BINARY)
            preprocessed_lower_mask = preprocess_mask(lower_threshold_mask)
            polygons = extract_polygons_from_mask(preprocessed_lower_mask)

        # Create result data with polygons
        result_data = {
            'image_path': args.image_path,
            'output_path': args.output_path,
            'mask_path': mask_image_path,
            'visualization_path': vis_path,
            'status': 'completed',
            'polygons': polygons,
            'success': True
        }

        # Print the result data as JSON for the parent process
        print(json.dumps(result_data))

        # Save the result data to a file
        with open(args.output_path, 'w') as f:
            json.dump(result_data, f)

        print("Segmentation completed successfully.")
        print(f"Mask saved to: {mask_image_path}")
        print(f"Visualization saved to: {vis_path}")
        print(f"Result data saved to: {args.output_path}")

        return 0
    except torch.cuda.OutOfMemoryError as cuda_error:
        error_message = f"CUDA out of memory error: {cuda_error}. Try using CPU device instead."
        print(error_message, file=sys.stderr)

        # Save detailed error information to the output JSON
        error_data = {
            'image_path': args.image_path,
            'output_path': args.output_path,
            'status': 'failed',
            'error': str(cuda_error),
            'error_type': 'cuda_out_of_memory',
            'recommendation': 'Set DEVICE_PREFERENCE=cpu in environment variables',
            'success': False
        }

        try:
            with open(args.output_path, 'w') as f:
                json.dump(error_data, f)
        except Exception as write_error:
            print(f"Failed to write error data to {args.output_path}: {write_error}", file=sys.stderr)

        import traceback
        traceback.print_exc(file=sys.stderr)
        return 3  # Special return code for CUDA errors

    except (torch.cuda.CudaError, RuntimeError) as device_error:
        # Check if this is a CUDA-related error
        error_str = str(device_error)
        if 'CUDA' in error_str or 'cuda' in error_str:
            error_message = f"CUDA error: {device_error}. Try using CPU device instead."
            error_type = 'cuda_error'
            recommendation = 'Set DEVICE_PREFERENCE=cpu in environment variables'
        else:
            error_message = f"Runtime error: {device_error}"
            error_type = 'runtime_error'
            recommendation = 'Check input data and model compatibility'

        print(error_message, file=sys.stderr)

        # Save detailed error information to the output JSON
        error_data = {
            'image_path': args.image_path,
            'output_path': args.output_path,
            'status': 'failed',
            'error': str(device_error),
            'error_type': error_type,
            'recommendation': recommendation,
            'success': False
        }

        try:
            with open(args.output_path, 'w') as f:
                json.dump(error_data, f)
        except Exception as write_error:
            print(f"Failed to write error data to {args.output_path}: {write_error}", file=sys.stderr)

        import traceback
        traceback.print_exc(file=sys.stderr)
        return 4  # Special return code for device errors

    except Exception as e:
        error_message = f"Segmentation failed for {args.image_path}. Error: {e}"
        print(error_message, file=sys.stderr)

        # Save error information to the output JSON if possible
        error_data = {
            'image_path': args.image_path,
            'output_path': args.output_path,
            'status': 'failed',
            'error': str(e),
            'error_type': 'general_error',
            'success': False
        }

        try:
            with open(args.output_path, 'w') as f:
                json.dump(error_data, f)
        except Exception as write_error:
            print(f"Failed to write error data to {args.output_path}: {write_error}", file=sys.stderr)

        import traceback
        traceback.print_exc(file=sys.stderr)
        return 2  # Return error code


if __name__ == "__main__":
    try:
        # Call the main function and exit with its return code
        sys.exit(main())
    except Exception as e:
        # Print the full traceback to stderr
        import traceback
        print(f"Error: An unexpected error occurred: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)  # Exit with a non-zero code to indicate failure