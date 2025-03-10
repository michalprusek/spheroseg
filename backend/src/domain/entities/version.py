from datetime import datetime
from pydantic import BaseModel
from typing import Dict, Any, Optional

class Version(BaseModel):
    id: str
    project_id: str
    created_by: str
    created_at: datetime
    description: Optional[str]
    parameters: Dict[str, Any]
    results: Dict[str, Any]
    parent_version_id: Optional[str]