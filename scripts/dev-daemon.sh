#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/.logs"
PID_DIR="${ROOT_DIR}/.pids"

BACKEND_PID_FILE="${PID_DIR}/backend.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend.pid"
BACKEND_LOG_FILE="${LOG_DIR}/backend.log"
FRONTEND_LOG_FILE="${LOG_DIR}/frontend.log"

API_PORT="${API_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
VITE_API_URL="${VITE_API_URL:-http://localhost:${API_PORT}/api/v1}"

mkdir -p "${LOG_DIR}" "${PID_DIR}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Falta comando requerido: $1" >&2
    exit 1
  fi
}

is_running() {
  local pid_file="$1"
  if [ ! -f "${pid_file}" ]; then
    return 1
  fi

  local pid
  pid="$(cat "${pid_file}")"
  if [ -z "${pid}" ]; then
    return 1
  fi

  if kill -0 "${pid}" >/dev/null 2>&1; then
    return 0
  fi

  rm -f "${pid_file}"
  return 1
}

start_process() {
  local name="$1"
  local cmd="$2"
  local pid_file="$3"
  local log_file="$4"

  if is_running "${pid_file}"; then
    echo "${name} ya esta corriendo (PID $(cat "${pid_file}"))."
    return 0
  fi

  nohup /bin/zsh -lc "${cmd}" >>"${log_file}" 2>&1 &
  local pid=$!
  echo "${pid}" > "${pid_file}"
  echo "${name} iniciado (PID ${pid}). Log: ${log_file}"
}

stop_process() {
  local name="$1"
  local pid_file="$2"

  if ! is_running "${pid_file}"; then
    echo "${name} no esta corriendo."
    rm -f "${pid_file}"
    return 0
  fi

  local pid
  pid="$(cat "${pid_file}")"
  kill "${pid}" >/dev/null 2>&1 || true
  rm -f "${pid_file}"
  echo "${name} detenido (PID ${pid})."
}

status_process() {
  local name="$1"
  local pid_file="$2"

  if is_running "${pid_file}"; then
    echo "${name}: running (PID $(cat "${pid_file}"))"
  else
    echo "${name}: stopped"
  fi
}

start_all() {
  require_cmd npm

  cd "${ROOT_DIR}"

  if command -v pg_isready >/dev/null 2>&1; then
    PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" ./scripts/wait-for-postgres.sh
  fi

  start_process \
    "backend" \
    "cd '${ROOT_DIR}' && API_PORT='${API_PORT}' npm run api:dev" \
    "${BACKEND_PID_FILE}" \
    "${BACKEND_LOG_FILE}"

  start_process \
    "frontend" \
    "cd '${ROOT_DIR}' && VITE_API_URL='${VITE_API_URL}' npm run dev -- --host 0.0.0.0 --port '${FRONTEND_PORT}'" \
    "${FRONTEND_PID_FILE}" \
    "${FRONTEND_LOG_FILE}"

  echo "Servicios arriba."
  echo "Backend log:  ${BACKEND_LOG_FILE}"
  echo "Frontend log: ${FRONTEND_LOG_FILE}"
}

stop_all() {
  stop_process "frontend" "${FRONTEND_PID_FILE}"
  stop_process "backend" "${BACKEND_PID_FILE}"
}

status_all() {
  status_process "backend" "${BACKEND_PID_FILE}"
  status_process "frontend" "${FRONTEND_PID_FILE}"
}

ACTION="${1:-start}"

case "${ACTION}" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status_all
    ;;
  *)
    echo "Uso: $0 {start|stop|restart|status}" >&2
    exit 1
    ;;
esac
