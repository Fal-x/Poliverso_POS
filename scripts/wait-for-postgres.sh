#!/usr/bin/env bash
set -euo pipefail

HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
MAX_RETRIES=60

for i in $(seq 1 ${MAX_RETRIES}); do
  if pg_isready -h "${HOST}" -p "${PORT}" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "Postgres no esta disponible en ${HOST}:${PORT} despues de ${MAX_RETRIES}s" >&2
exit 1
