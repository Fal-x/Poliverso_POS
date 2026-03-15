#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/poliverso-pos}"
APP_USER="${APP_USER:-poliverso}"
APP_GROUP="${APP_GROUP:-poliverso}"
API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root (sudo)." >&2
  exit 1
fi

install -d /etc/poliverso

cat > /etc/systemd/system/poliverso-api.service <<EOF
[Unit]
Description=Poliverso POS API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=API_PORT=${API_PORT}
ExecStart=/usr/bin/npm run api:start
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/poliverso-web.service <<EOF
[Unit]
Description=Poliverso POS Web (Vite Preview)
After=network.target poliverso-api.service
Wants=poliverso-api.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=PORT=${WEB_PORT}
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port ${WEB_PORT}
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable poliverso-api.service poliverso-web.service
systemctl restart poliverso-api.service poliverso-web.service

echo "Servicios instalados y reiniciados."
systemctl --no-pager --full status poliverso-api.service | head -n 20 || true
systemctl --no-pager --full status poliverso-web.service | head -n 20 || true
