from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class ImageModel(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    filename = Column(String)
    storage_path = Column(String)
    content_type = Column(String)
    size = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Metadata ze zpracování
    processing_status = Column(String, default="pending")  # pending, processing, completed, failed
    processing_error = Column(String, nullable=True)
    analysis_results = Column(JSON, nullable=True)
    
    # Metriky
    sphere_count = Column(Integer, nullable=True)
    average_diameter = Column(Float, nullable=True)
    
    project = relationship("ProjectModel", back_populates="images")