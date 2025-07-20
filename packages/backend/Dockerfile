# Backend Dockerfile with multi-stage build for development and production

# Base stage for both dev and prod
FROM node:20-alpine AS base
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl postgresql-client

# Development stage
FROM base AS development

# Copy all package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared
COPY packages/types ./packages/types
COPY tsconfig.base.json ./

# Create necessary directories
RUN mkdir -p logs uploads

# Set development environment
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=384 --expose-gc"

EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

# Development command
CMD ["npm", "run", "dev", "--workspace=@spheroseg/backend"]

# Production dependencies stage
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

# Install production dependencies only
RUN npm ci --only=production

# Builder stage
FROM base AS builder

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared
COPY packages/types ./packages/types
COPY tsconfig.base.json ./

# Build the application
RUN npm run build --workspace=@spheroseg/backend

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache curl postgresql-client

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/packages ./packages

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist ./packages/types/dist

# Copy package.json files for runtime
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs packages/backend/package*.json ./packages/backend/
COPY --chown=nodejs:nodejs packages/shared/package*.json ./packages/shared/
COPY --chown=nodejs:nodejs packages/types/package*.json ./packages/types/

# Copy database scripts
COPY --chown=nodejs:nodejs packages/backend/src/db ./src/db

# Create necessary directories
RUN mkdir -p logs uploads && \
    chown -R nodejs:nodejs logs uploads

# Switch to non-root user
USER nodejs

# Set production environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"

EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

# Production command
CMD ["node", "packages/backend/dist/server.js"]