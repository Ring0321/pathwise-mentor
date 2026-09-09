#!/usr/bin/env bash
set -euo pipefail

RELEASE_DIR="${1:-$(pwd)}"
APP_ROOT="/opt/sepath"
WEB_ROOT="/var/www/sepath"
DATA_ROOT="/var/lib/sepath"
ENV_DIR="/etc/sepath"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash deploy/tencent/install_on_ubuntu.sh"
  exit 1
fi

if [ ! -d "$RELEASE_DIR/web" ] || [ ! -d "$RELEASE_DIR/api/cloud" ]; then
  echo "Release directory must contain web/ and api/cloud/"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx curl ca-certificates rsync

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

mkdir -p "$APP_ROOT/api" "$WEB_ROOT" "$DATA_ROOT" "$ENV_DIR"
rsync -a --delete "$RELEASE_DIR/web/" "$WEB_ROOT/"
rsync -a --delete "$RELEASE_DIR/api/" "$APP_ROOT/api/"
chown -R www-data:www-data "$WEB_ROOT" "$APP_ROOT/api" "$DATA_ROOT"

if [ ! -f "$ENV_DIR/sepath-api.env" ]; then
  cp "$RELEASE_DIR/deploy/tencent/sepath-api.env.example" "$ENV_DIR/sepath-api.env"
  chmod 600 "$ENV_DIR/sepath-api.env"
  echo "Created $ENV_DIR/sepath-api.env. Fill LLM_MODEL and LLM_API_KEY before enabling live model calls."
fi

cp "$RELEASE_DIR/deploy/tencent/sepath-api.service" /etc/systemd/system/sepath-api.service
cp "$RELEASE_DIR/deploy/tencent/nginx-sepath.conf" /etc/nginx/sites-available/sepath.conf
ln -sf /etc/nginx/sites-available/sepath.conf /etc/nginx/sites-enabled/sepath.conf
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
systemctl enable sepath-api
systemctl restart sepath-api
nginx -t
systemctl restart nginx

curl -fsS http://127.0.0.1:8787/api/health >/dev/null
curl -fsS http://127.0.0.1/ >/dev/null

echo "SE-Path is online on this server. Open http://212.129.243.63 after cloud security-group ports 80/443 are allowed."
