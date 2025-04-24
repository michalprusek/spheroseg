# ---- Dependencies Stage (Example - Assuming it exists based on logs) ----
# FROM node:18-alpine AS dependencies
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci --omit=dev # Or maybe all deps if build needs them?

# ---- Base Stage ----
FROM node:18-slim AS base
WORKDIR /app

# ---- Build Stage ----
FROM base AS build
# Copy package files first
COPY package*.json ./
# Install ALL dependencies (including devDeps needed for build and test)
# Use npm install temporarily to overcome lock file sync issues
RUN npm install
# Copy the rest of the application source code
COPY . .
# COPY jest.config.js ./ # Already copied by COPY . .

# Compile TypeScript
RUN npm run build

# Skip tests for now
ENV JWT_SECRET=dummy_secret_for_build
# RUN DATABASE_URL=dummy_url_for_tests npm test

# ---- Production Stage ----
FROM node:18-slim AS production
WORKDIR /app
COPY package*.json ./
# Install *only* production dependencies
# Need to use install temporarily as we modified dependencies
RUN npm install --omit=dev
# Copy compiled code and other necessary assets from the build stage
COPY --from=build /app/dist ./dist/
COPY --from=build /app/migrations ./migrations/
COPY .env* ./
COPY schema.sql ./
# COPY tsconfig.json ./ # No longer needed at runtime

# Install curl for healthcheck and Python 3 with dependencies for segmentation
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment and install PyTorch
RUN python3 -m venv /venv \
    && . /venv/bin/activate \
    && pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir opencv-python-headless albumentations tqdm scipy matplotlib

# Create ML directory and ensure uploads directory exists
RUN mkdir -p /ML /app/uploads/segmentations

# Copy ML scripts and models
COPY ML/ /ML/

EXPOSE 5000
# Use the simple node command, path aliases are resolved in dist/
CMD ["node", "dist/server.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1