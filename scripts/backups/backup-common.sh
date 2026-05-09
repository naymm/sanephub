#!/usr/bin/env bash
#
# Utilitários comuns do sistema de backup
# NÃO contém lógica de execução

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# -----------------------------------------------------------------------------
# LOAD ENV (SUPABASE DOCKER SAFE)
# -----------------------------------------------------------------------------

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
    die "Nenhum ficheiro .env ou .env.backup encontrado"
  fi
}

# -----------------------------------------------------------------------------
# LOGGING
# -----------------------------------------------------------------------------

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

# -----------------------------------------------------------------------------
# ERROR HANDLER
# -----------------------------------------------------------------------------

die() {
  echo "ERROR: $*" >&2
  exit 1
}

# -----------------------------------------------------------------------------
# REQUIRE VAR
# -----------------------------------------------------------------------------

require_var() {
  local var_name="$1"
  local var_value="${!var_name:-}"

  if [[ -z "$var_value" ]]; then
    die "Variável obrigatória não definida: $var_name"
  fi
}