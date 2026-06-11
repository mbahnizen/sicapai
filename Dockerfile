# ─── Stage 1: Build frontend (Vite) ──────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:24-alpine AS production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server/ ./server/
COPY --from=builder /app/dist ./dist/

ENV NODE_ENV=production
# Cloud Run injects PORT=8080 automatically; this is the default fallback.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
