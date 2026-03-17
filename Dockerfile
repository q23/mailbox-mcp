FROM oven/bun:1-alpine as builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* bun.lock* ./

# Install dependencies - try bun first, fallback to npm
RUN bun install --frozen-lockfile 2>/dev/null || npm install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Type check and build
RUN npx tsc --noEmit && npx tsc --outDir dist

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

# Create directory for users.json and set permissions
RUN mkdir -p /app && chown -R imap:imap /app

USER imap

EXPOSE 3000

# Note: users.json should be mounted as a volume or copied in before running
# Example: docker run -v ./users.json:/app/users.json:ro ...

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
