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
from run1.ResUnet import ResUNet  # Ensure this path is correct


def remove_module_prefix(state_dict):
    """
    Removes the 'module.' prefix from state_dict keys if present.
    This is necessary if the model was trained using DataParallel.
    """
    new_state_dict = OrderedDict()
    for k, v in state_dict.items():
        if k.startswith("module."):
            new_state_dict[k[7:]] = v  # remove 'module.' prefix
        else:
            new_state_dict[k] = v
    return new_state_dict


def load_checkpoint(checkpoint_path, model, device):
    """
    Loads the model checkpoint into the provided model.
    Handles checkpoints saved with and without DataParallel.
    """
    print(f"=> Loading checkpoint from {checkpoint_path}")
    checkpoint = torch.load(checkpoint_path, map_location=device)

    if 'state_dict' in checkpoint:
        state_dict = checkpoint['state_dict']
    else:
        state_dict = checkpoint

    # Remove 'module.' prefix if present
    state_dict = remove_module_prefix(state_dict)

    model.load_state_dict(state_dict)
    print("=> Checkpoint loaded successfully")


# ===========================
# Dataset Class
# ===========================
class CarvanaTestDataset(Dataset):
    def __init__(self, dataset_dir, split_file, transform=None):
        """
        Args:
            dataset_dir: Path to the root of the dataset
            split_file: Path to the txt file containing image names
            transform: Albumentations transformations to apply
        """
        self.image_dir = os.path.join(dataset_dir, "images")
        self.mask_dir = os.path.join(dataset_dir, "masks")  # Assuming masks are available for evaluation
        self.transform = transform

        # Load filenames from split file
        with open(split_file, "r") as f:
            filenames = [line.strip() for line in f]

        # Validate files (ensure both image and mask exist)
        self.valid_filenames = []
        for filename in filenames:
            img_path = os.path.join(self.image_dir, filename)
            mask_path = os.path.join(self.mask_dir, filename)
            if os.path.exists(img_path) and os.path.exists(mask_path):
                self.valid_filenames.append(filename)
            else:
                print(f"Warning: Skipping missing file {filename}")

    def __len__(self):
        return len(self.valid_filenames)

    def __getitem__(self, index):
        img_path = os.path.join(self.image_dir, self.valid_filenames[index])
        mask_path = os.path.join(self.mask_dir, self.valid_filenames[index])

        # Load image and mask
        image = cv.imread(img_path)
        mask = cv.imread(mask_path, cv.IMREAD_GRAYSCALE)

        # Validate loading
        if image is None or mask is None:
            raise ValueError(f"Error reading file {self.valid_filenames[index]}")

        # Convert to RGB and adjust mask
        image = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        mask = (mask > 127).astype(np.float32)  # Binary mask adjustment

        if self.transform is not None:
            augmentations = self.transform(image=image, mask=mask)
            image = augmentations["image"]
            mask = augmentations["mask"]

        return image, mask, self.valid_filenames[index]  # Also return filename for saving


# ===========================
# DataLoader Function
# ===========================
def get_test_loader(dataset_dir, batch_size, test_transform, num_workers=4, pin_memory=True):
    """
    Loads the test split from `splits/test.txt`.
    """
    splits_dir = os.path.join(dataset_dir, "splits")
    test_split = os.path.join(splits_dir, "test.txt")

    test_ds = CarvanaTestDataset(dataset_dir=dataset_dir, split_file=test_split, transform=test_transform)

    test_loader = DataLoader(test_ds, batch_size=batch_size, num_workers=num_workers, pin_memory=pin_memory,
                             shuffle=False)

    return test_loader


# ===========================
# Logger Setup
# ===========================
def setup_logger(log_file):
    """
    Sets up the logger to log messages to both console and a file.
    """
    logger = logging.getLogger('InferenceLogger')
    logger.setLevel(logging.INFO)

    # Clear existing handlers to prevent duplicate logs
    if logger.hasHandlers():
        logger.handlers.clear()

    # Create handlers
    c_handler = logging.StreamHandler()
    f_handler = logging.FileHandler(log_file)
    c_handler.setLevel(logging.INFO)
    f_handler.setLevel(logging.INFO)

    # Create formatters and add to handlers
    c_format = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    f_format = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    c_handler.setFormatter(c_format)
    f_handler.setFormatter(f_format)

    # Add handlers to the logger
    logger.addHandler(c_handler)
    logger.addHandler(f_handler)

    return logger


