#!/usr/bin/env bash
# Prepara uma VM e2-micro (Debian/Ubuntu) do Google Cloud para rodar o sistema.
# Uso: bash deploy/instalar-vm.sh   (na pasta do projeto, dentro da VM)
set -euo pipefail

# 1 GB de RAM é pouco para o build da imagem: cria 2 GB de swap se ainda não houver.
if ! swapon --show | grep -q .; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

sudo timedatectl set-timezone America/Sao_Paulo || true

[ -f .env ] || { cp .env.example .env; echo "Edite o arquivo .env antes de subir."; exit 0; }

mkdir -p storage
# O container roda como o usuário "node" (uid 1000).
sudo chown -R 1000:1000 storage
# Usa a imagem publicada pelo CI. Se ela não estiver acessível (pacote privado sem
# "docker login ghcr.io", ou CI ainda não rodou), compila na própria VM.
if sudo docker compose pull app; then
  sudo docker compose up -d
else
  echo "Imagem do GHCR indisponível: compilando na VM (pode levar alguns minutos)."
  sudo docker compose up -d --build
fi
echo "Pronto. Acesse https://$(grep ^DOMINIO= .env | cut -d= -f2)"
