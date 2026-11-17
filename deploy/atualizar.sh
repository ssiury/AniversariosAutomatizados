#!/usr/bin/env bash
# Atualiza a aplicação na VM com a imagem publicada pelo CI.
#
#   bash deploy/atualizar.sh               # última versão da main (tag latest)
#   bash deploy/atualizar.sh sha-1a2b3c4   # versão específica, também serve para rollback
#   bash deploy/atualizar.sh --build       # compila na VM (sem CI; precisa do swap)
#
# As tags disponíveis aparecem em Packages, no repositório do GitHub.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only   # Caddyfile, compose e scripts acompanham o código

if [ "${1:-}" = "--build" ]; then
  sudo docker compose up -d --build
else
  export TAG="${1:-latest}"
  sudo --preserve-env=TAG docker compose pull app
  sudo --preserve-env=TAG docker compose up -d
fi

sudo docker image prune -f >/dev/null
echo "Aguardando o healthcheck..."
for _ in $(seq 1 30); do
  estado="$(sudo docker inspect -f '{{.State.Health.Status}}' "$(sudo docker compose ps -q app)")"
  if [ "$estado" = "healthy" ]; then
    echo "Aplicação no ar (${TAG:-build local})."
    exit 0
  fi
  sleep 3
done
echo "A aplicação não ficou saudável. Veja: sudo docker compose logs --tail=100 app" >&2
exit 1
