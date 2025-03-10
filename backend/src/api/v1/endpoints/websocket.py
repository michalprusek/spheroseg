from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from ....infrastructure.websocket import websocket_manager
from ....api.deps import get_current_user
from ....domain.entities.user import User

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        # Validate token and get user
        user = await get_current_user(token)
        await websocket_manager.connect(websocket, user.id)
        
        try:
            while True:
                # Keep connection alive and handle incoming messages
                data = await websocket.receive_text()
                # Process any incoming messages if needed
        except WebSocketDisconnect:
            await websocket_manager.disconnect(websocket)
    except Exception as e:
        await websocket.close(code=1008, reason=str(e))