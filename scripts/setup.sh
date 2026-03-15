#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no esta instalado. Instala Node 20+ y vuelve a intentar." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm no esta disponible. Reinstala Node.js con npm." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql no esta disponible. Instala PostgreSQL client (postgresql-client)." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cat <<'ENV' > .env
DATABASE_URL="postgresql://poliverse_app:change_me@localhost:5432/poliverse_db?schema=public"
API_PORT=3001
VITE_API_URL="http://localhost:3001/api/v1"
JWT_SECRET="change_me"
ENV
  echo ".env creado con DATABASE_URL por defecto."
fi

if ! grep -q "^DATABASE_URL=" .env; then
  echo "DATABASE_URL no esta definido en .env. Corrige el archivo y vuelve a intentar." >&2
  exit 1
fi

DATABASE_URL_VALUE="$(grep "^DATABASE_URL=" .env | head -n 1 | cut -d '=' -f2- | tr -d '\"')"
if [ -z "${DATABASE_URL_VALUE}" ]; then
  echo "DATABASE_URL esta vacio en .env. Corrige el archivo y vuelve a intentar." >&2
  exit 1
fi

if command -v pg_isready >/dev/null 2>&1; then
  PGHOST="$(echo "${DATABASE_URL_VALUE}" | sed -E 's#^postgresql://[^@]+@([^:/?]+).*$#\1#')"
  PGPORT="$(echo "${DATABASE_URL_VALUE}" | sed -E 's#^postgresql://[^@]+@[^:/?]+:([0-9]+).*$#\1#')"
  export PGHOST PGPORT
  ./scripts/wait-for-postgres.sh
else
  echo "pg_isready no esta disponible; se omite validacion de disponibilidad de PostgreSQL."
fi

echo "Instalando dependencias..."
npm install

echo "Generando Prisma Client..."
npm run prisma:generate

echo "Ejecutando migraciones..."
npm run prisma:migrate

echo "Ejecutando seed..."
npm run prisma:seed

echo "Listo. Base de datos y Prisma configurados."
