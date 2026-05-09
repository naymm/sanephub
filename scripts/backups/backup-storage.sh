#!/usr/bin/env bash
#
# Compacta dados de Storage Supabase/Docker montados num caminho local.
# Env: STORAGE_DATA_PATH ou SUPABASE_STORAGE_DATA_DIR (directório com ficheiros do bucket).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

OUT="${1:?caminho de saída .tar.gz obrigatório}"
load_env_files
require_cmd tar

DIR="${SUPABASE_STORAGE_DATA_DIR:-${STORAGE_DATA_PATH:-}}"
if [[ -z "$DIR" ]] || [[ ! -d "$DIR" ]]; then
  log "Aviso: sem directório storage ($DIR); a criar tar.gz vazio (metadados)."
  tar -czf "$OUT" --files-from /dev/null
  exit 0
fi

log "Início backup storage desde $DIR"
tar -czf "$OUT" -C "$DIR" .

if [[ ! -s "$OUT" ]]; then
  die "Arquivo storage vazio inesperado"
fi

if ! gzip -t "$OUT"; then
  die "gzip -t falhou em $OUT"
fi

BYTES="$(wc -c <"$OUT" | tr -d ' ')"
log "Backup storage OK ($BYTES bytes)"
