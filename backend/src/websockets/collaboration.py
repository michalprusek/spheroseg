from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

class CollaborationManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = set()
        self.active_connections[project_id].add(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str):
        self.active_connections[project_id].remove(websocket)
        if not self.active_connections[project_id]:
            del self.active_connections[project_id]

    async def broadcast_annotation(self, project_id: str, data: dict):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id]:
                await connection.send_json(data)

collaboration_manager = CollaborationManager()

async def handle_websocket(websocket: WebSocket, project_id: str):
    await collaboration_manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_json()
            await collaboration_manager.broadcast_annotation(project_id, data)
    except WebSocketDisconnect:
        collaboration_manager.disconnect(websocket, project_id)