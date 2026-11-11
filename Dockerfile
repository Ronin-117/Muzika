# ==========================================
# Stage 1: Build the React + Vite PWA application (Native host architecture for speed)
# ==========================================
FROM --platform=$BUILDPLATFORM node:20-slim AS builder

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

# Prune dev dependencies natively on host architecture (avoids QEMU emulation during multi-arch builds)
RUN npm prune --omit=dev --legacy-peer-deps

# ==========================================
# Stage 2: Serve Full-Stack Muzika (Node + Express + PWA)
# ==========================================
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

# Copy pruned production dependencies and build artifacts from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 80

# Healthcheck to verify Muzika API is actively responding (using built-in Node.js http module)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 80) + '/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# Start Muzika full-stack server using compiled JavaScript bundle
CMD ["node", "dist/server.js"]


