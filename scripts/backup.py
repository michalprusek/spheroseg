import os
import subprocess
from datetime import datetime
import boto3
from minio import Minio

def backup_database():
    """Zálohování PostgreSQL databáze"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = f"backup_db_{timestamp}.sql"
    
    # Vytvoření dump
    subprocess.run([
        "pg_dump",
        "-h", os.getenv("DB_HOST", "db"),
        "-U", os.getenv("DB_USER", "postgres"),
        "-d", os.getenv("DB_NAME", "spheroseg"),
        "-f", backup_file
    ])
    
    return backup_file

def backup_minio():
    """Zálohování MinIO dat"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = f"backup_minio_{timestamp}"
    
    minio_client = Minio(
        os.getenv("MINIO_HOST", "minio:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        secure=False
    )
    
    # Záloha všech bucketů
    for bucket in minio_client.list_buckets():
        os.makedirs(f"{backup_dir}/{bucket.name}", exist_ok=True)
        objects = minio_client.list_objects(bucket.name, recursive=True)
        for obj in objects:
            minio_client.fget_object(
                bucket.name,
                obj.object_name,
                f"{backup_dir}/{bucket.name}/{obj.object_name}"
            )
    
    return backup_dir

def upload_to_s3(file_path: str):
    """Upload zálohy do S3"""
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("AWS_SECRET_KEY")
    )
    
    bucket = os.getenv("BACKUP_BUCKET")
    s3_client.upload_file(file_path, bucket, os.path.basename(file_path))

if __name__ == "__main__":
    # Záloha databáze
    db_backup = backup_database()
    upload_to_s3(db_backup)
    os.remove(db_backup)
    
    # Záloha MinIO
    minio_backup = backup_minio()
    # Vytvoření archivu
    archive_name = f"{minio_backup}.tar.gz"
    subprocess.run(["tar", "-czf", archive_name, minio_backup])
    upload_to_s3(archive_name)
    # Cleanup
    subprocess.run(["rm", "-rf", minio_backup, archive_name])