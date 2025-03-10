import hmac
import hashlib
import json
import aiohttp
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ...domain.entities.webhook import WebhookConfig, WebhookEvent
from ...infrastructure.repositories.webhook import WebhookRepository

class WebhookService:
    def __init__(self):
        self.repository = WebhookRepository()
        self.max_retries = 3

    def create_webhook(
        self,
        db: Session,
        url: str,
        secret: str,
        events: List[str],
        description: Optional[str] = None
    ) -> WebhookConfig:
        webhook = WebhookConfig(
            url=url,
            secret=secret,
            events=events,
            description=description,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        return self.repository.create(db, webhook)

    async def trigger_webhook(
        self,
        db: Session,
        webhook: WebhookConfig,
        event_type: str,
        payload: Dict[str, Any]
    ) -> None:
        if not webhook.is_active or event_type not in webhook.events:
            return

        event = WebhookEvent(
            webhook_id=webhook.id,
            event_type=event_type,
            payload=payload,
            status="pending",
            created_at=datetime.utcnow()
        )
        
        # Vytvoření podpisu
        signature = self._create_signature(webhook.secret, payload)
        
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Event-Type": event_type
        }

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    webhook.url,
                    json=payload,
                    headers=headers,
                    timeout=30
                ) as response:
                    event.status = "success" if response.status == 200 else "failed"
                    event.attempts += 1
                    event.last_attempt = datetime.utcnow()
            except Exception as e:
                event.status = "failed"
                event.attempts += 1
                event.last_attempt = datetime.utcnow()
                
        self.repository.update_event(db, event)

    def _create_signature(self, secret: str, payload: Dict[str, Any]) -> str:
        message = json.dumps(payload, sort_keys=True)
        return hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()