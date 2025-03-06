import os
import io
import time
import logging
import gc
import traceback
import psutil
import json
from datetime import datetime
from celery import Celery
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import boto3
from botocore.client import Config
import numpy as np
import cv2
from PIL import Image

# Relativní import segmentačního modelu
from worker.segmentation_model import SpheroSegmentationModel

# Nastavení loggeru
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Konfigurace Celery
celery = Celery(
    "worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0"
)

# Konfigurace databáze
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://spheroseg:spheroseg@postgres/spheroseg")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# Konfigurace MinIO
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.environ.get("MINIO_SECURE", "false").lower() == "true"

# Inicializace MinIO klienta
s3_client = boto3.client(
    "s3",
    endpoint_url=f"http{'s' if MINIO_SECURE else ''}://{MINIO_ENDPOINT}",
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
    verify=False
)

# Inicializace segmentačního modelu
MODEL_CHECKPOINT_PATH = os.environ.get("MODEL_CHECKPOINT_PATH", "/app/models/checkpoint_epoch_9.pth.tar")
segmentation_model = SpheroSegmentationModel(checkpoint_path=MODEL_CHECKPOINT_PATH)

@celery.task(name="segment_image", bind=True, max_retries=3)
def segment_image(self, image_id, object_name=None):
    """
    Úloha pro segmentaci obrázku.
    
    Args:
        image_id: ID obrázku v databázi
    """
    start_time = time.time()
    logger.info(f"Starting segmentation for image_id: {image_id}")
    
    # Výpis dostupné paměti
    logger.info(f"Available memory at start: {psutil.virtual_memory().available / (1024 * 1024 * 1024):.2f} GB")
    
    # Uvolnění paměti před zpracováním
    gc.collect()
    
    session = None
    temp_file_path = None
    
    try:
        # Vytvoření session pro databázi
        session = Session()
        
        # Získání informací o obrázku
        image_query = text("""
            SELECT i.id, i.object_name, s.id as segmentation_id
            FROM images i
            LEFT JOIN segmentations s ON i.id = s.image_id
            WHERE i.id = :image_id
        """)
        
        result = session.execute(image_query, {"image_id": image_id}).fetchone()
        
        if not result:
            logger.error(f"Image with id {image_id} not found")
            return {"status": "failed", "error": "Image not found"}
        
        # Use object_name from parameter if provided, otherwise from database
        image_object_name = object_name if object_name else result.object_name
        segmentation_id = result.segmentation_id
        
        if not segmentation_id:
            # Vytvoření záznamu segmentace
            insert_query = text("""
                INSERT INTO segmentations (image_id, status)
                VALUES (:image_id, 'PROCESSING')
                RETURNING id
            """)
            
            segmentation_id = session.execute(insert_query, {"image_id": image_id}).fetchone()[0]
            session.commit()
        else:
            # Aktualizace stavu segmentace
            update_query = text("""
                UPDATE segmentations
                SET status = 'PROCESSING', updated_at = NOW()
                WHERE id = :segmentation_id
            """)
            
            session.execute(update_query, {"segmentation_id": segmentation_id})
            session.commit()
        
        # Stažení obrázku z MinIO
        logger.info(f"Downloading image {image_object_name} from MinIO")
        
        # Vytvoření dočasného souboru
        temp_file_path = f"/tmp/image_{image_id}_{int(time.time())}.jpg"
        
        # Stažení obrázku
        s3_client.download_file("images", image_object_name, temp_file_path)
        
        logger.info(f"Image downloaded to {temp_file_path}")
        logger.info(f"Available memory before segmentation: {psutil.virtual_memory().available / (1024 * 1024 * 1024):.2f} GB")
        
        # Segment the image and generate COCO annotations
        binary_mask, contour_image, outer_contours, inner_contours, coco_annotations = segmentation_model.segment_with_contours(
            temp_file_path, 
            image_id=image_id
        )
        
        logger.info(f"Segmentation completed, mask shape: {binary_mask.shape}")
        logger.info(f"Found {len(coco_annotations['annotations'])} objects")
        logger.info(f"Available memory after segmentation: {psutil.virtual_memory().available / (1024 * 1024 * 1024):.2f} GB")
        
        # Generate a timestamp for file names
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        # Save mask to MinIO
        mask_object_name = f"masks/{image_id}_{timestamp}.png"
        
        # Convert mask to bytes
        _, mask_bytes = cv2.imencode(".png", binary_mask)
        mask_bytes_io = io.BytesIO(mask_bytes.tobytes())
        
        # Save COCO annotations to MinIO
        annotations_object_name = f"annotations/{image_id}_{timestamp}.json"
        annotations_bytes = json.dumps(coco_annotations).encode('utf-8')
        annotations_bytes_io = io.BytesIO(annotations_bytes)
        
        # Check if buckets exist, create if needed
        for bucket_name in ["masks", "annotations"]:
            try:
                s3_client.head_bucket(Bucket=bucket_name)
            except s3_client.exceptions.ClientError:
                # Bucket doesn't exist, create it
                s3_client.create_bucket(Bucket=bucket_name)
                logger.info(f"Created '{bucket_name}' bucket in MinIO")
        
        # Upload files to MinIO
        s3_client.upload_fileobj(mask_bytes_io, "masks", mask_object_name)
        s3_client.upload_fileobj(annotations_bytes_io, "annotations", annotations_object_name)
        
        logger.info(f"Mask uploaded to MinIO as {mask_object_name}")
        logger.info(f"Annotations uploaded to MinIO as {annotations_object_name}")
        
        # Update segmentation record with 'COMPLETED' status
        update_query = text("""
            UPDATE segmentations
            SET status = 'COMPLETED', 
                mask_object_name = :mask_object_name, 
                annotations_object_name = :annotations_object_name,
                updated_at = NOW()
            WHERE id = :segmentation_id
        """)
        
        session.execute(update_query, {
            "segmentation_id": segmentation_id,
            "mask_object_name": mask_object_name,
            "annotations_object_name": annotations_object_name
        })
        
        session.commit()
        
        end_time = time.time()
        logger.info(f"Segmentation for image_id {image_id} completed in {end_time - start_time:.2f} seconds")
        
        # Uvolnění paměti po dokončení
        gc.collect()
        
        return {"status": "completed", "mask_object_name": mask_object_name}
        
    except Exception as e:
        logger.error(f"Error during segmentation of image {image_id}: {str(e)}")
        logger.error(traceback.format_exc())
        
        if session:
            try:
                # Aktualizace stavu segmentace na FAILED
                update_query = text("""
                    UPDATE segmentations
                    SET status = 'FAILED', updated_at = NOW()
                    WHERE id = :segmentation_id
                """)
                
                session.execute(update_query, {"segmentation_id": segmentation_id})
                session.commit()
            except Exception as db_error:
                logger.error(f"Error updating segmentation status: {str(db_error)}")
                session.rollback()
        
        # Pokus o opakování úlohy
        try:
            self.retry(countdown=60, exc=e, max_retries=3)
        except Exception as retry_error:
            logger.error(f"Failed to retry task: {str(retry_error)}")
        
        return {"status": "failed", "error": str(e)}
        
    finally:
        # Uzavření session
        if session:
            session.close()
        
        # Odstranění dočasného souboru
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.info(f"Temporary file {temp_file_path} removed")
            except Exception as e:
                logger.error(f"Error removing temporary file: {str(e)}")
        
        # Uvolnění paměti
        gc.collect()

