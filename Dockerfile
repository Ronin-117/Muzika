# ==========================================
# Stage 1: Build the React + Vite PWA application (Native host architecture for speed)
# ==========================================
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source tree
COPY . .

# Ensure sql.js WebAssembly binary is present in public/
RUN cp node_modules/sql.js/dist/sql-wasm.wasm public/sql-wasm.wasm 2>/dev/null || true

# Build the production PWA bundle and bundled Node server
RUN npm run build

# ==========================================
# Stage 2: Serve Full-Stack Muzika (Node + Express + PWA)
# ==========================================
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY package*.json ./

# Install only production dependencies for lightweight execution
RUN npm install --only=production --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src

EXPOSE 80

# Healthcheck to verify Muzika API is actively responding (supports both IPv4 and dynamic PORT env var)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${PORT:-80}/api/health" || exit 1

# Start Muzika full-stack server using compiled JavaScript bundle
CMD ["node", "dist/server.js"]
