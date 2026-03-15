#!/usr/bin/env bash
set -euo pipefail

# Native installation for Ubuntu 22.04/24.04 (no Docker).

APP_DIR="${APP_DIR:-/opt/poliverso-pos}"
APP_USER="${APP_USER:-poliverso}"
APP_GROUP="${APP_GROUP:-poliverso}"
NODE_MAJOR="${NODE_MAJOR:-20}"
DB_NAME="${DB_NAME:-poliverse_db}"
DB_USER="${DB_USER:-poliverse_app}"
DB_PASSWORD="${DB_PASSWORD:-change_me}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root (sudo)." >&2
  exit 1
fi

apt-get update
apt-get install -y curl ca-certificates gnupg lsb-release git postgresql postgresql-contrib

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${APP_USER}"
fi

mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}" || true

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')
\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

if [ ! -f "${APP_DIR}/.env" ]; then
  cat > "${APP_DIR}/.env" <<ENV
NODE_ENV=production
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"
API_PORT=3001
VITE_API_URL="http://127.0.0.1:3001/api/v1"
JWT_SECRET="change_me"
LOG_LEVEL=info
ENV
  chown "${APP_USER}:${APP_GROUP}" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
fi

echo "Instalacion base completada."
echo "1) Copia el repositorio en ${APP_DIR}"
echo "2) Ejecuta: cd ${APP_DIR} && npm install && npm run prisma:generate && npx prisma migrate deploy && npm run prisma:seed && npm run build"
echo "3) Instala servicios systemd con scripts/install-systemd.sh"
