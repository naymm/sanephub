#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/backup-common.sh"
load_env_files

require_var BACKUP_DATABASE_URL

log "[queue] BACKUP_DATABASE_URL carregado"

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
"
)"

RUN_ID="$(echo "$RUN_ID" | tr -d '[:space:]')"

if [[ -z "$RUN_ID" ]]; then
  log "[queue] Nenhuma corrida pendente."
  exit 0
fi

log "[queue] Iniciando backup RUN_ID=$RUN_ID"

export BACKUP_CORRELATION_RUN_ID="$RUN_ID"

exec "$SCRIPT_DIR/backup.sh" --from-queue-id "$RUN_ID"