from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ....infrastructure.database import get_db
from ....application.services.project import ProjectService
from ....domain.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from ....api.deps import get_current_user
from ....domain.entities.user import User

router = APIRouter()
project_service = ProjectService()

@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return project_service.get_user_projects(db, current_user.id, skip, limit)

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return project_service.create_project(db, project, current_user.id)

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nenalezen")
    if not project_service.has_access(project, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nenalezen")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    return project_service.update_project(db, project, project_update)