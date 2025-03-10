from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from ....infrastructure.database import get_db
from ....application.services.analysis import AnalysisService
from ....application.services.export import ExportService
from ....domain.schemas.analysis import ProjectAnalysis, ImageAnalysisDetails, ExportFormat
from ....api.deps import get_current_user
from ....domain.entities.user import User

router = APIRouter()
analysis_service = AnalysisService()
export_service = ExportService()

@router.get("/projects/{project_id}/analysis", response_model=ProjectAnalysis)
async def get_project_analysis(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not project_service.has_access(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    
    project = project_service.get_project(db, project_id)
    images = image_service.get_project_images(db, project_id)
    
    return analysis_service.analyze_project_results(project, images)

@router.get("/images/{image_id}/analysis", response_model=ImageAnalysisDetails)
async def get_image_analysis(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    image = image_service.get_image(db, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Obrázek nenalezen")
    
    if not project_service.has_access(db, image.project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    
    return analysis_service.get_image_details(image)

@router.post("/projects/{project_id}/export")
async def export_project_data(
    project_id: int,
    export_format: ExportFormat,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not project_service.has_access(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    
    project = project_service.get_project(db, project_id)
    images = image_service.get_project_images(db, project_id)
    
    export_data = export_service.prepare_project_export(project, images)
    
    if export_format.format == "csv":
        output = export_service.export_to_csv(export_data["images"])
        media_type = "text/csv"
        filename = f"project_{project_id}_analysis.csv"
    elif export_format.format == "excel":
        output = export_service.export_to_excel(export_data["images"])
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"project_{project_id}_analysis.xlsx"
    else:  # json
        return export_data
    
    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )