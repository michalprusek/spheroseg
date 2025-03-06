from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
import io

from db.database import get_db
from models.models import User
from schemas.schemas import UserResponse, UserWithProjects, UserUpdate
from services.auth import get_current_active_user, get_password_hash
from services.storage import upload_profile_picture, get_profile_picture_url

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """
    Get the current authenticated user.
    """
    return current_user

@router.get("/me/profile-picture-url")
async def get_user_profile_picture_url(current_user: User = Depends(get_current_active_user)):
    """
    Get the current user's profile picture URL.
    """
    if not current_user.profile_picture:
        return {"url": None}
    
    url = get_profile_picture_url(current_user.profile_picture)
    return {"url": url}

@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update the current user's profile.
    """
    # Get user from database
    db_user = db.query(User).filter(User.id == current_user.id).first()
    
    # Update user fields if provided
    if user_update.username is not None:
        # Check if username already exists
        existing_user = db.query(User).filter(
            User.username == user_update.username,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        db_user.username = user_update.username
        
    if user_update.email is not None:
        # Check if email already exists
        existing_user = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        db_user.email = user_update.email
        
    if user_update.password is not None:
        db_user.hashed_password = get_password_hash(user_update.password)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/me/profile-picture", response_model=UserResponse)
async def upload_user_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload a profile picture for the current user.
    """
    # Read the file content
    file_content = await file.read()
    
    # Upload the profile picture to MinIO
    object_name = upload_profile_picture(file_content, file.filename, current_user.id)
    
    # Update the user's profile picture in the database
    db_user = db.query(User).filter(User.id == current_user.id).first()
    db_user.profile_picture = object_name
    db.commit()
    db.refresh(db_user)
    
    return db_user 