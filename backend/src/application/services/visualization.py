from typing import List, Dict, Any
import numpy as np
import matplotlib.pyplot as plt
import io
import base64
from ...domain.entities.image import Image
from ...domain.entities.project import Project

class VisualizationService:
    @staticmethod
    def create_histogram(data: List[float], bins: int = 30) -> str:
        plt.figure(figsize=(10, 6))
        plt.hist(data, bins=bins, edgecolor='black')
        plt.title('Distribution of Sphere Diameters')
        plt.xlabel('Diameter (μm)')
        plt.ylabel('Frequency')
        
        # Convert plot to base64 string
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        return base64.b64encode(buf.getvalue()).decode()

    @staticmethod
    def create_box_plot(data: List[float]) -> str:
        plt.figure(figsize=(8, 6))
        plt.boxplot(data)
        plt.title('Sphere Diameter Distribution')
        plt.ylabel('Diameter (μm)')
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        return base64.b64encode(buf.getvalue()).decode()

    @staticmethod
    def create_time_series(timestamps: List[str], values: List[float], metric_name: str) -> str:
        plt.figure(figsize=(12, 6))
        plt.plot(timestamps, values, marker='o')
        plt.title(f'{metric_name} Over Time')
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        return base64.b64encode(buf.getvalue()).decode()

    @staticmethod
    def generate_project_visualizations(project: Project, images: List[Image]) -> Dict[str, Any]:
        all_diameters = []
        timestamps = []
        sphere_counts = []
        
        for image in images:
            if image.processing_status == "completed" and image.analysis_results:
                if "details" in image.analysis_results:
                    diameters = [d["diameter"] for d in image.analysis_results["details"]]
                    all_diameters.extend(diameters)
                timestamps.append(image.created_at.isoformat())
                sphere_counts.append(image.sphere_count or 0)

        return {
            "diameter_distribution": {
                "histogram": VisualizationService.create_histogram(all_diameters),
                "box_plot": VisualizationService.create_box_plot(all_diameters)
            },
            "time_series": {
                "sphere_counts": VisualizationService.create_time_series(
                    timestamps, sphere_counts, "Sphere Count"
                )
            }
        }