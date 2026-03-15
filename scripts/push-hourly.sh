#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${BRANCH:-main}"

cd "$REPO_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "No es un repo git válido: ${REPO_DIR}" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git commit -m "chore: auto push $(date -u +"%Y-%m-%d %H:%M:%SZ")"
  git push origin "$BRANCH"
else
  echo "No hay cambios para subir."
fi
