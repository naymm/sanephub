#!/usr/bin/env bash
#
# Worker da fila de backups (queued → running)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

load_env_files

# -----------------------------------------------------------------------------
# VALIDATION
# -----------------------------------------------------------------------------

require_var BACKUP_DATABASE_URL

log "[queue] BACKUP_DATABASE_URL carregado"

# -----------------------------------------------------------------------------
# CLAIM NEXT JOB (SAFE LOCK)
# -----------------------------------------------------------------------------

RUN_ID="$(
psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -c "
WITH c AS (
  SELECT id
  FROM public.erp_backup_runs
  WHERE status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE public.erp_backup_runs r
   SET status = 'running',
       started_at = now(),
       phase = 'init'
FROM c
WHERE r.id = c.id
RETURNING r.id;
" | grep -Eo '[0-9a-fA-F-]{36}' | head -n 1
)"



RUN_ID="$(echo "$RUN_ID" | tr -d '[:space:]')"

# -----------------------------------------------------------------------------
# NO JOBS
# -----------------------------------------------------------------------------

if [[ -z "$RUN_ID" ]]; then
  log "[queue] Nenhuma corrida pendente."
  exit 0
fi

# -----------------------------------------------------------------------------
# EXECUTE BACKUP
# -----------------------------------------------------------------------------

export BACKUP_CORRELATION_RUN_ID="$RUN_ID"

log "[queue] Iniciando backup RUN_ID=$RUN_ID"

exec "$SCRIPT_DIR/backup.sh" --from-queue-id "$RUN_ID"