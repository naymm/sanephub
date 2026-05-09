#!/usr/bin/env bash
#
# Executa backup real (chamado pelo process-backup-queue.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/backup-common.sh"

load_env_files

# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------

iso_stamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

run_id="${2:-${BACKUP_CORRELATION_RUN_ID:-manual}}"

log "[backup] Início RUN_ID=$run_id"

# -----------------------------------------------------------------------------
# DIRECTORIES
# -----------------------------------------------------------------------------

timestamp="$(iso_stamp)"

BASE_DIR="${BACKUP_LOCAL_ROOT}/run-${timestamp}-${run_id}"
DB_DIR="$BASE_DIR/database"

mkdir -p "$DB_DIR"

log "[backup] Diretório: $BASE_DIR"

# -----------------------------------------------------------------------------
# VALIDATION
# -----------------------------------------------------------------------------

require_var BACKUP_DATABASE_URL

# -----------------------------------------------------------------------------
# DATABASE BACKUP
# -----------------------------------------------------------------------------

DB_FILE="$DB_DIR/db.sql"

log "[backup] A executar pg_dump..."

pg_dump "$BACKUP_DATABASE_URL" > "$DB_FILE"

log "[backup] DB dump concluído: $DB_FILE"

# -----------------------------------------------------------------------------
# COMPRESSÃO
# -----------------------------------------------------------------------------

gzip "$DB_FILE"

log "[backup] Compressão concluída: ${DB_FILE}.gz"

# -----------------------------------------------------------------------------
# UPDATE RUN STATUS (COMPATÍVEL COM CHECK CONSTRAINT)
# -----------------------------------------------------------------------------

if [[ -n "${BACKUP_CORRELATION_RUN_ID:-}" ]]; then
  log "[backup] Atualizando status da fila..."

  psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    UPDATE public.erp_backup_runs
    SET phase = 'done', status = 'success', completed_at = now() 
    WHERE id = '$BACKUP_CORRELATION_RUN_ID';
  "
fi

# -----------------------------------------------------------------------------
# DONE
# -----------------------------------------------------------------------------

log "[backup] Concluído RUN_ID=$run_id"