# ===========================
# Main Function
# ===========================
def main():
    # Argument Parsing
    parser = argparse.ArgumentParser(description="Inference Script for Segmentation Model")
    parser.add_argument(
        "--dataset_dir",
        type=str,
        default="/Volumes/T7/Datasets/sféroidy/all_final",
        help="Path to the dataset directory containing images, masks, and splits."
    )
    parser.add_argument(
        "--checkpoint_path",
        type=str,
        default="/Users/michalprusek/PycharmProjects/Výzkumák/test/run1/checkpoint_epoch_9.pth.tar",
        help="Path to the model checkpoint (.pth file)."
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="/Users/michalprusek/PycharmProjects/Výzkumák/test/output",
        help="Directory to save predictions and logs."
    )
    parser.add_argument(
        "--model_type",
        type=str,
        choices=['resunet', 'attentionunet'],
        default='resunet',
        help="Type of model architecture to use."
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=1,
        help="Batch size for inference."
    )
    parser.add_argument(
        "--num_workers",
        type=int,
        default=4,
        help="Number of worker threads for DataLoader."
    )
    args = parser.parse_args()

    DATASET_DIR = args.dataset_dir
    CHECKPOINT_PATH = args.checkpoint_path
    OUTPUT_DIR = args.output_dir
    MODEL_TYPE = args.model_type
    BATCH_SIZE = args.batch_size
    NUM_WORKERS = args.num_workers

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Logger setup
    LOG_FILE = os.path.join(OUTPUT_DIR, "inference.log")
    logger = setup_logger(LOG_FILE)
    logger.info("Starting Inference")

    # Device configuration
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {DEVICE}")

    # Transformations (should match those used during training)
    IMAGE_HEIGHT = 1024  # Adjust if different
    IMAGE_WIDTH = 1024   # Adjust if different
    test_transform = A.Compose(
        [
            A.Resize(height=IMAGE_HEIGHT, width=IMAGE_WIDTH),
            A.Normalize(mean=[0.0, 0.0, 0.0], std=[1.0, 1.0, 1.0], max_pixel_value=255.0),
            ToTensorV2(),
        ],
    )

    # DataLoader
    test_loader = get_test_loader(
        dataset_dir=DATASET_DIR,
        batch_size=BATCH_SIZE,
        test_transform=test_transform,
        num_workers=NUM_WORKERS,
        pin_memory=True
    )
    logger.info(f"Number of test samples: {len(test_loader.dataset)}")


    model = ResUNet().to(DEVICE)

    # Load checkpoint
    load_checkpoint(CHECKPOINT_PATH, model, DEVICE)

    # If using DataParallel (only applicable if multiple GPUs are available)
    if torch.cuda.device_count() > 1:
        logger.info(f"Using {torch.cuda.device_count()} GPUs for inference")
        model = nn.DataParallel(model)

    # Combined Inference: Evaluate IoU and Save Predictions
    logger.info("Starting combined evaluation and prediction saving")

    model.eval()
    total_iou = 0.0
    count = 0


    preds_folder = os.path.join(OUTPUT_DIR, "preds")
    os.makedirs(preds_folder, exist_ok=True)

    with torch.no_grad():
        for x, y, filenames in tqdm(test_loader, desc="Processing"):
            x = x.to(DEVICE)
            y = y.to(DEVICE).unsqueeze(1)  # Ensure mask has shape [B, 1, H, W]
            preds = torch.sigmoid(model(x))
            thresholded_preds = (preds > 0.5)  # Boolean tensor

            # Ensure ground truth masks are boolean
            y_bool = y.bool()

            # Compute IoU using logical operations
            intersection = torch.logical_and(thresholded_preds, y_bool).sum(dim=(1, 2, 3))
            union = torch.logical_or(thresholded_preds, y_bool).sum(dim=(1, 2, 3))
            iou = (intersection + 1e-6) / (union + 1e-6)
            total_iou += iou.sum().item()
            count += x.size(0)

            # Save predictions with contours
            for i in range(thresholded_preds.shape[0]):
                image = x[i].cpu().numpy().transpose(1, 2, 0)
                image = (image * 255).astype(np.uint8)
                pred_mask = thresholded_preds[i, 0].cpu().numpy().astype(np.uint8)
                filename = filenames[i]

                # Find contours
                contours, hierarchy = cv.findContours(pred_mask, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE)

                # Draw contours
                contour_image = image.copy()
                if hierarchy is not None:
                    hierarchy = hierarchy[0]
                    for idx, contour in enumerate(contours):
                        # hierarchy: [Next, Previous, First_Child, Parent]
                        # External contours have Parent == -1
                        if hierarchy[idx][3] == -1:
                            # External contour: Red
                            cv.drawContours(contour_image, contours, idx, (255, 0, 0), 2)
                        else:
                            # Internal contour (hole): Blue
                            cv.drawContours(contour_image, contours, idx, (0, 0, 255), 2)

                # Save the image
                save_path = os.path.join(preds_folder, f"{filename}.jpg")
                cv.imwrite(save_path, cv.cvtColor(contour_image, cv.COLOR_RGB2BGR))

    average_iou = total_iou / count
    logger.info(f"Average IoU on Test Set: {average_iou:.4f}")
    logger.info("Inference and prediction saving completed successfully.")

# ===========================
# Execute Main
# ===========================
if __name__ == "__main__":
    main()
