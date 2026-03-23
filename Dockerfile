# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build Next.js
RUN npm run build

# Production stage
FROM node:20-slim AS runner
WORKDIR /app

# Install runtime dependencies for better-sqlite3 + pdftotext + pandoc + tesseract + edge-tts
RUN apt-get update && apt-get install -y \
  poppler-utils \
  pandoc \
  tesseract-ocr \
  tesseract-ocr-ita \
  python3 \
  python3-pip \
  && pip3 install --break-system-packages edge-tts \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/src ./src

# Data directory (will be mounted as persistent volume)
RUN mkdir -p /data

EXPOSE 3000

CMD ["npm", "start"]
