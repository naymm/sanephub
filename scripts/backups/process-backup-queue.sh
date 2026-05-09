#!/usr/bin/env bash
#
# Processa até um pedido manual em fila (status=queued → running). Executar via cron a cada minuto.
# Ou: systemd timer / supervise.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

load_env_files

if [[ -z "${BACKUP_DATABASE_URL:-}" ]]; then
  die "BACKUP_DATABASE_URL é necessário para a fila manual"
fi

RUN_ID="$(psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "
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
FROM c WHERE r.id = c.id RETURNING r.id::text;
" | xargs)"

if [[ -z "$RUN_ID" ]]; then
  log "[fila] Nenhuma corrida pendente."
  exit 0
fi

export BACKUP_CORRELATION_RUN_ID="$RUN_ID"
exec "$SCRIPT_DIR/backup.sh" --from-queue-id "$RUN_ID"
