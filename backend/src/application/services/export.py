import csv
import json
import pandas as pd
from typing import List, Dict, Any, BinaryIO
from io import StringIO, BytesIO
from ...domain.entities.image import Image
from ...domain.entities.project import Project

class ExportService:
    @staticmethod
    def export_to_csv(data: List[Dict[str, Any]]) -> StringIO:
        output = StringIO()
        if not data:
            return output
        
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
        output.seek(0)
        return output

    @staticmethod
    def export_to_excel(data: List[Dict[str, Any]]) -> BytesIO:
        output = BytesIO()
        df = pd.DataFrame(data)
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Analysis Results', index=False)
        output.seek(0)
        return output

    @staticmethod
    def prepare_image_analysis_data(image: Image) -> Dict[str, Any]:
        return {
            "image_id": image.id,
            "filename": image.filename,
            "created_at": image.created_at.isoformat(),
            "sphere_count": image.sphere_count,
            "average_diameter": image.average_diameter,
            "processing_status": image.processing_status,
            "analysis_results": image.analysis_results
        }

    @staticmethod
    def prepare_project_export(project: Project, images: List[Image]) -> Dict[str, Any]:
        basic_stats = {
            "total_images": len(images),
            "total_spheres": sum(img.sphere_count or 0 for img in images),
            "average_diameter_all": sum(img.average_diameter or 0 for img in images) / len(images) if images else 0
        }

        return {
            "project_info": {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "created_at": project.created_at.isoformat(),
            },
            "statistics": basic_stats,
            "images": [ExportService.prepare_image_analysis_data(img) for img in images]
        }