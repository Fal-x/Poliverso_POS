#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no esta instalado. Instala Docker Desktop y vuelve a intentar." >&2
  exit 1
fi

if ! command -v docker compose >/dev/null 2>&1; then
  echo "Docker Compose no esta disponible. Actualiza Docker Desktop." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no esta instalado. Instala Node 20+ y vuelve a intentar." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm no esta disponible. Reinstala Node.js con npm." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cat <<'ENV' > .env
DATABASE_URL="postgresql://poliverse_app:poliverse_password@localhost:5433/poliverse_db?schema=public"
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

echo "Levantando Postgres con Docker..."
docker compose up -d db

if command -v pg_isready >/dev/null 2>&1; then
  ./scripts/wait-for-postgres.sh
else
  echo "pg_isready no esta disponible localmente; esperando 5s..."
  sleep 5
fi

echo "Verificando base de datos..."
docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'poliverse_app') THEN
    CREATE ROLE poliverse_app WITH LOGIN PASSWORD 'poliverse_password';
  END IF;
END
$$;

SELECT 'CREATE DATABASE poliverse_db OWNER poliverse_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'poliverse_db')
\\gexec

GRANT ALL PRIVILEGES ON DATABASE poliverse_db TO poliverse_app;
SQL

echo "Instalando dependencias..."
npm install

echo "Generando Prisma Client..."
npm run prisma:generate

echo "Ejecutando migraciones..."
npm run prisma:migrate

echo "Ejecutando seed..."
npm run prisma:seed

echo "Listo. Base de datos y Prisma configurados."
