from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import io
import numpy as np
from PIL import Image as PILImage

from db.database import get_db
from models.models import User, Project, Image, Segmentation, SegmentationStatus
from schemas.schemas import SegmentationResponse
from services.auth import get_current_active_user
from services.storage import get_segmentation_mask_data, update_segmentation_mask
from worker.celery import update_segmentation as celery_update_segmentation

router = APIRouter(
    prefix="/segmentation",
    tags=["segmentation"]
)

@router.get("/{image_id}", response_model=SegmentationResponse)
async def get_segmentation_status(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get the segmentation status for an image.
    """
    # Check if the image belongs to the user
    image = db.query(Image).join(Project).filter(
        Image.id == image_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or you don't have access to it"
        )
    
    # Get the segmentation
    segmentation = db.query(Segmentation).filter(
        Segmentation.image_id == image.id
    ).first()
    
    if not segmentation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segmentation not found"
        )
    
    return segmentation

@router.put("/{segmentation_id}/update", status_code=status.HTTP_200_OK)
async def update_segmentation(
    segmentation_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a segmentation mask with a manually edited version.
    """
    # Check if the segmentation belongs to the user
    segmentation = db.query(Segmentation).join(Image).join(Project).filter(
        Segmentation.id == segmentation_id,
        Project.owner_id == current_user.id,
        Segmentation.status == SegmentationStatus.COMPLETED  # Can only update completed segmentations
    ).first()
    
    if not segmentation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segmentation not found, not completed, or you don't have access to it"
        )
    
    # Read the uploaded mask
    mask_content = await file.read()
    
    # Convert to numpy array (assuming PNG binary mask)
    try:
        mask_image = PILImage.open(io.BytesIO(mask_content))
        mask_array = np.array(mask_image)
        
        # Ensure mask is binary (0 or 255)
        mask_array = (mask_array > 127).astype(np.uint8) * 255
        
        # Add dimensions to serialized mask data for reconstruction
        height, width = mask_array.shape[:2]
        serialized_mask = f"{height}x{width}x".encode() + mask_array.tobytes()
        
        # Start a Celery task to update the mask
        celery_update_segmentation.delay(segmentation.id, serialized_mask)
        
        return {"message": "Segmentation update in progress"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mask format: {str(e)}"
        )