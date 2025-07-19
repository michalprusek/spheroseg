# Frontend Dockerfile with multi-stage build for development and production

# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Development stage
FROM base AS development

# Copy package files
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/frontend ./packages/frontend
COPY packages/shared ./packages/shared
COPY packages/types ./packages/types
COPY tsconfig.json ./

# Set development environment
ENV NODE_ENV=development

EXPOSE 3000

# Development command
CMD ["npm", "run", "dev", "--workspace=@spheroseg/frontend"]

# Builder stage for production
FROM base AS builder

# Accept build arguments
ARG VITE_API_URL
ARG VITE_API_BASE_URL
ARG VITE_ASSETS_URL

# Copy package files
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/frontend ./packages/frontend
COPY packages/shared ./packages/shared
COPY packages/types ./packages/types
COPY tsconfig.json ./

# Set build-time environment variables
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ASSETS_URL=$VITE_ASSETS_URL

# Build the application
RUN npm run build --workspace=@spheroseg/frontend

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx config
COPY packages/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]