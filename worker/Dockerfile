# Stage 1: Builder
FROM python:3.11-slim as builder

# Instalace build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalace Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

WORKDIR /app

# Kopírování pouze souborů pro dependencies
COPY pyproject.toml poetry.lock ./

# Instalace dependencies bez dev závislostí
RUN ~/.local/bin/poetry config virtualenvs.create false \
    && ~/.local/bin/poetry install --no-dev --no-interaction --no-ansi

# Stage 2: Runtime
FROM python:3.11-slim

# Instalace runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Kopírování Python packages z builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

WORKDIR /app

# Kopírování aplikačního kódu
COPY src/ src/
COPY scripts/ scripts/

# Nastavení proměnných prostředí
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD celery -A src.worker inspect ping -d celery@$HOSTNAME || exit 1

# Spuštění workeru
CMD ["celery", "-A", "src.worker", "worker", "--loglevel=info"]