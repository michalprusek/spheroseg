from passlib.context import CryptContext
from sqlalchemy import create_engine, text
import os
import sys
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/spheroseg")
engine = create_engine(DATABASE_URL)

def update_password(username: str, new_password: str):
    try:
        # Check if user exists
        with engine.connect() as conn:
            user = conn.execute(
                text("SELECT * FROM users WHERE username = :username"),
                {"username": username}
            ).fetchone()
            
            if not user:
                logger.error(f"User {username} does not exist.")
                return False
        
        # Hash the new password
        hashed_password = pwd_context.hash(new_password)
        
        # Update the password
        with engine.connect() as conn:
            result = conn.execute(
                text("UPDATE users SET hashed_password = :hashed_password WHERE username = :username"),
                {"hashed_password": hashed_password, "username": username}
            )
            conn.commit()
            
            if result.rowcount > 0:
                logger.info(f"Password updated successfully for user {username}")
                return True
            else:
                logger.warning(f"No rows updated for user {username}")
                return False
    
    except Exception as e:
        logger.error(f"Error updating password: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        logger.error("Usage: python update_password.py <username> <new_password>")
        sys.exit(1)
    
    username = sys.argv[1]
    new_password = sys.argv[2]
    
    logger.info(f"Updating password for user {username}...")
    success = update_password(username, new_password)
    
    if success:
        logger.info("Password updated successfully.")
        sys.exit(0)
    else:
        logger.error("Failed to update password.")
        sys.exit(1) 