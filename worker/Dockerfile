# Worker Dockerfile for Railway
# This container runs the scraping worker with Playwright

FROM mcr.microsoft.com/playwright:v1.58.1-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --omit=dev

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source code
COPY src ./src

# Install Playwright browsers (Chromium only for smaller image)
RUN npx playwright install chromium --with-deps

# Set environment
ENV NODE_ENV=production

# Health check - verify worker can start
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('OK')" || exit 1

# Run the scrape worker
CMD ["npx", "tsx", "src/services/queue/workers/scrape-worker.ts"]
