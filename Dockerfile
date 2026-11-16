# syntax=docker/dockerfile:1.7

# Versão exata da imagem base: builds reproduzíveis. O Dependabot propõe as atualizações.
ARG NODE_IMAGE=node:22.22.3-bookworm-slim

# ---- Estágio 1: dependências de produção (compila os módulos nativos se não houver binário pronto) ----
FROM ${NODE_IMAGE} AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# ---- Estágio 2: imagem final enxuta ----
FROM ${NODE_IMAGE}

# Fontes para o texto das artes e tzdata para o fuso de São Paulo.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core tzdata \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PORTA=3000 \
    STORAGE_DIR=/app/storage \
    # Com o sistema de arquivos somente leitura, o cache do fontconfig vai para o /tmp (tmpfs).
    XDG_CACHE_HOME=/tmp/.cache

WORKDIR /app
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --chown=root:root package.json ./
COPY --chown=root:root src ./src
COPY --chown=root:root views ./views
COPY --chown=root:root public ./public

# O código pertence ao root e é só leitura para a aplicação; ela só escreve em /app/storage.
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
VOLUME ["/app/storage"]
EXPOSE 3000

HEALTHCHECK --interval=1m --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--max-old-space-size=384", "src/server.js"]
