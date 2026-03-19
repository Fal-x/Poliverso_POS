#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-${ROOT_DIR}}"
APP_USER="${APP_USER:-poliverso}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
NODE_MAJOR="${NODE_MAJOR:-20}"
DB_NAME="${DB_NAME:-poliverse_db}"
DB_USER="${DB_USER:-poliverse_app}"
DB_PASSWORD="${DB_PASSWORD:-change_me}"
API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"
RUN_SEED="${RUN_SEED:-true}"
RUN_INSTALL_UBUNTU="${RUN_INSTALL_UBUNTU:-true}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root (sudo)." >&2
  exit 1
fi

if [ ! -f "${APP_DIR}/package.json" ]; then
  echo "No se encontro package.json en APP_DIR=${APP_DIR}." >&2
  echo "Clona primero el repositorio en el directorio objetivo y vuelve a ejecutar." >&2
  exit 1
fi

run_as_app() {
  sudo -u "${APP_USER}" -H bash -lc "cd '${APP_DIR}' && $*"
}

echo "==> Bootstrap productivo para POLIVERSO POS"
echo "APP_DIR=${APP_DIR}"
echo "APP_USER=${APP_USER}"
echo "DB_NAME=${DB_NAME}"
echo "API_PORT=${API_PORT}"
echo "WEB_PORT=${WEB_PORT}"

if [ "${RUN_INSTALL_UBUNTU}" = "true" ]; then
  echo "==> Instalando dependencias base del servidor"
  APP_DIR="${APP_DIR}" \
  APP_USER="${APP_USER}" \
  APP_GROUP="${APP_GROUP}" \
  NODE_MAJOR="${NODE_MAJOR}" \
  DB_NAME="${DB_NAME}" \
  DB_USER="${DB_USER}" \
  DB_PASSWORD="${DB_PASSWORD}" \
  "${ROOT_DIR}/scripts/install-ubuntu.sh"
fi

chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

if [ ! -f "${APP_DIR}/.env" ] && [ -f "${APP_DIR}/.env.example" ]; then
  cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  chown "${APP_USER}:${APP_GROUP}" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
fi

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "No existe ${APP_DIR}/.env ni fue posible generarlo." >&2
  exit 1
fi

echo "==> Instalando dependencias Node"
if [ -f "${APP_DIR}/package-lock.json" ]; then
  run_as_app "npm ci"
else
  run_as_app "npm install"
fi

echo "==> Generando cliente Prisma"
run_as_app "npm run prisma:generate"

echo "==> Aplicando migraciones de produccion"
run_as_app "npx prisma migrate deploy"

if [ "${RUN_SEED}" = "true" ]; then
  echo "==> Ejecutando seed inicial"
  run_as_app "npm run prisma:seed"
fi

echo "==> Compilando frontend"
run_as_app "npm run build"

echo "==> Instalando y levantando servicios systemd"
APP_DIR="${APP_DIR}" \
APP_USER="${APP_USER}" \
APP_GROUP="${APP_GROUP}" \
API_PORT="${API_PORT}" \
WEB_PORT="${WEB_PORT}" \
"${ROOT_DIR}/scripts/install-systemd.sh"

echo "==> Verificando healthcheck"
curl -fsS "http://127.0.0.1:${API_PORT}/health"
echo

echo "==> Estado de servicios"
systemctl --no-pager --full status poliverso-api.service | head -n 20 || true
systemctl --no-pager --full status poliverso-web.service | head -n 20 || true

cat <<EOF

Bootstrap completado.

Comandos utiles:
  journalctl -u poliverso-api -f
  journalctl -u poliverso-web -f
  systemctl restart poliverso-api poliverso-web
  curl -s http://127.0.0.1:${API_PORT}/health

Variables configurables:
  APP_DIR APP_USER APP_GROUP NODE_MAJOR DB_NAME DB_USER DB_PASSWORD API_PORT WEB_PORT RUN_SEED RUN_INSTALL_UBUNTU
EOF
