#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

load_env_files() {
  if [[ -f "$SCRIPT_DIR/.env.backup" ]]; then
    set -a
    source "$SCRIPT_DIR/.env.backup"
    set +a
  elif [[ -f "$SCRIPT_DIR/.env" ]]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
  else
    echo "Nenhum .env encontrado" >&2
    exit 1
  fi
}

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_var() {
  local name="$1"
  [[ -z "${!name:-}" ]] && die "Variável obrigatória: $name"
}