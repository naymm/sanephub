#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/backup-common.sh"
load_env_files

iso_stamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

run_id="${2:-${BACKUP_CORRELATION_RUN_ID:-manual}}"

log "[backup] Início RUN_ID=$run_id"

timestamp="$(iso_stamp)"

BASE_DIR="${BACKUP_LOCAL_ROOT}/run-${timestamp}-${run_id}"
DB_DIR="$BASE_DIR/database"
STORAGE_DIR="$BASE_DIR/storage"

mkdir -p "$DB_DIR"
mkdir -p "$STORAGE_DIR"

log "[backup] Diretório: $BASE_DIR"

require_var BACKUP_DATABASE_URL
require_var SUPABASE_STORAGE_VOLUME

# -----------------------------------------------------------------------------
# DATABASE BACKUP
# -----------------------------------------------------------------------------

DB_FILE="$DB_DIR/db.sql"

log "[backup] A executar pg_dump..."

pg_dump "$BACKUP_DATABASE_URL" > "$DB_FILE"

gzip "$DB_FILE"

log "[backup] DB backup concluído"

# -----------------------------------------------------------------------------
# STORAGE BACKUP (CORRIGIDO via Docker volume)
# -----------------------------------------------------------------------------

log "[backup] A fazer backup do storage..."

docker run --rm \
  -v "$SUPABASE_STORAGE_VOLUME":/data \
  -v "$STORAGE_DIR":/backup \
  alpine \
  tar -czf /backup/storage.tar.gz -C /data .

log "[backup] Storage backup concluído"

# -----------------------------------------------------------------------------
# UPDATE STATUS (compatível com tua constraint)
# -----------------------------------------------------------------------------

if [[ -n "${BACKUP_CORRELATION_RUN_ID:-}" ]]; then
  log "[backup] Atualizando status..."

  psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    UPDATE public.erp_backup_runs
    SET phase = 'done'
    WHERE id = '$BACKUP_CORRELATION_RUN_ID';
  "
fi

log "[backup] Concluído RUN_ID=$run_id"