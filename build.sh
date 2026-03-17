#!/bin/bash
# Build script for IMAP MCP Server
# Supports both Node.js and Bun

set -e

echo "Building IMAP MCP Server..."

# Check if bun is available, otherwise use npm
if command -v bun &> /dev/null; then
  echo "Using Bun for build..."
  bun install --frozen-lockfile
  bun run build
else
  echo "Using Node.js/npm for build..."
  npm install --frozen-lockfile
  npm run build
fi

echo "Build complete! Output in ./dist"
