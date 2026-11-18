# syntax=docker/dockerfile:1

# ---- Compilación de la PWA y el panel ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Imagen final: solo servidor y archivos estáticos ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    MANGUARE_DATA_FILE=/data/alerts.json \
    MANGUARE_BIODIVERSITY_FILE=/data/biodiversity.json \
    MANGUARE_STATIC_DIR=/app/web/dist

COPY package.json ./
COPY server ./server
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /data && chown -R node:node /app /data
USER node

VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
