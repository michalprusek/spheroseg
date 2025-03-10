from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from ....domain.schemas.webhook import WebhookCreate, WebhookResponse
from ....application.services.webhook import WebhookService
from ....infrastructure.database import get_db
from ....core.auth import get_current_user

router = APIRouter()

@router.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(
    webhook_data: WebhookCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    webhook_service: WebhookService = Depends()
):
    """Vytvoření nového webhoku"""
    return webhook_service.create_webhook(
        db,
        url=webhook_data.url,
        secret=webhook_data.secret,
        events=webhook_data.events,
        description=webhook_data.description
    )

@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    webhook_service: WebhookService = Depends()
):
    """Seznam všech webhooků"""
    return webhook_service.get_webhooks(db)

@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    webhook_service: WebhookService = Depends()
):
    """Smazání webhoku"""
    webhook_service.delete_webhook(db, webhook_id)
    return {"status": "success"}

@router.get("/webhooks/{webhook_id}/events")
async def get_webhook_events(
    webhook_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    webhook_service: WebhookService = Depends()
):
    """Seznam událostí pro webhook"""
    return webhook_service.get_webhook_events(db, webhook_id)