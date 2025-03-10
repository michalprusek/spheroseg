from datetime import datetime
from typing import Dict, Any
from ...domain.entities.user import User
from ...domain.entities.annotation import Annotation
from ...infrastructure.websocket_manager import WebSocketManager
from ...infrastructure.repositories.project import ProjectRepository

class CollaborationService:
    def __init__(self):
        self.project_repo = ProjectRepository()

    async def broadcast_cursor_position(
        self,
        ws_manager: WebSocketManager,
        user: User,
        project_id: int,
        position: Dict[str, Any]
    ):
        message = {
            "type": "cursor_update",
            "user": {
                "id": user.id,
                "name": user.full_name
            },
            "position": position,
            "timestamp": datetime.utcnow().isoformat()
        }
        await ws_manager.broadcast_to_project(project_id, message, exclude_user=user.id)

    async def handle_annotation_update(
        self,
        ws_manager: WebSocketManager,
        user: User,
        project_id: int,
        annotation_data: Dict[str, Any]
    ):
        # Uložení anotace do databáze
        annotation = Annotation(
            image_id=annotation_data["image_id"],
            user_id=user.id,
            data=annotation_data["data"],
            created_at=datetime.utcnow()
        )
        
        message = {
            "type": "annotation_update",
            "user": {
                "id": user.id,
                "name": user.full_name
            },
            "annotation": annotation_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await ws_manager.broadcast_to_project(project_id, message)

    async def broadcast_chat_message(
        self,
        ws_manager: WebSocketManager,
        user: User,
        project_id: int,
        message_text: str
    ):
        message = {
            "type": "chat_message",
            "user": {
                "id": user.id,
                "name": user.full_name
            },
            "message": message_text,
            "timestamp": datetime.utcnow().isoformat()
        }
        await ws_manager.broadcast_to_project(project_id, message)