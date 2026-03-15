#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [ ! -f .env ]; then
  echo "Falta .env en ${ROOT_DIR}" >&2
  exit 1
fi

set -a
source .env
set +a

: "${DATABASE_URL:?DATABASE_URL requerido}"
: "${API_PORT:=3001}"

if command -v pg_isready >/dev/null 2>&1; then
  PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" ./scripts/wait-for-postgres.sh
fi

npx prisma migrate deploy
npm run build
exec npm run api:start
