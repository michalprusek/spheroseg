from typing import Optional
from sqlalchemy.orm import Session
from ...domain.entities.user import User
from ...infrastructure.repositories.user import UserRepository
from .auth import AuthService

class UserService:
    def __init__(self):
        self.repository = UserRepository()
        self.auth_service = AuthService()

    def create_user(self, db: Session, email: str, password: str, full_name: str) -> User:
        hashed_password = self.auth_service.get_password_hash(password)
        user_data = {
            "email": email,
            "hashed_password": hashed_password,
            "full_name": full_name
        }
        user = self.repository.create(db, user_data)
        return User.from_orm(user)

    def authenticate_user(self, db: Session, email: str, password: str) -> Optional[User]:
        user = self.repository.get_by_email(db, email)
        if not user:
            return None
        if not self.auth_service.verify_password(password, user.hashed_password):
            return None
        return User.from_orm(user)