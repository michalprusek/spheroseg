from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from ....infrastructure.database import get_db
from ....application.services.image_processing import ImageProcessor
from ....domain.schemas.image import ImageResponse
from ....infrastructure.storage import StorageService
from ....api.deps import get_current_user
from ....domain.entities.user import User

router = APIRouter()
storage_service = StorageService()
image_processor = ImageProcessor()

@router.post("/{project_id}/upload", response_model=ImageResponse)
async def upload_image(
    project_id: int,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Kontrola přístupu k projektu
    if not project_service.has_access(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    
    # Validace typu souboru
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Nepodporovaný formát souboru")
    
    # Nahrání souboru do MinIO
    storage_path = await storage_service.upload_file(file, project_id)
    
    # Vytvoření záznamu v databázi
    image = image_service.create_image(
        db,
        project_id=project_id,
        filename=file.filename,
        storage_path=storage_path,
        content_type=file.content_type,
        size=file.size
    )
    
    # Spuštění zpracování na pozadí
    background_tasks.add_task(
        image_service.process_image,
        db,
        image.id,
        storage_path
    )
    
    return image

@router.get("/{project_id}/images", response_model=List[ImageResponse])
async def get_project_images(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not project_service.has_access(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    
    images = image_service.get_project_images(db, project_id)
    
    # Přidání URL pro stažení ke každému obrázku
    for image in images:
        image.download_url = storage_service.get_file_url(image.storage_path)
    
    return images

@router.get("/{project_id}/images/{image_id}", response_model=ImageResponse)
async def get_image(
    project_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not project_service.has_access(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")
    
    image = image_service.get_image(db, image_id)
    if not image or image.project_id != project_id:
        raise HTTPException(status_code=404, detail="Obrázek nenalezen")
    
    image.download_url = storage_service.get_file_url(image.storage_path)
    return image