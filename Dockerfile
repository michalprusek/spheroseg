FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the app
COPY . .

# Set environment variables for development mode
ENV NODE_ENV development
ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
ENV DEBUG=* 

# Expose port 3000
EXPOSE 3000

# Start the app in dev mode with enhanced logging
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"] 