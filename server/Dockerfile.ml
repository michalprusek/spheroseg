FROM python:3.10-slim

WORKDIR /ML

# Instalace základních balíčků
RUN apt-get update && apt-get install -y \
    build-essential \
    libopencv-dev \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

# Kopírování requirements.txt
COPY ML/requirements.txt .

# Instalace Python balíčků
RUN pip install --no-cache-dir -r requirements.txt

# Kopírování ML skriptů
COPY ML/*.py .

# Vytvoření adresáře pro checkpointy
RUN mkdir -p /ML/checkpoints

# Výchozí příkaz
CMD ["python", "ResUnet.py", "--help"]
