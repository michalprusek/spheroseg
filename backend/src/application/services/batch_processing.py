from typing import List, Dict, Any
from celery import group
from ...domain.entities.image import Image
from ...domain.entities.batch_job import BatchJob
from ...infrastructure.storage import StorageService
from .image_processing import ImageProcessor

class BatchProcessingService:
    def __init__(self, storage_service: StorageService):
        self.storage = storage_service
        self.image_processor = ImageProcessor()

    async def create_batch_job(
        self,
        images: List[Image],
        parameters: Dict[str, Any]
    ) -> BatchJob:
        """Vytvoření nové dávkové úlohy"""
        batch_job = BatchJob(
            images=images,
            parameters=parameters,
            status="pending",
            progress=0,
            results={}
        )
        
        # Rozdělení na menší úlohy
        tasks = []
        for image in images:
            task = process_image.s(
                image.id,
                image.storage_path,
                parameters
            )
            tasks.append(task)
        
        # Spuštění úloh paralelně
        job = group(tasks)
        result = job.apply_async()
        
        # Uložení ID úlohy
        batch_job.celery_id = result.id
        return batch_job

    async def get_batch_job_status(self, batch_job_id: str) -> Dict[str, Any]:
        """Získání stavu dávkové úlohy"""
        from celery.result import GroupResult
        
        result = GroupResult.restore(batch_job_id)
        if not result:
            return {"status": "not_found"}
        
        completed = sum(1 for r in result.results if r.ready())
        total = len(result.results)
        
        return {
            "status": "completed" if result.ready() else "processing",
            "progress": (completed / total) * 100 if total > 0 else 0,
            "completed_tasks": completed,
            "total_tasks": total
        }

    async def aggregate_results(self, batch_job: BatchJob) -> Dict[str, Any]:
        """Agregace výsledků z dávkového zpracování"""
        all_results = []
        for image in batch_job.images:
            if image.analysis_results:
                all_results.append(image.analysis_results)
        
        if not all_results:
            return {}
        
        # Statistická analýza
        sphere_counts = [r["sphere_count"] for r in all_results]
        diameters = [s["diameter"] for r in all_results for s in r["details"]]
        areas = [s["area"] for r in all_results for s in r["details"]]
        
        return {
            "total_images": len(batch_job.images),
            "total_spheres": sum(sphere_counts),
            "average_spheres_per_image": np.mean(sphere_counts),
            "diameter_statistics": {
                "mean": np.mean(diameters),
                "std": np.std(diameters),
                "min": np.min(diameters),
                "max": np.max(diameters),
                "histogram": np.histogram(diameters, bins=50).tolist()
            },
            "area_statistics": {
                "mean": np.mean(areas),
                "std": np.std(areas),
                "min": np.min(areas),
                "max": np.max(areas),
                "histogram": np.histogram(areas, bins=50).tolist()
            }
        }