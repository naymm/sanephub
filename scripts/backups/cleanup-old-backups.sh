#!/usr/bin/env bash
#
# Remove pastas de corridas antigas sob BACKUP_LOCAL_ROOT (subdirectório porcorrida ou por data).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

ROOT="${BACKUP_LOCAL_ROOT:?defina BACKUP_LOCAL_ROOT}"

load_env_files
DAY="${RETENTION_DAYS:?defina RETENTION_DAYS (>0)}"

log "Limpeza local: apagar cópias com +${DAY} dias (directório mãe=$ROOT)"

if [[ ! -d "$ROOT" ]]; then
  log "Pasta não existe; nada a fazer."
  exit 0
fi

find "$ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$DAY" -print | while read -r d; do
  log "Remover corrida antiga: $d"
  rm -rf "${d:?}"
done

if [[ "${BACKUP_REMOTE_CLEANUP_ENABLED:-}" == "true" ]] && command -v rclone >/dev/null 2>&1; then
  REM="${RCLONE_REMOTE_ROOT:-}"
  if [[ -n "$REM" ]]; then
    log "Limpeza remota rclone (--min-age ${DAY}d)"
    for sub in database storage configs; do
      rclone delete "${REM%/}/$sub" --min-age "${DAY}d" 2>/dev/null || log "Aviso: rclone delete $sub omitido ou vazio"
    done || true
  fi
fi

log "Limpeza concluída."
