# ==========================================
# Stage 1: Build the React + Vite PWA application
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source tree
COPY . .

# Ensure sql.js WebAssembly binary is present in public/
RUN cp node_modules/sql.js/dist/sql-wasm.wasm public/sql-wasm.wasm 2>/dev/null || true

# Build the production PWA bundle
RUN npm run build

# ==========================================
# Stage 2: Serve Full-Stack Muzika (Node + Express + PWA)
# ==========================================
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY package*.json ./

# Reuse node_modules from builder stage (avoids peer dependency conflicts and second install)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY server.ts ./
COPY tsconfig.json ./

EXPOSE 80

# Healthcheck to verify Muzika API is actively responding (supports both IPv4 and dynamic PORT env var)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${PORT:-80}/api/health" || exit 1

# Start Muzika full-stack server using node
CMD ["node", "./node_modules/tsx/dist/cli.mjs", "server.ts"]
