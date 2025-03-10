from typing import List, Dict, Any
import numpy as np
from ..models import ImageModel, AnalysisResult
from ..repositories import ImageRepository, AnalysisRepository

class AnalyticsService:
    def __init__(
        self,
        image_repository: ImageRepository,
        analysis_repository: AnalysisRepository
    ):
        self.image_repository = image_repository
        self.analysis_repository = analysis_repository

    async def get_project_statistics(self, project_id: int) -> Dict[str, Any]:
        """Získá komplexní statistiky projektu"""
        images = await self.image_repository.get_by_project(project_id)
        analyses = await self.analysis_repository.get_by_project(project_id)
        
        return {
            "total_images": len(images),
            "processed_images": len([i for i in images if i.processing_status == "completed"]),
            "failed_images": len([i for i in images if i.processing_status == "failed"]),
            "average_processing_time": self._calculate_avg_processing_time(analyses),
            "sphere_statistics": self._calculate_sphere_statistics(analyses),
            "size_distribution": self._calculate_size_distribution(analyses)
        }

    def _calculate_avg_processing_time(self, analyses: List[AnalysisResult]) -> float:
        times = [a.completed_at - a.started_at for a in analyses if a.completed_at]
        return np.mean([t.total_seconds() for t in times]) if times else 0

    def _calculate_sphere_statistics(self, analyses: List[AnalysisResult]) -> Dict[str, float]:
        spheres = [s for a in analyses for s in a.results.get("spheroids", [])]
        return {
            "total_count": len(spheres),
            "avg_diameter": np.mean([s["diameter"] for s in spheres]) if spheres else 0,
            "std_diameter": np.std([s["diameter"] for s in spheres]) if spheres else 0
        }

    def _calculate_size_distribution(self, analyses: List[AnalysisResult]) -> Dict[str, int]:
        diameters = [s["diameter"] for a in analyses for s in a.results.get("spheroids", [])]
        hist, bins = np.histogram(diameters, bins='auto')
        return {f"{bins[i]:.2f}-{bins[i+1]:.2f}": int(count) for i, count in enumerate(hist)}