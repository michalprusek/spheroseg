import requests
from typing import Dict, List, Any, Optional
from datetime import datetime

class SpheroSegClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def create_project(self, name: str, description: Optional[str] = None) -> Dict:
        """Vytvoření nového projektu"""
        response = self.session.post(
            f'{self.base_url}/api/v1/projects',
            json={'name': name, 'description': description}
        )
        response.raise_for_status()
        return response.json()

    def upload_image(self, project_id: str, image_path: str) -> Dict:
        """Upload obrázku do projektu"""
        with open(image_path, 'rb') as f:
            files = {'file': f}
            response = self.session.post(
                f'{self.base_url}/api/v1/projects/{project_id}/images',
                files=files
            )
        response.raise_for_status()
        return response.json()

    def analyze_image(
        self,
        image_id: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict:
        """Spuštění analýzy obrázku"""
        response = self.session.post(
            f'{self.base_url}/api/v1/images/{image_id}/analyze',
            json=parameters or {}
        )
        response.raise_for_status()
        return response.json()

    def create_batch_job(
        self,
        image_ids: List[str],
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict:
        """Vytvoření dávkové úlohy"""
        response = self.session.post(
            f'{self.base_url}/api/v1/batch',
            json={
                'images': image_ids,
                'parameters': parameters or {}
            }
        )
        response.raise_for_status()
        return response.json()

    def get_batch_status(self, job_id: str) -> Dict:
        """Získání stavu dávkové úlohy"""
        response = self.session.get(
            f'{self.base_url}/api/v1/batch/{job_id}/status'
        )
        response.raise_for_status()
        return response.json()

    def export_results(
        self,
        project_id: str,
        format: str = 'csv'
    ) -> bytes:
        """Export výsledků v požadovaném formátu"""
        response = self.session.get(
            f'{self.base_url}/api/v1/projects/{project_id}/export',
            params={'format': format}
        )
        response.raise_for_status()
        return response.content