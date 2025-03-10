from celery import Celery
from ..core.config import settings
from ..application.services.image_processing import ImageProcessor
from ..application.services.analysis import AnalysisService
from ..infrastructure.monitoring import monitor_task

celery = Celery('tasks', broker=settings.CELERY_BROKER_URL)
image_processor = ImageProcessor()
analysis_service = AnalysisService()

@celery.task(bind=True)
@monitor_task
def process_image(self, image_id: int):
    """Process single image"""
    return image_processor.process(image_id)

@celery.task(bind=True)
@monitor_task
def batch_process_images(self, image_ids: list[int]):
    """Process multiple images in batch"""
    return image_processor.batch_process(image_ids)

@celery.task(bind=True)
@monitor_task
def generate_analysis(self, project_id: int):
    """Generate project analysis"""
    return analysis_service.generate_project_analysis(project_id)