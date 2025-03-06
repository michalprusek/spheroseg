from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import List
import io

from db.database import get_db
from models.models import User, Project, Image, Segmentation, SegmentationStatus
from schemas.schemas import ImageResponse
from services.auth import get_current_active_user
from services.storage import upload_image, get_image_url, get_thumbnail_url, get_segmentation_mask_url
from worker.celery import segment_image

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

# Rest of the file remains unchanged... 