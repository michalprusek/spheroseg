from typing import List, Dict, Any
import numpy as np
from ...domain.entities.image import Image
from ...domain.entities.project import Project

class AnalysisService:
    @staticmethod
    def calculate_basic_statistics(diameters: List[float]) -> Dict[str, float]:
        if not diameters:
            return {
                "mean": 0,
                "median": 0,
                "std": 0,
                "min": 0,
                "max": 0
            }
        
        return {
            "mean": float(np.mean(diameters)),
            "median": float(np.median(diameters)),
            "std": float(np.std(diameters)),
            "min": float(np.min(diameters)),
            "max": float(np.max(diameters))
        }

    @staticmethod
    def analyze_project_results(project: Project, images: List[Image]) -> Dict[str, Any]:
        all_diameters = []
        sphere_counts = []
        processing_status = {"completed": 0, "failed": 0, "pending": 0}

        for image in images:
            if image.processing_status == "completed" and image.analysis_results:
                sphere_counts.append(image.sphere_count or 0)
                if image.analysis_results.get("details"):
                    all_diameters.extend(
                        detail["diameter"] for detail in image.analysis_results["details"]
                    )
            processing_status[image.processing_status] += 1

        return {
            "total_images": len(images),
            "processing_status": processing_status,
            "sphere_statistics": {
                "total_spheres": sum(sphere_counts),
                "average_per_image": np.mean(sphere_counts) if sphere_counts else 0,
                "max_in_single_image": max(sphere_counts) if sphere_counts else 0
            },
            "diameter_statistics": self.calculate_basic_statistics(all_diameters),
            "distribution": {
                "histogram": np.histogram(all_diameters, bins=10).tolist() if all_diameters else None
            }
        }

    @staticmethod
    def get_image_details(image: Image) -> Dict[str, Any]:
        if not image.analysis_results or image.processing_status != "completed":
            return {
                "status": image.processing_status,
                "error": image.processing_error,
                "statistics": None
            }

        sphere_details = image.analysis_results.get("details", [])
        diameters = [detail["diameter"] for detail in sphere_details]

        return {
            "status": "completed",
            "statistics": {
                "sphere_count": image.sphere_count,
                "diameter_statistics": self.calculate_basic_statistics(diameters),
                "sphere_locations": sphere_details
            }
        }