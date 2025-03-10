from typing import List
from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.project import ProjectModel

class ProjectRepository(BaseRepository[ProjectModel]):
    def __init__(self):
        super().__init__(ProjectModel)

    def get_user_projects(self, db: Session, user_id: int) -> List[ProjectModel]:
        return (
            db.query(ProjectModel)
            .filter(
                (ProjectModel.owner_id == user_id) |
                (ProjectModel.collaborators.any(id=user_id))
            )
            .all()
        )