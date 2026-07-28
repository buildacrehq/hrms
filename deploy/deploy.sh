#!/bin/bash
# Run from your LOCAL machine to build and push to the VPS
# Usage: bash deploy.sh <VPS_IP>
set -e

VPS_IP="${1:?Usage: bash deploy.sh <VPS_IP>}"
SSH="ssh root@$VPS_IP"

echo "==> Building Docker image..."
cd "$(dirname "$0")/../apps/api"
docker build -t ba-hrms-api:latest .

echo "==> Saving image..."
docker save ba-hrms-api:latest | gzip > /tmp/ba-hrms-api.tar.gz

echo "==> Uploading image to VPS ($VPS_IP)..."
scp /tmp/ba-hrms-api.tar.gz root@$VPS_IP:/root/ba-hrms-api.tar.gz
scp "$(dirname "$0")/docker-compose.yml" root@$VPS_IP:/root/docker-compose.yml

echo "==> Loading and starting on VPS..."
$SSH "
  set -e
  docker load < /root/ba-hrms-api.tar.gz
  rm /root/ba-hrms-api.tar.gz
  cd /root
  docker compose down --remove-orphans || true
  docker compose up -d
  docker compose ps
"

echo ""
echo "✅ Deployed! API is live at http://$VPS_IP/api/v1"
echo "   Swagger docs: http://$VPS_IP/api/docs"
