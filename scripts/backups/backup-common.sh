#!/usr/bin/env bash
# shellcheck disable=SC1091
#
# Biblioteca partilhada — sourcing por outros scripts da pasta.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$SCRIPT_DIR/logs" "$SCRIPT_DIR/database" "$SCRIPT_DIR/storage" "$SCRIPT_DIR/configs"

log() {
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '[%s] %s\n' "$ts" "$*" | tee -a "${BACKUP_MASTER_LOG:-$SCRIPT_DIR/logs/backup-last.log}"
}

die() {
  log "ERRO: $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Comando obrigatório em falta: $1"
}

load_env_files() {
  # Carregar só variáveis (nunca executar comandos externos do ficheiro).
  [[ -f "$SCRIPT_DIR/.env.backup" ]] && set -a && source "$SCRIPT_DIR/.env.backup" && set +a
}

iso_stamp() {
  date '+%Y-%m-%d-%H-%M'
}

sanitize_sql_lit() {
  # Escapa aspas simples para literais PostgreSQL inline (evitar injecção quando se passam caminhos de ficheiro).
  local s="${1:?}"
  printf "%s" "$s" | sed "s/'/''/g"
}
