#!/usr/bin/env bash
#
# Orquestrador principal de backup (PostgreSQL + storage + configs + upload + limpeza).
#
#   ./backup.sh --cron                           # agendamento nocturno
#   ./process-backup-queue.sh                    # drena pedidos manuais (ERP)
#

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-common.sh
source "$SCRIPT_DIR/backup-common.sh"

MODE="${1:-}"
RUN_ID=""

umask 077
load_env_files

ROOT="${BACKUP_LOCAL_ROOT:?defina BACKUP_LOCAL_ROOT (ex: /var/backups/sanephub)}"
mkdir -p "$ROOT"
STAMP="$(iso_stamp)"
RUN_DIR="$ROOT/run-$STAMP"
export BACKUP_MASTER_LOG="$SCRIPT_DIR/logs/backup-$STAMP.log"
touch "$BACKUP_MASTER_LOG"

sql_exec() {
  [[ -z "${BACKUP_DATABASE_URL:-}" ]] && return 0
  psql "${BACKSTACK_PG_OPTS:-}" "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -c "$1"
}

RUN_UUID_ESC=""
START_UNIX=""
ART_DB_ESC=""
ART_ST_ESC=""
ART_CF_ESC=""
CHECKSUM_ESC=""

finalize_run() {
  local status="${1:?}"
  local summary
  summary="$(sanitize_sql_lit "${2:-}")"
  local errlit
  errlit="$(sanitize_sql_lit "${3:-}")"

  END_UNIX="$(date +%s)"
  DURATION_MS=$(( (END_UNIX - START_UNIX) * 1000 ))
  TOTAL_BYTES="$(du -sb "$RUN_DIR" 2>/dev/null | awk '{print $1}')"
  [[ -z "$TOTAL_BYTES" ]] && TOTAL_BYTES=0

  HEALTH="false"
  if [[ "$status" == "success" ]] || [[ "$status" == "partial" ]]; then HEALTH="true"; fi

  local chk_sql="null"
  [[ -n "$CHECKSUM_ESC" ]] && chk_sql="'${CHECKSUM_ESC}'"

  sql_exec "
  UPDATE public.erp_backup_runs
     SET completed_at = now(),
         status = '${status}',
         phase = 'done',
         total_bytes = ${TOTAL_BYTES:-0},
         duration_ms = ${DURATION_MS},
         log_summary = left('${summary}', 16000),
         error_message = nullif(left('${errlit}', 8000),''),
         health_ok = ${HEALTH},
         artifact_database_path = nullif('${ART_DB_ESC}',''),
         artifact_storage_path = nullif('${ART_ST_ESC}',''),
         artifact_configs_path = nullif('${ART_CF_ESC}',''),
         checksum_sha256_db = ${chk_sql}
   WHERE id = '${RUN_UUID_ESC}';
"
}

chk_bool_tf() {
  local v="${1:-f}"
  [[ "$v" == "t" ]] || [[ "${v,,}" == "true" ]]
}

if [[ "$MODE" == "--cron" ]]; then
  [[ -z "${BACKUP_DATABASE_URL:-}" ]] && die "BACKUP_DATABASE_URL obrigatório para --cron"
  RUN_ID="$(
    psql "${BACKSTACK_PG_OPTS:-}" "$BACKUP_DATABASE_URL" -tAc \
      "INSERT INTO public.erp_backup_runs (status, trigger_source, started_at, phase) VALUES ('running','cron',now(),'init') RETURNING id::text;"
  )"
  RUN_ID="$(echo "$RUN_ID" | xargs)"
elif [[ "$MODE" == "--from-queue-id" ]]; then
  RUN_ID="${2:?UUID}"
else
  die "uso: backup.sh --cron | backup.sh --from-queue-id <uuid>"
fi

RUN_UUID_ESC="$(sanitize_sql_lit "$RUN_ID")"
START_UNIX="$(date +%s)"
START_TS="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
log "===== Início corrida backup id=$RUN_ID modo=$MODE ($START_TS)"

mkdir -p "$RUN_DIR/database" "$RUN_DIR/storage" "$RUN_DIR/configs"

DO_DB="t"
DO_ST="t"
DO_CF="t"
GO_DRIVE="f"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [[ -n "${BACKUP_DATABASE_URL:-}" ]]; then
  LINE="$(
    psql "${BACKSTACK_PG_OPTS:-}" "$BACKUP_DATABASE_URL" -tAc \
      "select coalesce(backup_database_enabled,true),
              coalesce(backup_storage_enabled,true),
              coalesce(backup_configs_enabled,true),
              coalesce(google_drive_upload,false),
              retention_days::text,
              coalesce(array_to_string(extra_config_paths,':'),'')
         from public.erp_backup_settings where id=1 limit 1;"
  )"
  if [[ -n "$LINE" ]]; then
    IFS=$'\t' read -r DO_DB DO_ST DO_CF GO_DRIVE RETENTION_DAYS EXTRA_PATHS_DB <<<"$LINE"
    if [[ -z "${BACKUP_CONFIG_PATHS:-}" ]] && [[ -n "${EXTRA_PATHS_DB:-}" ]]; then
      export BACKUP_CONFIG_PATHS="$EXTRA_PATHS_DB"
    fi
  fi
fi

if [[ -n "${BACKUP_DATABASE_URL:-}" ]] && [[ -z "${DOCKER_PROJECT_DIR:-}" ]]; then
  DD="$(
    psql "${BACKSTACK_PG_OPTS:-}" "$BACKUP_DATABASE_URL" -tAc \
      "select nullif(trim(docker_project_dir),'') from public.erp_backup_settings where id=1 limit 1;"
  )"
  DD="$(echo "$DD" | xargs)"
  [[ -n "$DD" ]] && export DOCKER_PROJECT_DIR="$DD"
fi

HAS_OK=""
HAS_BAD=""
ERR_TAIL=""

mkdir -p "$RUN_DIR/meta"
printf '{"run_id":"%s","mode":"%s","stamp":"%s"}\n' "$RUN_ID" "$MODE" "$STAMP" >"$RUN_DIR/meta/manifest.json"

if chk_bool_tf "$DO_DB"; then
  sql_exec "UPDATE public.erp_backup_runs SET phase = 'database' WHERE id = '${RUN_UUID_ESC}';"
  OUT_DB="$RUN_DIR/database/backup-$STAMP.sql.gz"
  if "$SCRIPT_DIR/backup-db.sh" "$OUT_DB"; then
    HAS_OK=1
    ART_DB_ESC="$(sanitize_sql_lit "$OUT_DB")"
    if command -v sha256sum >/dev/null 2>&1; then
      CHECKSUM_ESC="$(sanitize_sql_lit "$(sha256sum "$OUT_DB" | awk '{print $1}')")"
    fi
  else
    HAS_BAD=1
    ERR_TAIL+="database; "
  fi
fi

if chk_bool_tf "$DO_ST"; then
  sql_exec "UPDATE public.erp_backup_runs SET phase = 'storage' WHERE id = '${RUN_UUID_ESC}';"
  OUT_ST="$RUN_DIR/storage/storage-$STAMP.tar.gz"
  if "$SCRIPT_DIR/backup-storage.sh" "$OUT_ST"; then
    HAS_OK=1
    ART_ST_ESC="$(sanitize_sql_lit "$OUT_ST")"
  else
    HAS_BAD=1
    ERR_TAIL+="storage; "
  fi
fi

if chk_bool_tf "$DO_CF"; then
  sql_exec "UPDATE public.erp_backup_runs SET phase = 'configs' WHERE id = '${RUN_UUID_ESC}';"
  OUT_CF="$RUN_DIR/configs/configs-$STAMP.tar.gz"
  if "$SCRIPT_DIR/backup-configs.sh" "$OUT_CF"; then
    HAS_OK=1
    ART_CF_ESC="$(sanitize_sql_lit "$OUT_CF")"
  else
    HAS_BAD=1
    ERR_TAIL+="configs; "
  fi
fi

if chk_bool_tf "$GO_DRIVE"; then
  sql_exec "UPDATE public.erp_backup_runs SET phase = 'upload_drive' WHERE id = '${RUN_UUID_ESC}';"
  if command -v rclone >/dev/null 2>&1; then
    if "$SCRIPT_DIR/upload-drive.sh" "$RUN_DIR"; then
      :
    else
      HAS_BAD=1
      ERR_TAIL+="drive_upload; "
    fi
  else
    HAS_BAD=1
    ERR_TAIL+="rclone_ausente; "
  fi
fi

SUMMARY="Directorio corrida=$RUN_DIR"
FINAL_STATUS="failed"
if [[ -n "${HAS_BAD:-}" ]] && [[ -n "${HAS_OK:-}" ]]; then
  FINAL_STATUS="partial"
elif [[ -z "${HAS_BAD:-}" ]] && [[ -n "${HAS_OK:-}" ]]; then
  FINAL_STATUS="success"
else
  FINAL_STATUS="failed"
  SUMMARY="Sem artefactos válidos gerados."
fi

finalize_run "$FINAL_STATUS" "$SUMMARY" "$ERR_TAIL"

RETENTION="${RETENTION_DAYS:-30}"
if [[ "${RETENTION}" =~ ^[0-9]+$ ]] && [[ "$RETENTION" -gt 0 ]]; then
  RETENTION_DAYS="$RETENTION" BACKUP_LOCAL_ROOT="$ROOT" "$SCRIPT_DIR/cleanup-old-backups.sh" \
    >>"$BACKUP_MASTER_LOG" 2>&1 || log "Limpeza: aviso (não fatal)."
fi

log "===== Corrida $FINAL_STATUS id=$RUN_ID"
[[ "$FINAL_STATUS" != "failed" ]]
