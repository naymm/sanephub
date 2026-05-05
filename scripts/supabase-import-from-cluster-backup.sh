#!/usr/bin/env bash
# Pipeline recomendado: backup cluster local (pg_dumpall) + tar de Storage → nuvem.
#
# 1) Gera SQL só com dados COPY de `public` + `auth` (sem aplicar roles nem schemas internos).
# 2) (Opcional) Envia ficheiros do tar para os buckets do projecto ligado.
#
# Variáveis:
#   BACKUP_SQL      caminho para backup_full.sql (obrigatório para extract)
#   STORAGE_TAR     caminho para storage_backup.tar.gz (opcional, passo storage)
#   SUPABASE_DB_URL connection string Postgres da nuvem (obrigatório para import)
#
# Exemplo:
#   export BACKUP_SQL="$HOME/Documents/DEV/SUPABASE/backup_full.sql"
#   export STORAGE_TAR="$HOME/Documents/DEV/SUPABASE/storage_backup.tar.gz"
#   export SUPABASE_DB_URL='postgresql://postgres.[REF]:[PASS]@....pooler.supabase.com:6543/postgres?sslmode=require'
#   ./scripts/supabase-import-from-cluster-backup.sh all
#
# Passos separados:
#   ./scripts/supabase-import-from-cluster-backup.sh extract
#   ./scripts/supabase-import-from-cluster-backup.sh import
#   ./scripts/supabase-import-from-cluster-backup.sh storage
#
# Notas:
#   - Na nuvem as migrações devem estar aplicadas. Preferível projecto sem dados de teste
#     que conflitem (ex.: mesmas PK). Se falhar por duplicados, limpa dados na nuvem ou
#     ajusta o SQL gerado.
#   - Não uses --with-storage no extract se fores usar o passo `storage` (recomendado):
#     o `supabase storage cp` cria os registos em storage.objects.
#   - --skip-auth-audit no extract reduz tamanho e exposição de logs de auth.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p "${ROOT}/backups"

# Carrega .env do repo (ex.: SUPABASE_DB_URL) sem sobrescrever variáveis já exportadas.
if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=1091
  source "${ROOT}/.env"
  set +a
fi

EXTRACT_FLAGS=(--skip-auth-audit)
OUT="" # preenchido por extract (usado por «all»)

cmd_extract() {
  if [[ -z "${BACKUP_SQL:-}" || ! -f "${BACKUP_SQL}" ]]; then
    echo "Defina BACKUP_SQL=/caminho/backup_full.sql" >&2
    exit 1
  fi
  OUT="${ROOT}/backups/cloud-import-$(date +%Y%m%d-%H%M%S).sql"
  echo "→ A gerar ${OUT} (pode demorar alguns minutos)…"
  python3 "${ROOT}/scripts/extract_pg_cluster_dump_for_cloud.py" "${EXTRACT_FLAGS[@]}" "${BACKUP_SQL}" >"${OUT}"
  echo "SQL gerado: ${OUT}"
  echo "Seguinte: ${0} import \"${OUT}\" (com SUPABASE_DB_URL definido)."
}

cmd_import() {
  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    echo "Defina SUPABASE_DB_URL (URI Postgres da nuvem)." >&2
    exit 1
  fi
  if [[ "${SUPABASE_DB_URL}" == http://* || "${SUPABASE_DB_URL}" == https://* ]]; then
    echo "SUPABASE_DB_URL não pode ser a URL HTTPS da API (VITE_SUPABASE_URL)." >&2
    echo "Use a Connection string Postgres: postgresql://postgres.[REF]:[PASSWORD]@....pooler.supabase.com:6543/postgres?sslmode=require" >&2
    echo "(Dashboard → Settings → Database → Connection string → URI)" >&2
    exit 1
  fi
  local f=""
  if [[ -n "${1:-}" ]]; then
    f="$1"
  elif [[ -n "${CLOUD_IMPORT_SQL:-}" ]]; then
    f="$CLOUD_IMPORT_SQL"
  else
    echo "Passe o .sql: $0 import /caminho/cloud-import-....sql" >&2
    echo "Ou defina CLOUD_IMPORT_SQL=..." >&2
    exit 1
  fi
  echo "→ A importar ${f} …"
  export PGSSLMODE="${PGSSLMODE:-require}"
  if command -v psql >/dev/null 2>&1; then
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
  elif command -v docker >/dev/null 2>&1; then
    echo "  (psql não encontrado — a usar Docker postgres:17 com --network host para IPv6.)" >&2
    abs="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
    docker run --rm -i --network host \
      -e SUPABASE_DB_URL \
      -e PGSSLMODE \
      -v "${abs}:/dump.sql:ro" \
      postgres:17 \
      sh -c 'psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f /dump.sql'
  else
    echo "Instale psql (brew install libpq) ou Docker." >&2
    exit 1
  fi
  echo "Import SQL concluído."
}

cmd_storage() {
  if [[ -z "${STORAGE_TAR:-}" || ! -f "${STORAGE_TAR}" ]]; then
    echo "Defina STORAGE_TAR=/caminho/storage_backup.tar.gz" >&2
    exit 1
  fi
  bash "${ROOT}/scripts/supabase-restore-storage-from-tar.sh" "${STORAGE_TAR}"
}

case "${1:-}" in
  extract) cmd_extract ;;
  import) cmd_import "${2:-}" ;;
  storage) cmd_storage ;;
  all)
    cmd_extract
    cmd_import "${OUT}"
    if [[ -n "${STORAGE_TAR:-}" && -f "${STORAGE_TAR}" ]]; then
      cmd_storage
    else
      echo "(Opcional) STORAGE_TAR não definido — a saltar upload de Storage."
    fi
    ;;
  *)
    echo "Uso: BACKUP_SQL=... [STORAGE_TAR=...] SUPABASE_DB_URL=... $0 extract|import|storage|all" >&2
    exit 1
    ;;
esac
