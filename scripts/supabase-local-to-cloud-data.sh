#!/usr/bin/env bash
# Exportar dados do Postgres local (Supabase CLI) e importar na nuvem via psql.
#
# Se tens um backup cluster (pg_dumpall) tipo backup_full.sql, usa em vez disso:
#   scripts/supabase-import-from-cluster-backup.sh
#
# Pré-requisitos:
#   - Docker: `supabase start` na raiz do repo (porta DB local 54322 por defeito).
#   - Na nuvem: migrações já aplicadas (`supabase db push`) e base compatível com o esquema.
#   - psql instalado (Postgres client).
#
# Auth + perfis:
#   - `public.profiles` tem FK a `auth.users`. Para cópia completa de utilizadores use o modo
#     `auth-public`. Se só exportares `public`, na nuvem tens de ter os mesmos UUID em
#     auth.users (ou apagar/recriar perfis alinhados ao Auth da nuvem).
#
# Storage:
#   - Este script não copia ficheiros dos buckets. Após o SQL, sincronize buckets à parte
#     (Dashboard → Storage, ou AWS S3 / CLI), ou re-carregue anexos manualmente.
#
# Uso:
#   ./scripts/supabase-local-to-cloud-data.sh dump-public
#   ./scripts/supabase-local-to-cloud-data.sh dump-auth-public
#   SUPABASE_DB_URL='postgresql://postgres.[REF]:[PASS]@...pooler.supabase.com:6543/postgres?sslmode=require' \
#     ./scripts/supabase-local-to-cloud-data.sh restore backups/local-public-....sql
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${ROOT}/backups"
mkdir -p "$BACKUP_DIR"

ts() { date +%Y%m%d-%H%M%S; }

cmd_dump_public() {
  local f="${BACKUP_DIR}/local-public-$(ts).sql"
  echo "→ A exportar só schema public para ${f}"
  supabase db dump --local --data-only --schema public -f "$f" --yes
  echo "Ficheiro: ${f}"
  echo "Seguinte: definir SUPABASE_DB_URL (URI Postgres da nuvem) e correr restore."
}

cmd_dump_auth_public() {
  local f="${BACKUP_DIR}/local-auth-public-$(ts).sql"
  echo "→ A exportar auth + public para ${f}"
  echo "  (contém dados de autenticação — não partilhes nem commits este ficheiro)"
  supabase db dump --local --data-only --schema auth --schema public -f "$f" --yes
  echo "Ficheiro: ${f}"
}

cmd_restore() {
  local sqlfile="${1:-}"
  if [[ -z "$sqlfile" || ! -f "$sqlfile" ]]; then
    echo "Uso: $0 restore <caminho-para.sql>" >&2
    exit 1
  fi
  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    echo "Defina SUPABASE_DB_URL com a connection string Postgres da nuvem (Settings → Database)." >&2
    echo "Ex.: postgresql://postgres.[project-ref]:[password]@aws-0-....pooler.supabase.com:6543/postgres?sslmode=require" >&2
    exit 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "Comando psql não encontrado. Instale o cliente PostgreSQL." >&2
    exit 1
  fi
  echo "→ A importar ${sqlfile} na base remota (ON_ERROR_STOP)."
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$sqlfile"
  echo "Concluído."
}

case "${1:-}" in
  dump-public)       cmd_dump_public ;;
  dump-auth-public)  cmd_dump_auth_public ;;
  restore)           cmd_restore "${2:-}" ;;
  *)
    echo "Comandos: dump-public | dump-auth-public | restore <ficheiro.sql>" >&2
    exit 1
    ;;
esac
