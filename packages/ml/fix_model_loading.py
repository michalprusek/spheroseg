#\!/usr/bin/env python3
"""
Fix model loading in ml_service.py
"""

import os
import torch
import logging

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("fix_model_loading")

def fix_state_dict(checkpoint_path):
    logger.info(f"Loading checkpoint from {checkpoint_path}")
    
    # Load checkpoint
    checkpoint = torch.load(checkpoint_path, map_location='cpu')
    state_dict = checkpoint["state_dict"]
    
    # Create new state dict without 'module.' prefix
    new_state_dict = {}
    for key, value in state_dict.items():
        if key.startswith('module.'):
            new_key = key[7:]  # Remove 'module.' prefix
            new_state_dict[new_key] = value
        else:
            new_state_dict[key] = value
    
    # Save fixed checkpoint
    checkpoint["state_dict"] = new_state_dict
    torch.save(checkpoint, checkpoint_path)
    
    logger.info(f"Checkpoint fixed and saved to {checkpoint_path}")

if __name__ == "__main__":
    checkpoint_path = os.environ.get("MODEL_PATH", "checkpoint_epoch_9.pth.tar")
    fix_state_dict(checkpoint_path)
