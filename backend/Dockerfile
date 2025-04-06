# -------- Builder Stage --------
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache make gcc g++ python3

COPY package*.json ./
COPY package-lock.json ./

RUN npm install
RUN npm rebuild bcrypt --build-from-source

COPY . .

COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/entrypoint.sh

RUN npm run build

# -------- Production Runtime Stage --------
FROM node:18-alpine AS production

WORKDIR /usr/src/app
RUN apk add --no-cache curl

# Set timeout environment variable (override at runtime if needed)
ENV REQUEST_TIMEOUT=30000

# Only copy production dependencies
COPY package*.json ./
COPY package-lock.json ./
RUN npm install --omit=dev

# Copy built app and entrypoint
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Expose the app port
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=5 CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]