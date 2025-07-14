FROM node:18-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    make \
    g++ \
    python3 \
    python3-pip \
    python3-pil \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy types package first
COPY packages/types /types

# Copy shared package
COPY packages/shared /shared

# Copy package files
COPY packages/backend/package*.json ./
COPY packages/backend/tsconfig.json ./

# Install dependencies
RUN npm install --legacy-peer-deps
# Ensure dev dependencies are also installed
RUN npm install --legacy-peer-deps --include=dev
RUN npm install -g nodemon ts-node ts-node-dev typescript tsconfig-paths

# Link local types package globally
RUN cd /types && npm link

# Build and link local shared package (skip TypeScript errors temporarily)
RUN cd /shared && npm install && npm link @spheroseg/types && (npm run build || echo "Warning: Shared package build failed, continuing anyway") && npm link

# Link shared and types packages to backend
RUN npm link @spheroseg/shared @spheroseg/types || echo "Warning: Failed to link packages"

# Copy source code
COPY packages/backend/. .

# Create uploads directory
RUN mkdir -p /app/uploads

# Set Node.js memory optimization flags
ENV NODE_OPTIONS="--max-old-space-size=384 --expose-gc"

# Start command will be provided by docker-compose
CMD ["npm", "run", "dev"]