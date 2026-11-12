#!/usr/bin/env bash
# Cópia consistente do banco e das imagens. Agende no cron da VM, ex.: 0 3 * * * /caminho/deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
destino="backups/$(date +%F)"
mkdir -p "$destino"
sudo docker compose exec -T app node -e "
  const D = require('better-sqlite3');
  new D('/app/storage/dados.sqlite', { readonly: true }).backup('/app/storage/backup.sqlite').then(() => process.exit(0));
"
sudo mv storage/backup.sqlite "$destino/dados.sqlite"
tar -czf "$destino/imagens.tar.gz" -C storage fotos fundos
find backups -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
echo "Backup em $destino"
