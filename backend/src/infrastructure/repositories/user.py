from typing import Optional
from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.user import UserModel

class UserRepository(BaseRepository[UserModel]):
    def __init__(self):
        super().__init__(UserModel)

    def get_by_email(self, db: Session, email: str) -> Optional[UserModel]:
        return db.query(UserModel).filter(UserModel.email == email).first()