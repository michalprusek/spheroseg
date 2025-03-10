from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from ....infrastructure.database import get_db
from ....application.services.visualization import VisualizationService
from ....domain.entities.user import User
from ....api.deps import get_current_user

router = APIRouter()
visualization_service = VisualizationService()

@router.get("/projects/{project_id}/visualizations")
async def get_project_visualizations(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    if not project_service.has_access(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    
    project = project_service.get_project(db, project_id)
    images = image_service.get_project_images(db, project_id)
    
    return visualization_service.generate_project_visualizations(project, images)

@router.get("/images/{image_id}/visualizations")
async def get_image_visualizations(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    image = image_service.get_image(db, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Obrázek nenalezen")
    
    if not project_service.has_access(db, image.project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    
    if not image.analysis_results or image.processing_status != "completed":
        raise HTTPException(status_code=400, detail="Analýza není dokončena")
    
    diameters = [d["diameter"] for d in image.analysis_results.get("details", [])]
    
    return {
        "diameter_distribution": {
            "histogram": visualization_service.create_histogram(diameters),
            "box_plot": visualization_service.create_box_plot(diameters)
        }
    }