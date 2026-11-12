# Estágio 1: instala as dependências (compila módulos nativos se não houver binário pronto).
FROM node:22-bookworm-slim AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Estágio 2: imagem final enxuta.
FROM node:22-bookworm-slim

# Fontes para o texto das artes e tzdata para o fuso de São Paulo.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core tzdata \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PORTA=3000 \
    STORAGE_DIR=/app/storage

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY public ./public

RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
VOLUME ["/app/storage"]
EXPOSE 3000

HEALTHCHECK --interval=1m --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--max-old-space-size=384", "src/server.js"]
