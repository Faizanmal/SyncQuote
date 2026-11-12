# Production Dockerfile for NestJS Backend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Chromium for PDF generation (Puppeteer)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    openssl \
  && rm -rf /var/cache/apk/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Production deps + prisma CLI (needed for migrate deploy on boot)
RUN npm ci --omit=dev && \
    npm install prisma@7.10.0 --no-save && \
    npx prisma generate && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/syncquote-entrypoint.sh

# Keep startup outside /app so development bind mounts cannot hide it.
RUN sed -i 's/\r$//' /usr/local/bin/syncquote-entrypoint.sh && \
    chmod 755 /usr/local/bin/syncquote-entrypoint.sh && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3001

# Generous start period: migrations + Nest boot
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/v1/health/ping', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

ENTRYPOINT ["/bin/sh", "/usr/local/bin/syncquote-entrypoint.sh"]