@celery.task(name="update_segmentation")
def update_segmentation(segmentation_id, mask_data):
    """
    Úloha pro aktualizaci segmentační masky po manuální editaci.
    
    Args:
        segmentation_id: ID segmentace v databázi
        mask_data: Data masky v base64 formátu
    """
    logger.info(f"Updating segmentation mask for segmentation_id: {segmentation_id}")
    
    session = None
    
    try:
        # Vytvoření session pro databázi
        session = Session()
        
        # Získání informací o segmentaci
        segmentation_query = text("""
            SELECT s.id, s.image_id, s.mask_object_name
            FROM segmentations s
            WHERE s.id = :segmentation_id
        """)
        
        result = session.execute(segmentation_query, {"segmentation_id": segmentation_id}).fetchone()
        
        if not result:
            logger.error(f"Segmentation with id {segmentation_id} not found")
            return {"status": "failed", "error": "Segmentation not found"}
        
        image_id = result.image_id
        old_mask_object_name = result.mask_object_name
        
        # Dekódování masky z base64
        mask_bytes = io.BytesIO(mask_data)
        
        # Vytvoření nového názvu objektu
        new_mask_object_name = f"masks/{image_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_edited.png"
        
        # Nahrání masky do MinIO
        s3_client.upload_fileobj(mask_bytes, "masks", new_mask_object_name)
        
        logger.info(f"Updated mask uploaded to MinIO as {new_mask_object_name}")
        
        # Aktualizace záznamu segmentace
        update_query = text("""
            UPDATE segmentations
            SET mask_object_name = :new_mask_object_name, updated_at = NOW()
            WHERE id = :segmentation_id
        """)
        
        session.execute(update_query, {
            "segmentation_id": segmentation_id,
            "new_mask_object_name": new_mask_object_name
        })
        
        session.commit()
        
        logger.info(f"Segmentation record updated for segmentation_id {segmentation_id}")
        
        return {"status": "completed", "mask_object_name": new_mask_object_name}
        
    except Exception as e:
        logger.error(f"Error updating segmentation {segmentation_id}: {str(e)}")
        logger.error(traceback.format_exc())
        
        if session:
            session.rollback()
        
        return {"status": "failed", "error": str(e)}
        
    finally:
        # Uzavření session
        if session:
            session.close()
        
        # Uvolnění paměti
        gc.collect()