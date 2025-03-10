from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Dict, Any
from ....domain.schemas.batch import BatchJobCreate, BatchJobStatus
from ....application.services.batch_processing import BatchProcessingService
from ....core.auth import get_current_user

router = APIRouter()

@router.post("/batch", response_model=BatchJobStatus)
async def create_batch_job(
    job_data: BatchJobCreate,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    batch_service: BatchProcessingService = Depends()
):
    """Vytvoření nové dávkové úlohy"""
    batch_job = await batch_service.create_batch_job(
        job_data.images,
        job_data.parameters
    )
    return {"job_id": batch_job.id, "status": "pending"}

@router.get("/batch/{job_id}/status", response_model=BatchJobStatus)
async def get_batch_status(
    job_id: str,
    batch_service: BatchProcessingService = Depends()
):
    """Získání stavu dávkové úlohy"""
    return await batch_service.get_batch_job_status(job_id)

@router.get("/batch/{job_id}/results")
async def get_batch_results(
    job_id: str,
    batch_service: BatchProcessingService = Depends()
):
    """Získání výsledků dávkové úlohy"""
    batch_job = await batch_service.get_batch_job(job_id)
    if not batch_job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    
    return await batch_service.aggregate_results(batch_job)