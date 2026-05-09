#!/usr/bin/env bash
#
# Upload incremental para Google Drive (ou compatível) via rclone.
# Env: RCLONE_REMOTE_ROOT (ex: gdrive:ERP_BACKUPS)
# Argumento 1: directório da corrida (contém opcionalmente database/, storage/, configs/)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

SRC="${1:?directório da corrida obrigatório}"
load_env_files
require_cmd rclone

ROOT="${RCLONE_REMOTE_ROOT:?export RCLONE_REMOTE_ROOT=gdrv:ERP_BACKUPS}"
TRIES="${RCLONE_RETRY:-3}"

run_rclone_with_retry() {
  local attempts=0
  while [[ $attempts -lt "$TRIES" ]]; do
    attempts=$((attempts + 1))
    # shellcheck disable=SC2068
    if rclone "$@"; then
      return 0
    fi
    log "rclone falhou (tentativa $attempts/$TRIES); a aguardar 10s..."
    sleep 10
  done
  return 1
}

EXTRA=()
[[ -n "${RCLONE_EXTRA_ARGS:-}" ]] && readarray -td' ' EXTRA < <(printf '%s ' $RCLONE_EXTRA_ARGS)

log "Upload rclone desde $SRC → $ROOT"

SUBS=("database" "storage" "configs")

for sub in "${SUBS[@]}"; do
  if [[ -d "$SRC/$sub" ]] && ls "$SRC/$sub" >/dev/null 2>&1; then
    log "Copiar pasta $sub"
    run_rclone_with_retry copy "$SRC/$sub" "${ROOT%/}/$sub" \
      "--transfers=${RCLONE_TRANSFERS:-4}" \
      "--checkers=${RCLONE_CHECKERS:-8}" \
      "--immutable" \
      "${EXTRA[@]}"
  fi
done

log "Upload rclone concluído."
