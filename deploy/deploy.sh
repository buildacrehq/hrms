#!/bin/bash
# Run from your LOCAL Mac to build both images and push to VPS
# Usage: bash deploy/deploy.sh <VPS_IP>
set -e

VPS_IP="${1:?Usage: bash deploy/deploy.sh <VPS_IP>}"
SSH="ssh root@$VPS_IP"
ROOT="$(dirname "$0")/.."

echo "==> Building API image..."
docker build -t ba-hrms-api:latest "$ROOT/apps/api"

echo "==> Building Admin image..."
docker build \
  --build-arg NEXT_PUBLIC_API_URL="http://$VPS_IP/api/v1" \
  -t ba-hrms-admin:latest \
  "$ROOT/apps/admin"

echo "==> Saving images..."
docker save ba-hrms-api:latest   | gzip > /tmp/ba-hrms-api.tar.gz
docker save ba-hrms-admin:latest | gzip > /tmp/ba-hrms-admin.tar.gz

echo "==> Uploading to VPS ($VPS_IP)..."
scp /tmp/ba-hrms-api.tar.gz   root@$VPS_IP:/root/
scp /tmp/ba-hrms-admin.tar.gz root@$VPS_IP:/root/
scp "$ROOT/deploy/docker-compose.yml" root@$VPS_IP:/root/
scp "$ROOT/deploy/.env"              root@$VPS_IP:/root/

echo "==> Loading and starting on VPS..."
$SSH "
  set -e
  docker load < /root/ba-hrms-api.tar.gz   && rm /root/ba-hrms-api.tar.gz
  docker load < /root/ba-hrms-admin.tar.gz && rm /root/ba-hrms-admin.tar.gz
  cd /root
  docker compose down --remove-orphans || true
  docker compose up -d
  sleep 5
  docker compose ps
"

echo ""
echo "✅ Done!"
echo "   Admin panel : http://$VPS_IP"
echo "   API         : http://$VPS_IP/api/v1"
echo "   Swagger     : http://$VPS_IP/api/docs"
echo ""
echo "Next: update Flutter API URL to http://$VPS_IP/api/v1 and rebuild APK"
