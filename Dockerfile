FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Type check and build
RUN bunx tsc --noEmit && bunx tsc --outDir dist

# Runtime stage
FROM oven/bun:1-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup -g 1000 imap && adduser -D -u 1000 -G imap imap

# Set ownership
RUN chown -R imap:imap /app

USER imap

EXPOSE 3000

# ENCRYPTION_KEY must be provided via environment variable
# Authentication uses per-request encrypted credentials (no users.json needed)

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "dist/index.js"]
