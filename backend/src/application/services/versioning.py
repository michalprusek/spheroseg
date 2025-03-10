from typing import List, Optional
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from ...domain.entities.version import Version
from ...infrastructure.repositories.version import VersionRepository
from ...infrastructure.storage import StorageService

class VersioningService:
    def __init__(self, storage_service: StorageService):
        self.repository = VersionRepository()
        self.storage = storage_service

    async def create_version(
        self,
        db: Session,
        project_id: str,
        user_id: str,
        description: str,
        parameters: dict,
        results: dict,
        parent_version_id: Optional[str] = None
    ) -> Version:
        version = Version(
            id=str(uuid.uuid4()),
            project_id=project_id,
            created_by=user_id,
            created_at=datetime.utcnow(),
            description=description,
            parameters=parameters,
            results=results,
            parent_version_id=parent_version_id
        )
        
        # Uložení výsledků do úložiště
        results_path = f"versions/{version.id}/results.json"
        await self.storage.save_json(results_path, results)
        
        # Uložení verze do databáze
        return self.repository.create(db, version)

    def get_version_history(
        self,
        db: Session,
        project_id: str
    ) -> List[Version]:
        """Získání historie verzí pro projekt"""
        return self.repository.get_by_project(db, project_id)

    async def compare_versions(
        self,
        db: Session,
        version_id1: str,
        version_id2: str
    ) -> dict:
        """Porovnání dvou verzí"""
        v1 = self.repository.get_by_id(db, version_id1)
        v2 = self.repository.get_by_id(db, version_id2)
        
        # Načtení výsledků z úložiště
        results1 = await self.storage.get_json(f"versions/{v1.id}/results.json")
        results2 = await self.storage.get_json(f"versions/{v2.id}/results.json")
        
        return {
            "parameter_changes": self._compare_dicts(v1.parameters, v2.parameters),
            "result_changes": self._compare_dicts(results1, results2)
        }

    def _compare_dicts(self, dict1: dict, dict2: dict) -> dict:
        """Pomocná metoda pro porovnání dvou slovníků"""
        changes = {}
        all_keys = set(dict1.keys()) | set(dict2.keys())
        
        for key in all_keys:
            if key not in dict1:
                changes[key] = {"type": "added", "value": dict2[key]}
            elif key not in dict2:
                changes[key] = {"type": "removed", "value": dict1[key]}
            elif dict1[key] != dict2[key]:
                changes[key] = {
                    "type": "modified",
                    "old_value": dict1[key],
                    "new_value": dict2[key]
                }
        
        return changes