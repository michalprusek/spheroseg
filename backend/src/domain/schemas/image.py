from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

class ImageBase(BaseModel):
    filename: str
    content_type: str
    size: int

class ImageCreate(ImageBase):
    project_id: int
    storage_path: str

class ImageResponse(ImageBase):
    id: int
    project_id: int
    created_at: datetime
    processing_status: str
    processing_error: Optional[str] = None
    analysis_results: Optional[Dict[str, Any]] = None
    sphere_count: Optional[int] = None
    average_diameter: Optional[float] = None
    download_url: Optional[str] = None

    class Config:
        from_attributes = True