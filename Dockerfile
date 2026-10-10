# ==============================================================================
# Multi-stage Dockerfile for CoreBot
# ==============================================================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies, native compilation tools and ffmpeg
RUN apk add --no-cache openssl ffmpeg make python3 g++

# Copy package files
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies for build
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Prune devDependencies to keep image lean
RUN npm prune --omit=dev

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Add openssl and curl for Prisma runtime/healthcheck, ffmpeg for voice playback, and postgresql16-client for pg_dump backups
RUN apk add --no-cache openssl curl ffmpeg postgresql16-client

# Create non-root system group and user
RUN addgroup -S corebot && adduser -S corebot -G corebot

# Pre-create sound assets and backup directories with proper ownership for non-root corebot user
RUN mkdir -p /app/assets/sounds /app/backups && \
    chown -R corebot:corebot /app

# Copy built application and pruned production node_modules
COPY --from=builder --chown=corebot:corebot /app/package*.json ./
COPY --from=builder --chown=corebot:corebot /app/node_modules ./node_modules
COPY --from=builder --chown=corebot:corebot /app/dist ./dist
COPY --from=builder --chown=corebot:corebot /app/prisma ./prisma
COPY --chown=corebot:corebot assets ./assets
COPY --chown=corebot:corebot docker-entrypoint.sh ./docker-entrypoint.sh

# Ensure non-root ownership on copied assets and runtime directories
RUN chown -R corebot:corebot /app/assets/sounds /app/backups && \
    chmod -R 755 /app/assets/sounds /app/backups

# Make entrypoint executable
RUN chmod +x ./docker-entrypoint.sh

# Switch to non-root user
USER corebot

# Expose internal HTTP port (Fastify, Healthcheck, Bull-Board, Metrics, Webhooks)
EXPOSE 3000

ENV NODE_ENV=production

# Healthcheck checking the internal health server endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
