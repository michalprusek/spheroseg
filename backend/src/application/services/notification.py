from typing import Dict, Any, List
from datetime import datetime
from ...infrastructure.websocket import websocket_manager
from ...domain.entities.user import User
from ...domain.entities.image import Image
from ...domain.entities.project import Project

class NotificationService:
    @staticmethod
    async def notify_processing_status(image: Image, status: str, details: Dict[str, Any] = None):
        message = {
            "type": "processing_status",
            "image_id": image.id,
            "project_id": image.project_id,
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
            "details": details or {}
        }
        
        # Notifikuj vlastníka projektu a spolupracovníky
        project = image.project
        await websocket_manager.send_personal_message(message, project.owner_id)
        for collaborator in project.collaborators:
            await websocket_manager.send_personal_message(message, collaborator.id)

    @staticmethod
    async def notify_analysis_complete(image: Image, results: Dict[str, Any]):
        message = {
            "type": "analysis_complete",
            "image_id": image.id,
            "project_id": image.project_id,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "sphere_count": results.get("sphere_count"),
                "average_diameter": results.get("average_diameter")
            }
        }
        
        await websocket_manager.send_personal_message(message, image.project.owner_id)
        for collaborator in image.project.collaborators:
            await websocket_manager.send_personal_message(message, collaborator.id)

    @staticmethod
    async def notify_project_update(project: Project, update_type: str, details: Dict[str, Any] = None):
        message = {
            "type": "project_update",
            "project_id": project.id,
            "update_type": update_type,
            "timestamp": datetime.utcnow().isoformat(),
            "details": details or {}
        }
        
        await websocket_manager.send_personal_message(message, project.owner_id)
        for collaborator in project.collaborators:
            await websocket_manager.send_personal_message(message, collaborator.id)