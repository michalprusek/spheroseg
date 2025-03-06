from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import logging

from db.database import get_db
from models.models import User
from schemas.schemas import TokenData

# Set up logger
logger = logging.getLogger("spheroseg-api.auth-service")

# Security configuration
SECRET_KEY = "spheroseg_secret_key_replace_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    try:
        result = pwd_context.verify(plain_password, hashed_password)
        if not result:
            logger.debug("Password verification failed")
        return result
    except Exception as e:
        logger.error(f"Error verifying password: {str(e)}")
        return False

def get_password_hash(password):
    try:
        return pwd_context.hash(password)
    except Exception as e:
        logger.error(f"Error hashing password: {str(e)}")
        raise

def authenticate_user(db: Session, username: str, password: str):
    try:
        logger.debug(f"Attempting to authenticate user: {username}")
        user = db.query(User).filter(User.username == username).first()
        if not user:
            logger.debug(f"User {username} not found in database")
            return False
        
        if not verify_password(password, user.hashed_password):
            logger.debug(f"Password verification failed for user: {username}")
            return False
        
        logger.debug(f"User {username} authenticated successfully")
        return user
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {str(e)}", exc_info=True)
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    try:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        logger.debug(f"Access token created for user: {data.get('sub')}")
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating access token: {str(e)}", exc_info=True)
        raise

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        logger.debug("Attempting to decode JWT token")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            logger.warning("No username found in token")
            raise credentials_exception
        
        token_data = TokenData(username=username)
        logger.debug(f"Token decoded for user: {username}")
    except JWTError as e:
        logger.warning(f"JWT error: {str(e)}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error decoding token: {str(e)}", exc_info=True)
        raise credentials_exception
        
    try:
        user = db.query(User).filter(User.username == token_data.username).first()
        if user is None:
            logger.warning(f"User {token_data.username} from token not found in database")
            raise credentials_exception
            
        logger.debug(f"User {token_data.username} authenticated via token")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving user from database: {str(e)}", exc_info=True)
        raise credentials_exception

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        logger.warning(f"Inactive user attempted to access protected endpoint: {current_user.username}")
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user