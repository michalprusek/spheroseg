FROM python:3.9-slim

WORKDIR /ML

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML scripts
COPY . .

# Make uploads directory
RUN mkdir -p /ML/uploads
RUN chmod -R 777 /ML/uploads

# Start service
CMD ["python", "ml_service.py"]