import datetime
import os
from minio import Minio
import io
import uuid

# MinIO configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# Create MinIO client
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE
)

# Bucket names
IMAGES_BUCKET = "images"
SEGMENTATION_MASKS_BUCKET = "segmentation-masks"
PROFILE_PICTURES_BUCKET = "profile-pictures"

def ensure_buckets_exist():
    for bucket_name in [IMAGES_BUCKET, SEGMENTATION_MASKS_BUCKET, PROFILE_PICTURES_BUCKET]:
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)

def generate_object_name(filename: str):
    extension = os.path.splitext(filename)[1].lower()
    return f"{uuid.uuid4()}{extension}"

def upload_image(file_content, filename: str):
    ensure_buckets_exist()
    object_name = generate_object_name(filename)
    
    minio_client.put_object(
        IMAGES_BUCKET,
        object_name,
        io.BytesIO(file_content),
        length=len(file_content),
        content_type="image/jpeg"
    )
    
    return object_name

def get_image_url(object_name: str, expires=3600):
    return minio_client.presigned_get_object(
        IMAGES_BUCKET,
        object_name,
        expires=datetime.timedelta(seconds=expires)
    )

def get_segmentation_mask_url(object_name: str, expires=3600):
    return minio_client.presigned_get_object(
        SEGMENTATION_MASKS_BUCKET,
        object_name,
        expires=datetime.timedelta(seconds=expires)
    )

def get_profile_picture_url(object_name: str, expires=3600):
    return minio_client.presigned_get_object(
        PROFILE_PICTURES_BUCKET,
        object_name,
        expires=datetime.timedelta(seconds=expires)
    ) 