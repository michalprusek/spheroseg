from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid
from datetime import datetime

from db.database import Base

class SegmentationStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    SEGMENTED = "segmented"  # Add a new status for images with segmentation
    FAILED = "failed"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # User profile fields
    full_name = Column(String, nullable=True)
    profile_picture = Column(String, nullable=True)  # Store object name for the profile picture
    language = Column(String, default="cs-CZ")  # Default language is Czech
    theme = Column(String, default="light")  # Default theme is light
    segmentation_settings = Column(String, nullable=True)  # JSON string with segmentation settings
    
    # Relationships
    projects = relationship("Project", back_populates="owner")
    
class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="projects")
    images = relationship("Image", back_populates="project", cascade="all, delete-orphan")

class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    object_name = Column(String, unique=True, index=True)  # MinIO object name
    project_id = Column(Integer, ForeignKey("projects.id"))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="images")
    segmentation = relationship("Segmentation", back_populates="image", uselist=False, cascade="all, delete-orphan")

class Segmentation(Base):
    __tablename__ = "segmentations"

    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("images.id"), unique=True)
    mask_object_name = Column(String, nullable=True)  # MinIO object name for the segmentation mask
    annotations_object_name = Column(String, nullable=True)  # MinIO object name for COCO annotations
    status = Column(Enum(SegmentationStatus), default=SegmentationStatus.PENDING)
    task_id = Column(String, nullable=True)  # Celery task ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    image = relationship("Image", back_populates="segmentation")