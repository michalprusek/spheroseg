from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import List
import io
import os
import uuid
import logging

from db.database import get_db
from models.models import User, Project, Image, Segmentation, SegmentationStatus
from schemas.schemas import ImageResponse
from services.auth import get_current_active_user
from services.storage import upload_image, get_image_url, get_thumbnail_url, get_segmentation_mask_url, get_object_data
from worker.celery import segment_image

# Initialize logger
logger = logging.getLogger("spheroseg-api")
router = APIRouter(
    prefix="/images",
    tags=["images"]
)

@router.post("/upload", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_image_to_project(
    project_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload an image to a specific project and start the segmentation process.
    """
    # Verify the project exists and belongs to the user
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you don't have access to it"
        )
    
    # Read the file content
    try:
        file_content = await file.read()
        print(f"Read file with size {len(file_content)} bytes")
    except Exception as e:
        print(f"Error reading file: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error reading file: {e}"
        )
    
    # Upload the image to MinIO
    object_name = upload_image(file_content, file.filename)
    
    # Create image record in the database
    db_image = Image(
        filename=file.filename,
        object_name=object_name,
        project_id=project_id
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    
    # Create segmentation record
    db_segmentation = Segmentation(
        image_id=db_image.id,
        status=SegmentationStatus.PENDING
    )
    db.add(db_segmentation)
    db.commit()
    db.refresh(db_segmentation)
    
    # Start the segmentation task asynchronously
    task = segment_image.delay(db_image.id, object_name)
    
    # Update the segmentation record with the task ID
    db_segmentation.task_id = task.id
    db.commit()
    
    # Generate thumbnail URL
    thumbnail_url = get_thumbnail_url(object_name)
    
    # Return the image with presigned URLs and segmentation status
    image_response = {
        "id": db_image.id,
        "filename": db_image.filename,
        "object_name": db_image.object_name,
        "project_id": db_image.project_id,
        "uploaded_at": db_image.uploaded_at,
        "segmentation_status": db_segmentation.status.value,
        "thumbnail_url": thumbnail_url
    }
    
    return image_response

@router.get("/{project_id}", response_model=List[ImageResponse])
async def get_project_images(
    project_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all images for a specific project.
    """
    # Verify the project exists and belongs to the user
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you don't have access to it"
        )
    
    # Get all images for the project
    images = db.query(Image).filter(
        Image.project_id == project_id
    ).offset(skip).limit(limit).all()
    
    # Enrich the images with segmentation status and URLs
    results = []
    for image in images:
        # Get the segmentation status
        segmentation = db.query(Segmentation).filter(
            Segmentation.image_id == image.id
        ).first()
        
        segmentation_status = segmentation.status.value if segmentation else None
        
        # Generate thumbnail URL
        thumbnail_url = get_thumbnail_url(image.object_name)
        
        image_response = {
            "id": image.id,
            "filename": image.filename,
            "object_name": image.object_name,
            "project_id": image.project_id,
            "uploaded_at": image.uploaded_at,
            "segmentation_status": segmentation_status,
            "thumbnail_url": thumbnail_url
        }
        results.append(image_response)
    
    return results

@router.get("/{image_id}/status")
async def get_image_status(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get the current status of an image's segmentation.
    """
    # Get the image and check access
    image = db.query(Image).join(Project).filter(
        Image.id == image_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or you don't have access to it"
        )
    
    # Get the segmentation status
    segmentation = db.query(Segmentation).filter(
        Segmentation.image_id == image.id
    ).first()
    
    if not segmentation:
        return {"status": "unknown"}
    
    return {"status": segmentation.status.value}

@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete an image and its associated segmentation.
    """
    # Get the image and check access
    image = db.query(Image).join(Project).filter(
        Image.id == image_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or you don't have access to it"
        )
    
    # Delete the image (segmentation will cascade delete)
    db.delete(image)
    db.commit()
    
    # Note: In a production application, you would also want to delete the files from MinIO
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{image_id}/url")
async def get_image_url_endpoint(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get URLs for an image and its thumbnail.
    """
    # Get the image and check access
    image = db.query(Image).join(Project).filter(
        Image.id == image_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or you don't have access to it"
        )
    
    # Generate URLs
    try:
        image_url = get_image_url(image.object_name)
        thumbnail_url = get_thumbnail_url(image.object_name)
        
        return {
            "url": image_url,
            "thumbnail": thumbnail_url
        }
    except Exception as e:
        logger.error(f"Error generating URLs for image {image_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating image URLs: {str(e)}"
        )

@router.get("/thumbnail/{object_name}", response_class=Response)
async def get_thumbnail(
    object_name: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a thumbnail directly by its object name.
    This endpoint serves as a proxy to MinIO, allowing direct access to thumbnails.
    """
    try:
        # Get the thumbnail from MinIO
        thumbnail_data = get_object_data("thumbnails", object_name)
        
        # Return the thumbnail with appropriate headers
        # Don't set CORS headers here, let the global CORS middleware handle it
        return Response(
            content=thumbnail_data,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        logger.error(f"Error retrieving thumbnail {object_name}: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=f"Thumbnail not found: {str(e)}"
        )

@router.get("/{image_id}/data", response_class=Response)
async def get_image_data_endpoint(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get image binary data directly.
    """
    # Get the image and check access
    image = db.query(Image).join(Project).filter(
        Image.id == image_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or you don't have access to it"
        )
    
    # Get the image data from MinIO
    try:
        image_data = get_image_data(image.object_name)
        
        if not image_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image data not found"
            )
        
        # Return the image with appropriate headers
        return Response(
            content=image_data,
            media_type="image/jpeg",  # Adjust based on actual image type if needed
            headers={
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        logger.error(f"Error retrieving image data for {image_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving image data: {str(e)}"
        )

# Rest of the file remains unchanged... 