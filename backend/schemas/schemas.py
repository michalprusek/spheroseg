from enum import Enum
from pydantic import BaseModel, EmailStr, Field, validator
from typing import List, Optional
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    segmentation_settings: Optional[str] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    profile_picture: Optional[str] = None
    full_name: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    segmentation_settings: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserWithProjects(UserResponse):
    """User with their projects"""
    projects: List = []

    class Config:
        from_attributes = True


# Image schemas
class ImageBase(BaseModel):
    filename: str


class ImageCreate(ImageBase):
    project_id: int


class ImageResponse(ImageBase):
    id: int
    object_name: str
    project_id: int
    uploaded_at: datetime
    segmentation_status: Optional[str] = None
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


# Project schemas
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    images_count: int = 0

    class Config:
        from_attributes = True


class ProjectDetail(ProjectResponse):
    """Extended project response with owner details"""
    owner_username: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectWithImages(ProjectDetail):
    """Project with list of associated images"""
    images: List[ImageResponse] = []

    class Config:
        from_attributes = True


# Segmentation schemas
class SegmentationStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    SEGMENTED = "segmented"
    FAILED = "failed"
    MEMORY_ERROR = "memory_error"
    ERROR = "error"


class SegmentationBase(BaseModel):
    image_id: int


class SegmentationCreate(SegmentationBase):
    pass


class SegmentationResponse(SegmentationBase):
    id: int
    status: SegmentationStatus
    mask_object_name: Optional[str] = None
    annotations_object_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None 