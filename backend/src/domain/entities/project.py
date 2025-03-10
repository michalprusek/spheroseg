from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class Project(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    owner_id: int
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()
    collaborators: List[int] = []

    class Config:
        from_attributes = True