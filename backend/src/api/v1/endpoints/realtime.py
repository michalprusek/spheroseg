from fastapi import APIRouter, WebSocket, Depends, WebSocketDisconnect
from ....infrastructure.websocket_manager import websocket_manager
from ....core.auth import get_current_user_ws
from ....application.services.collaboration import CollaborationService
from typing import Dict, Any

router = APIRouter()
collaboration_service = CollaborationService()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    current_user = Depends(get_current_user_ws)
):
    await websocket_manager.connect(websocket, current_user)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Zpracování různých typů real-time událostí
            if data["type"] == "cursor_position":
                await collaboration_service.broadcast_cursor_position(
                    websocket_manager,
                    current_user,
                    data["project_id"],
                    data["position"]
                )
            
            elif data["type"] == "annotation":
                await collaboration_service.handle_annotation_update(
                    websocket_manager,
                    current_user,
                    data["project_id"],
                    data["annotation"]
                )
            
            elif data["type"] == "chat_message":
                await collaboration_service.broadcast_chat_message(
                    websocket_manager,
                    current_user,
                    data["project_id"],
                    data["message"]
                )
                
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)