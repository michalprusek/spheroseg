from minio import Minio
from minio.error import S3Error
from fastapi import UploadFile
import os
from typing import Optional, BinaryIO
from datetime import timedelta

class StorageService:
    def __init__(self):
        self.client = Minio(
            os.getenv("MINIO_HOST", "minio:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
            secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
            secure=False
        )
        self.bucket_name = "spheroseg"
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
        except S3Error as e:
            raise Exception(f"Chyba při inicializaci úložiště: {str(e)}")

    async def upload_file(self, file: UploadFile, project_id: int, filename: Optional[str] = None) -> str:
        if not filename:
            filename = file.filename
        object_name = f"{project_id}/{filename}"
        
        try:
            file_data = await file.read()
            self.client.put_object(
                self.bucket_name,
                object_name,
                BinaryIO(file_data),
                length=len(file_data),
                content_type=file.content_type
            )
            return object_name
        except S3Error as e:
            raise Exception(f"Chyba při nahrávání souboru: {str(e)}")
        finally:
            await file.close()

    def get_file_url(self, object_name: str, expires: int = 3600) -> str:
        try:
            return self.client.presigned_get_object(
                self.bucket_name,
                object_name,
                expires=timedelta(seconds=expires)
            )
        except S3Error as e:
            raise Exception(f"Chyba při generování URL: {str(e)}")

    def delete_file(self, object_name: str):
        try:
            self.client.remove_object(self.bucket_name, object_name)
        except S3Error as e:
            raise Exception(f"Chyba při mazání souboru: {str(e)}")