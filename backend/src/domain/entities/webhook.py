from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, HttpUrl

class WebhookConfig(BaseModel):
    url: HttpUrl
    secret: str
    events: List[str]
    is_active: bool = True
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class WebhookEvent(BaseModel):
    id: str
    webhook_id: str
    event_type: str
    payload: dict
    status: str
    attempts: int = 0
    last_attempt: Optional[datetime] = None
    created_at: datetime