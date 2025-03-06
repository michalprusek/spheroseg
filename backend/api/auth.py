from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import logging

from db.database import get_db
from models.models import User
from schemas.schemas import Token, UserCreate, UserResponse
from services.auth import (
    authenticate_user, 
    create_access_token, 
    get_password_hash,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

# Set up logger
logger = logging.getLogger("spheroseg-api.auth")

router = APIRouter(
    prefix="/auth",
    tags=["authentication"]
)

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    logger.info(f"Login attempt for user: {form_data.username}")
    
    try:
        # Attempt to retrieve user from database for debugging
        db_user = db.query(User).filter(User.username == form_data.username).first()
        if db_user:
            logger.debug(f"User {form_data.username} found in database")
        else:
            logger.warning(f"User {form_data.username} not found in database")
        
        # Try to authenticate
        user = authenticate_user(db, form_data.username, form_data.password)
        
        if not user:
            logger.warning(f"Authentication failed for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        logger.info(f"Authentication successful for user: {form_data.username}")
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        logger.debug(f"Generated access token for user: {form_data.username}")
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions with their original status code
        logger.warning(f"HTTP exception during login: {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during login: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    logger.info(f"Registration attempt for username: {user.username}, email: {user.email}")
    
    try:
        # Check if username already exists
        db_user = db.query(User).filter(User.username == user.username).first()
        if db_user:
            logger.warning(f"Registration failed: username {user.username} already exists")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        
        # Check if email already exists
        db_user = db.query(User).filter(User.email == user.email).first()
        if db_user:
            logger.warning(f"Registration failed: email {user.email} already exists")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        logger.debug(f"Creating new user: {user.username}")
        hashed_password = get_password_hash(user.password)
        db_user = User(
            username=user.username,
            email=user.email,
            hashed_password=hashed_password
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        logger.info(f"User registration successful: {user.username}")
        return db_user
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error during registration: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )