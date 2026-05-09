#!/usr/bin/env bash
#
# Tar.gz de configs declarados em BACKUP_CONFIG_PATHS (:) e opcional docker-compose no DOCKER_PROJECT_DIR.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

OUT="${1:?caminho .tar.gz obrigatório}"
load_env_files
require_cmd tar

STAGE="$(mktemp -d)"
mkdir -p "$STAGE/files"

: >"$STAGE/MANIFEST.tsv"

stage_file() {
  local src="${1:?}"
  [[ -e "$src" ]] || return 0
  local base dest
  base="$(basename "$src")"
  dest="$STAGE/files/${base}"
  if [[ -e "$dest" ]]; then
    dest="$STAGE/files/${base}_$(echo "$src" | sha256sum | cut -c1-6)"
  fi
  cp -a "$src" "$dest" 2>/dev/null || cp "$src" "$dest"
  printf '%s\t%s\n' "$src" "$dest" >>"$STAGE/MANIFEST.tsv"
}

if [[ -n "${DOCKER_PROJECT_DIR:-}" ]]; then
  [[ -f "$DOCKER_PROJECT_DIR/docker-compose.yml" ]] && stage_file "$DOCKER_PROJECT_DIR/docker-compose.yml"
  if [[ "${BACKUP_ALLOW_FULL_ENV:-}" == "true" ]] && [[ -f "$DOCKER_PROJECT_DIR/.env" ]]; then
    stage_file "$DOCKER_PROJECT_DIR/.env"
  fi
fi

if [[ -n "${BACKUP_CONFIG_PATHS:-}" ]]; then
  IFS=':' read -ra PARTS <<<"$BACKUP_CONFIG_PATHS"
  for p in "${PARTS[@]}"; do
    p="$(echo "$p" | xargs)"
    [[ -z "$p" ]] && continue
    [[ -e "$p" ]] && stage_file "$p"
  done
fi

if [[ ! -s "$STAGE/MANIFEST.tsv" ]]; then
  echo "# nenhum ficheiro" >"$STAGE/MANIFEST.tsv"
fi

tar -czf "$OUT" -C "$STAGE" MANIFEST.tsv files
rm -rf "$STAGE"

if ! gzip -t "$OUT"; then
  die "gzip -t falhou em $OUT"
fi

BYTES="$(wc -c <"$OUT" | tr -d ' ')"
log "Configs OK ($BYTES bytes)"
