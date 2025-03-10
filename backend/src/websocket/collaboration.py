from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
from ..core.auth import get_current_user
from ..infrastructure.models import ProjectModel

class CollaborationManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: int):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = set()
        self.active_connections[project_id].add(websocket)

    async def disconnect(self, websocket: WebSocket, project_id: int):
        self.active_connections[project_id].remove(websocket)
        if not self.active_connections[project_id]:
            del self.active_connections[project_id]

    async def broadcast_update(self, project_id: int, data: dict):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id]:
                await connection.send_json(data)

manager = CollaborationManager()

async def websocket_endpoint(
    websocket: WebSocket,
    project_id: int,
    token: str
):
    user = await get_current_user(token)
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast_update(project_id, {
                "type": "update",
                "user": user.email,
                "data": data
            })
    except WebSocketDisconnect:
        await manager.disconnect(websocket, project_id)