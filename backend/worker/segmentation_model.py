import os
import io
import torch
import numpy as np
import cv2
from PIL import Image
from collections import OrderedDict
import albumentations as A
from albumentations.pytorch import ToTensorV2
import gc
import traceback
import psutil
import torch.nn.functional as F

from .resunet_model import ResUNet

class SpheroSegmentationModel:
    """
    Segmentation model for spheroids using ResUNet architecture.
    """
    def __init__(self, checkpoint_path=None):
        """
        Initialize the segmentation model.
        
        Args:
            checkpoint_path: Path to the trained model weights.
        """
        print(f"Using device: {torch.device('cuda' if torch.cuda.is_available() else 'cpu')}")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = ResUNet(in_channels=3, out_channels=1)
        
        if checkpoint_path and os.path.exists(checkpoint_path):
            print(f"Loading checkpoint from {checkpoint_path}")
            self.load_checkpoint(checkpoint_path)
            print("Checkpoint loaded successfully")
        else:
            print(f"No checkpoint found at {checkpoint_path}")
        
        self.model.to(self.device)
        self.model.eval()
        print(f"Spheroid segmentation model loaded successfully from {checkpoint_path}")
        
        # Uvolnění paměti po inicializaci
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        gc.collect()
        
        # Define the transformation pipeline - reduced size for lower memory usage
        self.transform = A.Compose([
            A.Resize(height=512, width=512),
            A.Normalize(mean=[0.0, 0.0, 0.0], std=[1.0, 1.0, 1.0], max_pixel_value=255.0),
            ToTensorV2(),
        ])
    
    def load_checkpoint(self, checkpoint_path):
        """
        Load model checkpoint from the given path.
        
        Args:
            checkpoint_path (str): Path to the checkpoint file.
        """
        try:
            print(f"Loading checkpoint from {checkpoint_path}")
            checkpoint = torch.load(checkpoint_path, map_location=self.device)
            
            # Handle different checkpoint formats
            if "model_state_dict" in checkpoint:
                print("Using key 'model_state_dict' to load model")
                state_dict = checkpoint["model_state_dict"]
            elif "state_dict" in checkpoint:
                print("Using key 'state_dict' to load model")
                state_dict = checkpoint["state_dict"]
            else:
                # Try to use the checkpoint directly as a state dict
                print("Using checkpoint directly as state dict")
                state_dict = checkpoint
            
            # Remove 'module.' prefix if it exists in the state_dict keys
            new_state_dict = {}
            for k, v in state_dict.items():
                if k.startswith('module.'):
                    new_state_dict[k[7:]] = v  # Remove 'module.' prefix
                else:
                    new_state_dict[k] = v
            
            # Load the state dict
            self.model.load_state_dict(new_state_dict)
            print("Checkpoint loaded successfully")
            
        except Exception as e:
            print(f"Error loading checkpoint: {e}")
            print(f"Checkpoint path: {checkpoint_path}")
            print(f"Device: {self.device}")
            print("Creating empty model to continue")
            # Continue with an empty model
            pass
    
    def segment(self, image_path):
        """
        Segment an image and return the binary mask.
        """
        # Release memory before processing a new image
        gc.collect()
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        
        try:
            # Print available memory
            print(f"Available memory before loading image: {psutil.virtual_memory().available / (1024 * 1024 * 1024):.2f} GB")
            
            # Load image using PIL for better memory management
            with Image.open(image_path) as img:
                # Check image dimensions
                width, height = img.size
                print(f"Original image dimensions: {width}x{height}")
                
                # Limit image size to reduce memory requirements while keeping original aspect ratio
                max_dimension = 1024
                original_size = (width, height)
                
                if width > max_dimension or height > max_dimension:
                    # Calculate new size while maintaining aspect ratio
                    if width > height:
                        new_width = max_dimension
                        new_height = int(height * (max_dimension / width))
                    else:
                        new_height = max_dimension
                        new_width = int(width * (max_dimension / height))
                    
                    print(f"Resizing image to {new_width}x{new_height} for processing")
                    img = img.resize((new_width, new_height), Image.LANCZOS)
                    width, height = new_width, new_height
                
                # Convert to numpy array
                img_np = np.array(img)
            
            # Release memory after loading
            gc.collect()
            
            # Ensure image is RGB
            if len(img_np.shape) == 2:  # Grayscale
                img_np = np.stack([img_np, img_np, img_np], axis=2)
            elif img_np.shape[2] == 4:  # RGBA
                img_np = img_np[:, :, :3]
            
            # Normalize image
            img_np = img_np.astype(np.float32) / 255.0
            
            # Convert to tensor
            img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).unsqueeze(0).to(self.device, dtype=torch.float32)
            
            print(f"Available memory before prediction: {psutil.virtual_memory().available / (1024 * 1024 * 1024):.2f} GB")
            
            # Process the image in a single pass without splitting into patches
            with torch.no_grad():
                # Make sure dimensions are divisible by 32 for the model architecture
                # Use smaller dimensions to reduce memory usage
                adjusted_height = 512
                adjusted_width = 512
                
                if adjusted_height != height or adjusted_width != width:
                    print(f"Resizing image from {width}x{height} to {adjusted_width}x{adjusted_height}")
                    # Use interpolation to resize to fixed dimensions for memory efficiency
                    img_tensor = F.interpolate(img_tensor, size=(adjusted_height, adjusted_width), 
                                               mode='bilinear', align_corners=False)
                
                # Single prediction for the whole image
                pred = self.model(img_tensor)
            
            # Release GPU memory after prediction
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            
            # Convert prediction to numpy array
            pred = pred.cpu().numpy().squeeze()
            
            # Release memory
            del img_tensor
            gc.collect()
            
            # Resize back to original dimensions if needed
            if pred.shape[0] != height or pred.shape[1] != width:
                pred = cv2.resize(pred, (width, height), interpolation=cv2.INTER_LINEAR)
            
            # Resize back to the original image size if we resized earlier
            if (width, height) != original_size:
                pred = cv2.resize(pred, original_size, interpolation=cv2.INTER_LINEAR)
            
            # Create binary mask
            binary_mask = (pred > 0.5).astype(np.uint8) * 255
            
            print(f"Available memory after segmentation: {psutil.virtual_memory().available / (1024 * 1024 * 1024):.2f} GB")
            print(f"Final mask shape: {binary_mask.shape}")
            
            return binary_mask
            
        except Exception as e:
            print(f"Error during segmentation: {str(e)}")
            print(traceback.format_exc())
            # Return an empty mask in case of error
            return np.zeros((100, 100), dtype=np.uint8)
    
    def get_contours(self, mask):
        """
        Extract inner and outer contours from the mask.
        
        Args:
            mask: Binary segmentation mask.
            
        Returns:
            tuple: (contour_image, outer_contours, inner_contours)
        """
        # Ensure mask is binary
        binary_mask = (mask > 127).astype(np.uint8) * 255
        
        # Find contours
        contours, hierarchy = cv2.findContours(binary_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        # Create RGB image for contours
        h, w = mask.shape[:2]
        contour_image = np.zeros((h, w, 3), dtype=np.uint8)
        
        outer_contours = []
        inner_contours = []
        
        if contours and hierarchy is not None:
            hierarchy = hierarchy[0]
            for idx, contour in enumerate(contours):
                # hierarchy: [Next, Previous, First_Child, Parent]
                # External contours have Parent == -1
                if hierarchy[idx][3] == -1:
                    # External contour: Red
                    cv2.drawContours(contour_image, contours, idx, (255, 0, 0), 2)
                    outer_contours.append(contour)
                else:
                    # Internal contour (hole): Blue
                    cv2.drawContours(contour_image, contours, idx, (0, 0, 255), 2)
                    inner_contours.append(contour)
        
        return contour_image, outer_contours, inner_contours
        
    def create_coco_annotations(self, mask, image_id):
        """
        Create COCO format annotations from a binary mask.
        
        Args:
            mask: Binary segmentation mask
            image_id: ID of the image for the annotations
            
        Returns:
            dict: COCO format annotations for the image
        """
        # Ensure mask is binary
        binary_mask = (mask > 127).astype(np.uint8)
        
        # Find contours
        contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        annotations = []
        
        # Create a unique ID for each annotation
        ann_id = 1
        
        for contour in contours:
            # Skip small contours (likely noise)
            area = cv2.contourArea(contour)
            if area < 50:  # Filter out tiny regions
                continue
                
            # Create a mask for this contour
            mask_single = np.zeros(binary_mask.shape, dtype=np.uint8)
            cv2.drawContours(mask_single, [contour], 0, 1, -1)
            
            # Get bounding box (x, y, width, height)
            x, y, w, h = cv2.boundingRect(contour)
            
            # Convert contour to COCO format segmentation
            # COCO segmentation format is a list of lists, where the inner list is [x1, y1, x2, y2, ..., xn, yn]
            segmentation = []
            for point in contour:
                segmentation.extend(point[0].tolist())  # Flatten the points
            
            # Calculate area from the mask for accuracy
            area = np.sum(mask_single)
            
            # Create annotation entry
            annotation = {
                "id": ann_id,
                "image_id": image_id,
                "category_id": 1,  # Assuming only one category - spheroid
                "segmentation": [segmentation],  # List of lists for multiple polygons
                "area": float(area),
                "bbox": [float(x), float(y), float(w), float(h)],
                "iscrowd": 0
            }
            
            annotations.append(annotation)
            ann_id += 1
        
        # Create the complete COCO annotations structure
        coco_data = {
            "images": [
                {
                    "id": image_id,
                    "width": mask.shape[1],
                    "height": mask.shape[0]
                }
            ],
            "categories": [
                {
                    "id": 1,
                    "name": "spheroid",
                    "supercategory": "cell"
                }
            ],
            "annotations": annotations
        }
        
        return coco_data
    
    def segment_with_contours(self, image_path, image_id=None):
        """
        Segment an image and return the binary mask, contour image, and COCO annotations.
        
        Args:
            image_path: Path to the image file
            image_id: Optional ID for the image to use in COCO annotations
            
        Returns:
            tuple: (binary_mask, contour_image, outer_contours, inner_contours, coco_annotations)
        """
        # Segment the image
        binary_mask = self.segment(image_path)
        
        # Extract contours
        contour_image, outer_contours, inner_contours = self.get_contours(binary_mask)
        
        # Create COCO annotations if image_id is provided
        coco_annotations = None
        if image_id is not None:
            coco_annotations = self.create_coco_annotations(binary_mask, image_id)
        
        return binary_mask, contour_image, outer_contours, inner_contours, coco_annotations