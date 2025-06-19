# Use official Bun runtime as base image
FROM oven/bun:1.2.11-alpine AS base

# Set working directory
WORKDIR /app

# Install curl for image downloads
RUN apk add --no-cache curl

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bun -u 1001 -G nodejs

# Create downloads directory with proper permissions
RUN mkdir -p /app/downloads && \
    chown -R bun:nodejs /app

# Switch to non-root user
USER bun

# Expose port (if needed for health checks)
EXPOSE 3000

# Default command runs the Slack MCP server
CMD ["bun", "run", "src/slack-server.ts"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun run src/slack-server.ts --health-check || exit 1

# Labels for metadata
LABEL org.opencontainers.image.title="Claude MCP Slack"
LABEL org.opencontainers.image.description="Slack MCP server for Claude Code Action"
LABEL org.opencontainers.image.vendor="Atlas Futures"
LABEL org.opencontainers.image.licenses="MIT"