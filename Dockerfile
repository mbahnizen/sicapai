# ─── Stage 1: Build frontend (Vite) ──────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

# Build-time Firebase config — passed via --set-build-env-vars in CI.
# Vite bakes these into the JS bundle at build time (import.meta.env.VITE_*).
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID

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
