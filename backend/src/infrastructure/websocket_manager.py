from fastapi import WebSocket
from typing import Dict, Set, Any
import json
import asyncio
from ..domain.entities.user import User

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self.user_sessions: Dict[WebSocket, User] = {}

    async def connect(self, websocket: WebSocket, user: User):
        await websocket.accept()
        if user.id not in self.active_connections:
            self.active_connections[user.id] = set()
        self.active_connections[user.id].add(websocket)
        self.user_sessions[websocket] = user

    async def disconnect(self, websocket: WebSocket):
        user = self.user_sessions.get(websocket)
        if user:
            self.active_connections[user.id].remove(websocket)
            if not self.active_connections[user.id]:
                del self.active_connections[user.id]
        if websocket in self.user_sessions:
            del self.user_sessions[websocket]

    async def send_personal_message(self, message: Dict[str, Any], user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    await self.disconnect(connection)

    async def broadcast_to_project(self, project_id: int, message: Dict[str, Any], exclude_user: int = None):
        for user_id, connections in self.active_connections.items():
            if user_id != exclude_user:
                for connection in connections:
                    try:
                        await connection.send_json({
                            "type": "project_update",
                            "project_id": project_id,
                            **message
                        })
                    except:
                        await self.disconnect(connection)

websocket_manager = WebSocketManager()