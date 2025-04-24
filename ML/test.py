# inference.py

import numpy as np
import cv2 as cv
import albumentations as A
from albumentations.pytorch import ToTensorV2
from tqdm import tqdm
import torch
import torch.nn as nn
import os
from torch.utils.data import DataLoader, Dataset
import argparse
import logging
from collections import OrderedDict
# Ensure this import works relative to where the script is run
from run1.ResUnet import ResUNet


# --- Helper Functions (remove_module_prefix, load_checkpoint, setup_logger) ---
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
        checkpoint = torch.load(checkpoint_path, map_location=device)
        state_dict = checkpoint.get('state_dict', checkpoint)
        state_dict = remove_module_prefix(state_dict)
        model.load_state_dict(state_dict)
        print("=> Checkpoint loaded successfully")
    except FileNotFoundError:
        print(f"Error: Checkpoint file not found at {checkpoint_path}")
        raise
    except Exception as e:
        print(f"Error loading checkpoint: {e}")
        raise

def setup_logger(log_file):
    """Set up logger for console and file output."""
    logger = logging.getLogger('InferenceLogger')
    logger.setLevel(logging.INFO)
    if logger.hasHandlers():
        logger.handlers.clear()
    # Console handler
    c_handler = logging.StreamHandler()
    c_handler.setLevel(logging.INFO)
    c_format = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    c_handler.setFormatter(c_format)
    logger.addHandler(c_handler)
    # File handler
    try:
        f_handler = logging.FileHandler(log_file)
        f_handler.setLevel(logging.INFO)
        f_format = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        )
        f_handler.setFormatter(f_format)
        logger.addHandler(f_handler)
    except Exception as e:
        print(f"Warning: Could not set up file logger at {log_file}. Error: {e}")
    return logger
# --- End Helper Functions ---


# ============================
# Single Image Prediction
# ============================
def predict_single_image(model, image_path, output_path, transform, device, logger):
    """Segment single image and save result."""
    logger.info(f"Processing image: {image_path}")
    image = cv.imread(image_path)
    if image is None:
        logger.error(f"Failed to load image: {image_path}")
        return

    original_height, original_width = image.shape[:2]
    image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)

    if transform:
        augmented = transform(image=image_rgb)
        # Add batch dim, send to device
        image_tensor = augmented["image"].unsqueeze(0).to(device)
    else:
        image_tensor = torch.from_numpy(
            image_rgb.transpose(2, 0, 1)
        ).float().unsqueeze(0).to(device) / 255.0

    model.eval()
    with torch.no_grad():
        preds = torch.sigmoid(model(image_tensor))
        preds = (preds > 0.5).float()  # Threshold

    # Process prediction: numpy, resize, save
    pred_mask_np = preds.squeeze(0).squeeze(0).cpu().numpy()
    pred_mask_resized = cv.resize(
        pred_mask_np, (original_width, original_height),
        interpolation=cv.INTER_NEAREST
    )
    pred_mask_uint8 = (pred_mask_resized * 255).astype(np.uint8)

    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        if cv.imwrite(output_path, pred_mask_uint8):
            logger.info(f"Prediction saved to: {output_path}")
        else:
            logger.error(f"Failed to save prediction to: {output_path}")
    except Exception as e:
        logger.error(f"Error saving prediction {output_path}: {e}")


# ============================
# Dataset-Based Prediction
# ============================
class CarvanaTestDataset(Dataset):
    """Dataset for batch processing mode."""
    def __init__(self, dataset_dir, split_file, transform=None):
        self.image_dir = os.path.join(dataset_dir, "images")
        self.transform = transform
        try:
            with open(split_file, "r") as f:
                filenames = [line.strip() for line in f]
        except FileNotFoundError:
            print(f"Error: Split file not found at {split_file}")
            self.valid_filenames = []
            return

        self.valid_filenames = []
        for filename in filenames:
            img_path = os.path.join(self.image_dir, filename)
            if os.path.exists(img_path):
                self.valid_filenames.append(filename)
            else:
                print(f"Warning: Skipping missing image file {img_path}")

    def __len__(self):
        return len(self.valid_filenames)

    def __getitem__(self, index):
        img_path = os.path.join(self.image_dir, self.valid_filenames[index])
        image = cv.imread(img_path)
        if image is None:
            print(f"Error reading image {img_path}")
            # Return None for image and shape to filter later
            return None, self.valid_filenames[index], (0, 0)

        image = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        original_shape = image.shape[:2]  # height, width

        if self.transform:
            augmented = self.transform(image=image)
            image = augmented["image"]
        else:
            # Basic tensor conversion if no transform
            image = torch.from_numpy(image.transpose(2, 0, 1)).float() / 255.0

        return image, self.valid_filenames[index], original_shape

def get_test_loader(dataset_dir, batch_size, test_transform, num_workers=0):
    """Create DataLoader for batch mode."""
    splits_dir = os.path.join(dataset_dir, "splits")
    test_split = os.path.join(splits_dir, "test.txt")
    test_ds = CarvanaTestDataset(
        dataset_dir=dataset_dir, split_file=test_split, transform=test_transform
    )
    # Use default pin_memory=False if num_workers is 0
    pin = torch.cuda.is_available() and num_workers > 0
    test_loader = DataLoader(
        test_ds, batch_size=batch_size, num_workers=num_workers,
        pin_memory=pin, shuffle=False
    )
    return test_loader

