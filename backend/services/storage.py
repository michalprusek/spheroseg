import datetime
import os
from minio import Minio
from minio.error import S3Error
import io
from PIL import Image as PILImage
import uuid
from dotenv import load_dotenv
import logging

# Configure logger
logger = logging.getLogger("spheroseg-api.storage-service")

load_dotenv()

# MinIO configuration
MINIO_SERVER_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")  # For server-side access
MINIO_BROWSER_ENDPOINT = "localhost:9000"  # For browser access
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# Create MinIO client with Docker container host for server-side access
minio_client = Minio(
    MINIO_SERVER_ENDPOINT,
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
    logger.info(f"Uploading image {filename} with size {len(file_content)} bytes")
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
            logger.info(f"Thumbnail created for {object_name}")
        except Exception as e:
            logger.error(f"Error creating thumbnail: {e}")
        
        return object_name
    except Exception as e:
        logger.error(f"Error uploading image to MinIO: {e}")
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

def fix_minio_url_for_external_access(url):
    """
    Fix Minio URL for external access by replacing internal hostname with 'localhost'.
    This is needed because the browser can't resolve the Docker container hostnames.
    """
    if url:
        # Replace internal container hostname with localhost
        if MINIO_SERVER_ENDPOINT in url:
            url = url.replace(MINIO_SERVER_ENDPOINT, MINIO_BROWSER_ENDPOINT)
        
        # Also handle explicit minio:9000 references
        url = url.replace('minio:9000', MINIO_BROWSER_ENDPOINT)
        
        # If url contains internal IP addresses, replace them too
        for ip_pattern in ['172.', '10.', '192.168.']:
            if ip_pattern in url:
                # Extract the IP and port
                import re
                ip_pattern = r'(https?://)((?:172|10|192\.168)(?:\.\d+){3})(?::(\d+))?'
                url = re.sub(ip_pattern, r'\1localhost:\3', url)
                
        logger.debug(f"Converted internal URL to browser URL: {url}")
    return url

def get_image_url(object_name: str, expires=3600):
    """Get a presigned URL for the image."""
    try:
        url = minio_client.presigned_get_object(
            IMAGES_BUCKET,
            object_name,
            expires=datetime.timedelta(seconds=expires)
        )
        # Always fix the URL for browser access
        return fix_minio_url_for_external_access(url)
    except Exception as e:
        logger.error(f"Error generating image URL for {object_name}: {e}")
        raise e

def get_thumbnail_url(object_name: str, expires=3600):
    """Get a presigned URL for the thumbnail."""
    thumbnail_name = f"thumb_{object_name}"
    
    try:
        # For development testing, return a direct path to proxy
        # This should work regardless of MinIO's access control settings
        return f"/api/proxy/thumbnail?objectName={thumbnail_name}"
    except Exception as e:
        logger.error(f"Error generating thumbnail URL for {thumbnail_name}: {e}")
        # Return a placeholder image URL on error
        return "/placeholder.svg"

def get_segmentation_mask_url(object_name: str, expires=3600):
    """Get a presigned URL for the segmentation mask."""
    try:
        url = minio_client.presigned_get_object(
            SEGMENTATION_MASKS_BUCKET,
            object_name,
            expires=datetime.timedelta(seconds=expires)
        )
        return fix_minio_url_for_external_access(url)
    except Exception as e:
        logger.error(f"Error generating segmentation mask URL for {object_name}: {e}")
        return None

def get_image_data(object_name: str):
    """Get image data from MinIO."""
    try:
        response = minio_client.get_object(IMAGES_BUCKET, object_name)
        image_data = response.read()
        return image_data
    except S3Error as err:
        logger.error(f"Error getting image {object_name}: {err}")
        return None
    finally:
        if 'response' in locals():
            response.close()
            response.release_conn()

def get_segmentation_mask_data(object_name: str):
    """Get segmentation mask data from MinIO."""
    try:
        response = minio_client.get_object(SEGMENTATION_MASKS_BUCKET, object_name)
        mask_data = response.read()
        return mask_data
    except S3Error as err:
        logger.error(f"Error getting mask {object_name}: {err}")
        return None
    finally:
        if 'response' in locals():
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
    try:
        url = minio_client.presigned_get_object(
            PROFILE_PICTURES_BUCKET,
            object_name,
            expires=datetime.timedelta(seconds=expires)
        )
        return fix_minio_url_for_external_access(url)
    except Exception as e:
        logger.error(f"Error generating profile picture URL for {object_name}: {e}")
        return "/placeholder.svg"

def get_object_data(bucket_name: str, object_name: str) -> bytes:
    """
    Get object data directly from MinIO.
    
    Args:
        bucket_name: Name of the bucket
        object_name: Name of the object
        
    Returns:
        bytes: The object data
        
    Raises:
        Exception: If the object cannot be retrieved
    """
    try:
        # Ensure bucket exists
        ensure_buckets_exist()
        
        # Get object from MinIO
        response = minio_client.get_object(bucket_name, object_name)
        
        # Read data
        data = response.read()
        
        # Close the response to release resources
        response.close()
        response.release_conn()
        
        return data
    except Exception as e:
        logger.error(f"Error retrieving object {object_name} from bucket {bucket_name}: {str(e)}")
        raise Exception(f"Error retrieving object: {str(e)}") 