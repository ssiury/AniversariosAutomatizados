#!/usr/bin/env bash
# Atualiza a aplicação na VM: baixa o código, compila a imagem e sobe os contêineres.
#
#   bash deploy/atualizar.sh            # última versão da main
#   bash deploy/atualizar.sh 1a2b3c4    # um commit específico, também serve para rollback
#
# Os commits disponíveis aparecem em "git log --oneline" ou no GitHub.
set -euo pipefail
cd "$(dirname "$0")/.."

# Caddyfile, compose e scripts acompanham o código.
git fetch --quiet origin
if [ -n "${1:-}" ]; then
  git checkout --quiet --detach "$1"
else
  git checkout --quiet main
  git pull --quiet --ff-only origin main
fi
versao="$(git rev-parse --short HEAD)"
echo "Compilando a versão ${versao}..."

sudo docker compose up -d --build
sudo docker image prune -f >/dev/null

echo "Aguardando o healthcheck..."
for _ in $(seq 1 30); do
  estado="$(sudo docker inspect -f '{{.State.Health.Status}}' "$(sudo docker compose ps -q app)")"
  if [ "$estado" = "healthy" ]; then
    echo "Aplicação no ar (versão ${versao})."
    exit 0
  fi
  sleep 3
done
echo "A aplicação não ficou saudável. Veja: sudo docker compose logs --tail=100 app" >&2
exit 1
