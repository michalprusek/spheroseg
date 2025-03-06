FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file and install dependencies
COPY worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create a volume mount point for model checkpoints
VOLUME /app/models

# Set environment variable for the model checkpoint path
ENV MODEL_CHECKPOINT_PATH=/app/models/checkpoint_epoch_9.pth.tar

# Command to run the Celery worker
CMD ["celery", "-A", "worker.celery", "worker", "--loglevel=info"]