def predict_batch(model, loader, output_dir, device, logger):
    """Segment batch of images from DataLoader."""
    model.eval()
    loop = tqdm(loader, desc="Batch Inference")

    for batch_idx, batch_data in enumerate(loop):
        # Filter out items where image loading failed
        valid_items = [
            (data, fname, shape)
            for data, fname, shape in zip(*batch_data)
            if data is not None
        ]
        if not valid_items:
            logger.warning(f"Skipping batch {batch_idx} due to loading errors.")
            continue

        # Unzip valid items and stack tensors
        images, filenames, original_shapes = zip(*valid_items)
        images_tensor = torch.stack(images).to(device)

        with torch.no_grad():
            preds = torch.sigmoid(model(images_tensor))
            preds = (preds > 0.5).float()  # Threshold

        # Save predictions for valid items
        for i, filename in enumerate(filenames):
            pred_mask_np = preds[i].squeeze(0).cpu().numpy()
            original_height, original_width = original_shapes[i]

            pred_mask_resized = cv.resize(
                pred_mask_np, (original_width, original_height),
                interpolation=cv.INTER_NEAREST
            )
            pred_mask_uint8 = (pred_mask_resized * 255).astype(np.uint8)

            output_filename = os.path.splitext(filename)[0] + "_pred.png"
            output_path = os.path.join(output_dir, output_filename)

            try:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                if not cv.imwrite(output_path, pred_mask_uint8):
                    logger.error(
                        f"Failed to save pred for {filename} to {output_path}"
                    )
            except Exception as e:
                logger.error(f"Error saving prediction {output_path}: {e}")

    logger.info(f"Batch inference complete. Predictions saved in {output_dir}")


# ============================
# Main Execution Logic
# ============================
def main():
    parser = argparse.ArgumentParser(description="Segmentation Inference Script")
    # Mode arguments
    parser.add_argument(
        "--image_path", type=str, default=None,
        help="Path to single input image (activates single mode)."
    )
    parser.add_argument(
        "--output_path", type=str, default=None,
        help="Path to save single prediction mask (activates single mode)."
    )
    parser.add_argument(
        "--dataset_dir", type=str, default=None,
        help="Path to dataset directory (activates batch mode)."
    )
    # Common arguments
    parser.add_argument(
        "--checkpoint_path", type=str, required=True,
        help="Path to model checkpoint (.pth.tar or .pth)."
    )
    parser.add_argument(
        "--output_dir", type=str, default="./output",
        help="Directory for logs and batch predictions."
    )
    parser.add_argument(
        "--model_type", type=str, choices=['resunet'], default='resunet',
        help="Model architecture type."
    )
    # Batch mode specific arguments
    parser.add_argument(
        "--batch_size", type=int, default=1,
        help="Batch size for dataset mode."
    )
    parser.add_argument(
        "--num_workers", type=int, default=0,
        help="DataLoader workers (0 recommended unless Linux/GPU)."
    )
    args = parser.parse_args()

    # Validate arguments and determine mode
    is_single = args.image_path and args.output_path
    is_batch = args.dataset_dir
    if not is_single and not is_batch:
        parser.error(
            "Mode unclear: Provide (--image_path, --output_path) or --dataset_dir."
        )
    if is_single and is_batch:
        parser.error(
            "Mode conflict: Provide args for single OR batch mode, not both."
        )
    if is_single and not os.path.exists(args.image_path):
        parser.error(f"Input image not found: {args.image_path}")
    if not os.path.exists(args.checkpoint_path):
        parser.error(f"Checkpoint file not found: {args.checkpoint_path}")

    # Setup logging (uses output_dir)
    os.makedirs(args.output_dir, exist_ok=True)
    log_file = os.path.join(args.output_dir, "inference.log")
    logger = setup_logger(log_file)
    logger.info(f"Starting Inference. Args: {vars(args)}")

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {DEVICE}")

    # Transformations
    IMAGE_HEIGHT = 1024
    IMAGE_WIDTH = 1024
    transform = A.Compose([
        A.Resize(height=IMAGE_HEIGHT, width=IMAGE_WIDTH),
        A.Normalize(
            mean=[0.0, 0.0, 0.0], std=[1.0, 1.0, 1.0], max_pixel_value=255.0
        ),
        ToTensorV2(),
    ])

    # Load Model
    try:
        if args.model_type == 'resunet':
            model = ResUNet().to(DEVICE)
        else:
            raise ValueError(f"Unsupported model type: {args.model_type}")
        load_checkpoint(args.checkpoint_path, model, DEVICE)
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return  # Exit if model loading fails

    if torch.cuda.device_count() > 1 and not isinstance(model, nn.DataParallel):
        logger.info(f"Using {torch.cuda.device_count()} GPUs with DataParallel.")
        model = nn.DataParallel(model)

    # Execute based on mode
    if is_single:
        logger.info("Running in single image prediction mode.")
        predict_single_image(
            model=model, image_path=args.image_path,
            output_path=args.output_path, transform=transform,
            device=DEVICE, logger=logger
        )
    elif is_batch:
        logger.info("Running in batch dataset prediction mode.")
        try:
            test_loader = get_test_loader(
                dataset_dir=args.dataset_dir, batch_size=args.batch_size,
                test_transform=transform, num_workers=args.num_workers
            )
            if not test_loader.dataset or len(test_loader.dataset) == 0:
                logger.error("Dataset is empty or failed to load. Exiting.")
                return
            logger.info(f"Test samples: {len(test_loader.dataset)}")

            predict_batch(
                model=model, loader=test_loader, output_dir=args.output_dir,
                device=DEVICE, logger=logger
            )
        except Exception as e:
             logger.error(f"Error during batch processing: {e}", exc_info=True)

    logger.info("Inference finished.")


if __name__ == "__main__":
    main()
