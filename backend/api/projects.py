from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func

from db.database import get_db
from models.models import Project, User, Image, Segmentation
from schemas.schemas import ProjectCreate, ProjectResponse, ProjectDetail, ProjectWithImages
from services.auth import get_current_active_user
from services.storage import get_thumbnail_url

router = APIRouter(
    prefix="/projects",
    tags=["projects"]
)

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new project for the authenticated user.
    """
    db_project = Project(
        name=project.name,
        description=project.description,
        owner_id=current_user.id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/", response_model=List[ProjectDetail])
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all projects for the authenticated user.
    """
    # Query projects with a count of images
    projects_with_counts = db.query(
        Project, 
        func.count(Image.id).label("images_count")
    ).outerjoin(
        Image
    ).filter(
        Project.owner_id == current_user.id
    ).group_by(
        Project.id
    ).offset(skip).limit(limit).all()
    
    # Convert to response model
    results = []
    for project, count in projects_with_counts:
        project_dict = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "owner_id": project.owner_id,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "images_count": count
        }
        results.append(project_dict)
    
    return results

@router.get("/{project_id}", response_model=ProjectWithImages)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific project by ID, including its images.
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Debug prints to diagnose serialization issues
    print(f"Project found: {project.id} - {project.name}")
    
    # Manually construct the response to handle image serialization properly
    formatted_images = []
    if project.images:
        print(f"Project has {len(project.images)} images")
        for idx, img in enumerate(project.images):
            print(f"Image {idx}: id={img.id}, filename={img.filename}, object_name={img.object_name}")
            
            # Get the segmentation status
            segmentation = db.query(Segmentation).filter(
                Segmentation.image_id == img.id
            ).first()
            
            segmentation_status = segmentation.status.value if segmentation else None
            
            # Generate thumbnail URL if needed
            try:
                thumbnail_url = get_thumbnail_url(img.object_name)
            except Exception as e:
                print(f"Error generating thumbnail URL for image {img.id}: {e}")
                thumbnail_url = None
            
            # Create image response object
            image_response = {
                "id": img.id,
                "filename": img.filename,
                "object_name": img.object_name,
                "project_id": img.project_id,
                "uploaded_at": img.uploaded_at,
                "segmentation_status": segmentation_status,
                "thumbnail_url": thumbnail_url
            }
            formatted_images.append(image_response)
    else:
        print("Project has no images")
    
    # Construct project response
    result = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "images_count": len(formatted_images),
        "owner_username": project.owner.username if project.owner else None,
        "images": formatted_images
    }
    
    return result

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_update: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a specific project by ID.
    """
    db_project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Update project fields
    db_project.name = project_update.name
    db_project.description = project_update.description
    
    db.commit()
    db.refresh(db_project)
    return db_project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a specific project by ID.
    """
    db_project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    db.delete(db_project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)