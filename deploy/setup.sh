#!/bin/bash
# Run once on a fresh Contabo Ubuntu 22.04 VPS
set -e

echo "==> Installing Docker..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Starting Docker..."
systemctl enable docker
systemctl start docker

echo "==> Copying nginx config..."
cp nginx.conf /etc/nginx/sites-available/ba-hrms
ln -sf /etc/nginx/sites-available/ba-hrms /etc/nginx/sites-enabled/ba-hrms
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo ""
echo "✅ Server ready. Now run: bash deploy.sh"
