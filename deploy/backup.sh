#!/usr/bin/env bash
# Backup do banco e das imagens. Agende no cron da VM, por exemplo:
#   0 3 * * * /caminho/do/projeto/deploy/backup.sh >> /caminho/do/projeto/backups/backup.log 2>&1
#
# A cópia local fica em backups/ por 30 dias. Se BACKUP_REMOTO estiver definido no .env
# (ex.: gcs:meu-bucket/aniversarios), a pasta do dia também é enviada para fora da VM com o rclone.
# Um backup que fica só no disco da VM se perde junto com ela.
set -euo pipefail
cd "$(dirname "$0")/.."

destino="backups/$(date +%F)"
mkdir -p "$destino"

# API de backup online do SQLite: cópia consistente mesmo com a aplicação gravando.
sudo docker compose exec -T app node -e "
  const D = require('better-sqlite3');
  new D('/app/storage/dados.sqlite', { readonly: true }).backup('/app/storage/backup.sqlite').then(() => process.exit(0));
"
sudo mv storage/backup.sqlite "$destino/dados.sqlite"
tar -czf "$destino/imagens.tar.gz" -C storage fotos fundos
find backups -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
echo "Backup local em $destino"

remoto="$(grep -E '^BACKUP_REMOTO=' .env 2>/dev/null | cut -d= -f2- || true)"
if [ -n "$remoto" ]; then
  if ! command -v rclone >/dev/null; then
    echo "BACKUP_REMOTO definido, mas o rclone não está instalado (sudo apt install rclone)." >&2
    exit 1
  fi
  rclone copy "$destino" "$remoto/$(date +%F)"
  echo "Backup remoto em $remoto/$(date +%F)"
fi
