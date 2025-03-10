from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

class DiameterStatistics(BaseModel):
    mean: float
    median: float
    std: float
    min: float
    max: float

class SphereStatistics(BaseModel):
    total_spheres: int
    average_per_image: float
    max_in_single_image: int

class ProcessingStatus(BaseModel):
    completed: int
    failed: int
    pending: int

class ProjectAnalysis(BaseModel):
    total_images: int
    processing_status: ProcessingStatus
    sphere_statistics: SphereStatistics
    diameter_statistics: DiameterStatistics
    distribution: Dict[str, Any]

class ImageAnalysisDetails(BaseModel):
    status: str
    statistics: Optional[Dict[str, Any]]
    error: Optional[str]

class ExportFormat(BaseModel):
    format: str  # "csv", "excel", or "json"
    include_details: bool = False