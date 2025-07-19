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

# Install psutil for health checks
RUN pip install psutil

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import requests; r = requests.get('http://localhost:5002/health'); exit(0 if r.status_code == 200 else 1)" || exit 1

# Start service
CMD ["python", "ml_service.py"]