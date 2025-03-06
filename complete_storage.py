import datetime
import os
from minio import Minio
from minio.error import S3Error
import io
from PIL import Image as PILImage
import uuid
from dotenv import load_dotenv

load_dotenv()

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
THUMBNAILS_BUCKET = "thumbnails"
SEGMENTATION_MASKS_BUCKET = "segmentation-masks"
PROFILE_PICTURES_BUCKET = "profile-pictures"

# Thumbnail size
THUMBNAIL_SIZE = (200, 200)

def ensure_buckets_exist():
    """Ensure that the required MinIO buckets exist."""
    for bucket_name in [IMAGES_BUCKET, THUMBNAILS_BUCKET, SEGMENTATION_MASKS_BUCKET, PROFILE_PICTURES_BUCKET]:
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)

def generate_object_name(filename: str):
    """Generate a unique object name for a file."""
    extension = os.path.splitext(filename)[1].lower()
    return f"{uuid.uuid4()}{extension}"

def upload_image(file_content, filename: str):
    """Upload an image to MinIO and return the object name."""
    print(f"Uploading image {filename} with size {len(file_content)} bytes")
    try:
        ensure_buckets_exist()
        object_name = generate_object_name(filename)
        
        # Upload the original image to MinIO
        minio_client.put_object(
            IMAGES_BUCKET,
            object_name,
            io.BytesIO(file_content),
            length=len(file_content),
            content_type="image/jpeg"  # Assuming JPEG, can be detected from file
        )
        
        # Generate and upload a thumbnail
        try:
            img = PILImage.open(io.BytesIO(file_content))
            img.thumbnail(THUMBNAIL_SIZE)
            thumbnail_name = f"thumb_{object_name}"
            
            with io.BytesIO() as output:
                img.save(output, format=img.format or "JPEG")
                thumbnail_bytes = output.getvalue()
            
            minio_client.put_object(
                THUMBNAILS_BUCKET,
                thumbnail_name,
                io.BytesIO(thumbnail_bytes),
                length=len(thumbnail_bytes),
                content_type=f"image/{img.format.lower() if img.format else 'jpeg'}"
            )
            print(f"Thumbnail created for {object_name}")
        except Exception as e:
            print(f"Error creating thumbnail: {e}")
        
        return object_name
    except Exception as e:
        print(f"Error uploading image to MinIO: {e}")
        raise e

def upload_segmentation_mask(mask_data, image_object_name: str):
    """Upload a segmentation mask to MinIO and return the object name."""
    ensure_buckets_exist()
    object_name = f"mask_{image_object_name}"
    
    # Convert numpy array to bytes
    mask_image = PILImage.fromarray(mask_data)
    with io.BytesIO() as output:
        mask_image.save(output, format="PNG")
        mask_bytes = output.getvalue()
    
    # Upload the mask to MinIO
    minio_client.put_object(
        SEGMENTATION_MASKS_BUCKET,
        object_name,
        io.BytesIO(mask_bytes),
        length=len(mask_bytes),
        content_type="image/png"
    )
    
    return object_name

def get_image_url(object_name: str, expires=3600):
    """Get a presigned URL for the image."""
    return minio_client.presigned_get_object(
        IMAGES_BUCKET,
        object_name,
        expires=datetime.timedelta(seconds=expires)
    )

def get_thumbnail_url(object_name: str, expires=3600):
    """Get a presigned URL for the thumbnail."""
    thumbnail_name = f"thumb_{object_name}"
    return minio_client.presigned_get_object(
        THUMBNAILS_BUCKET,
        thumbnail_name,
        expires=datetime.timedelta(seconds=expires)
    )

def get_segmentation_mask_url(object_name: str, expires=3600):
    """Get a presigned URL for the segmentation mask."""
    return minio_client.presigned_get_object(
        SEGMENTATION_MASKS_BUCKET,
        object_name,
        expires=datetime.timedelta(seconds=expires)
    )

def get_image_data(object_name: str):
    """Get image data from MinIO."""
    try:
        response = minio_client.get_object(IMAGES_BUCKET, object_name)
        image_data = response.read()
        return image_data
    except S3Error as err:
        print(f"Error getting image: {err}")
        return None
    finally:
        response.close()
        response.release_conn()

def get_segmentation_mask_data(object_name: str):
    """Get segmentation mask data from MinIO."""
    try:
        response = minio_client.get_object(SEGMENTATION_MASKS_BUCKET, object_name)
        mask_data = response.read()
        return mask_data
    except S3Error as err:
        print(f"Error getting mask: {err}")
        return None
    finally:
        response.close()
        response.release_conn()

def update_segmentation_mask(mask_data, object_name: str):
    """Update an existing segmentation mask."""
    # Convert numpy array to bytes
    mask_image = PILImage.fromarray(mask_data)
    with io.BytesIO() as output:
        mask_image.save(output, format="PNG")
        mask_bytes = output.getvalue()
    
    # Upload the updated mask to MinIO (overwrites existing object)
    minio_client.put_object(
        SEGMENTATION_MASKS_BUCKET,
        object_name,
        io.BytesIO(mask_bytes),
        length=len(mask_bytes),
        content_type="image/png"
    )
    
    return object_name

def upload_profile_picture(file_content, filename: str, user_id: int):
    """Upload a profile picture to MinIO and return the object name."""
    ensure_buckets_exist()
    # Use user_id to make the object name predictable for the same user
    extension = os.path.splitext(filename)[1].lower()
    object_name = f"profile_{user_id}{extension}"
    
    # Upload the profile picture to MinIO
    minio_client.put_object(
        PROFILE_PICTURES_BUCKET,
        object_name,
        io.BytesIO(file_content),
        length=len(file_content),
        content_type="image/jpeg"  # This should be detected from the actual file
    )
    
    return object_name

def get_profile_picture_url(object_name: str, expires=3600):
    """Get a presigned URL for the profile picture."""
    return minio_client.presigned_get_object(
        PROFILE_PICTURES_BUCKET,
        object_name,
        expires=datetime.timedelta(seconds=expires)
    ) 