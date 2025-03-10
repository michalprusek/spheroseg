from fastapi import APIRouter, Depends, HTTPException
from typing import List
from ....domain.entities.annotation import Annotation
from ....application.services.annotation_service import AnnotationService
from ....core.auth import get_current_user

router = APIRouter()

@router.post("/{image_id}/annotations")
async def create_annotation(
    image_id: str,
    annotation: Annotation,
    current_user = Depends(get_current_user),
    annotation_service: AnnotationService = Depends()
):
    """Vytvoření nové anotace pro obrázek"""
    return await annotation_service.create_annotation(image_id, annotation, current_user)

@router.get("/{image_id}/annotations")
async def get_annotations(
    image_id: str,
    current_user = Depends(get_current_user),
    annotation_service: AnnotationService = Depends()
) -> List[Annotation]:
    """Získání všech anotací pro daný obrázek"""
    return await annotation_service.get_annotations(image_id)

@router.put("/{image_id}/annotations/{annotation_id}")
async def update_annotation(
    image_id: str,
    annotation_id: str,
    annotation: Annotation,
    current_user = Depends(get_current_user),
    annotation_service: AnnotationService = Depends()
):
    """Aktualizace existující anotace"""
    return await annotation_service.update_annotation(annotation_id, annotation, current_user)