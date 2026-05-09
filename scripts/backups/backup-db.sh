#!/usr/bin/env bash
#
# PostgreSQL pg_dump → .sql.gz
# Env: BACKUP_DATABASE_URL | PGPASSWORD + PGHOST etc.
# Argumento 1: ficheiro de saída (com extensão .sql.gz)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

OUT="${1:?caminho de saída .sql.gz obrigatório}"
load_env_files
require_cmd pg_dump
require_cmd gzip

log "Início pg_dump → $OUT"

if [[ -n "${BACKUP_DATABASE_URL:-}" ]]; then
  if ! pg_dump --no-owner --no-acl "${BACKUP_PG_DUMP_EXTRA_ARGS:-}" "$BACKUP_DATABASE_URL" \
    | gzip -9 >"$OUT"; then
    die "pg_dump falhou"
  fi
elif [[ -n "${PGHOST:-}" ]]; then
  if ! pg_dump --no-owner --no-acl "${BACKUP_PG_DUMP_EXTRA_ARGS:-}" \
      -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" \
    | gzip -9 >"$OUT"; then
    die "pg_dump falhou"
  fi
else
  die "Defina BACKUP_DATABASE_URL ou PGHOST/PGUSER/PGDATABASE"
fi

if ! gzip -t "$OUT"; then
  die "Verificação de integridade gzip falhou para $OUT"
fi

BYTES="$(wc -c <"$OUT" | tr -d ' ')"
log "pg_dump OK ($BYTES bytes)"
