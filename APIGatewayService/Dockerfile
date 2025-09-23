# =============================================================================
# Multi-stage Docker build for API Gateway Service
# =============================================================================

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apigateway -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Copy application code
COPY src/ ./src/
COPY swagger.js ./
COPY generate_openapi.js ./
COPY .env.example ./

# Create necessary directories and set permissions
RUN mkdir -p /app/logs && \
    chown -R apigateway:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER apigateway

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 3000, path: '/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Labels for metadata
LABEL maintainer="Cycle Store Team" \
      version="1.0.0" \
      description="API Gateway Service for Cycle Store System" \
      org.opencontainers.image.source="https://github.com/cyclestore/api-gateway" \
      org.opencontainers.image.documentation="https://github.com/cyclestore/api-gateway/blob/main/README.md"

# Start the application
CMD ["node", "src/server.js"]
