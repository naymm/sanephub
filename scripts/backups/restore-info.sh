#!/usr/bin/env bash
#
# Este script apenas mostra comandos modelo para restauração MANUAL supervisada.
# Não executa alterações nos volumes sem confirmacão humano no servidor.

set -euo pipefail

cat <<'MD'
══════════════════════════════════════════════════════════════
 RESTAURAÇÃO SUPABASE / PostgreSQL — APENAS PROCEDIMENTO MANUAL
══════════════════════════════════════════════════════════════

1) PostgreSQL (.sql.gz)
   gunzip -c backup-xxxx.sql.gz | psql "$DATABASE_URL_SUPERUSER"

2) Storage
   Extrair tarball para o caminho configurado SUPABASE_STORAGE_DATA_DIR
   e garantir permissões uid/gid do container storage.

3) Configs
   Revisar ficheiros do configs-YYYY-MM-DD.tar.gz antes de sobrescrever produção.

4) Testar sempre num ambiente de staging antes da produção.

Documentação complementar: docs/BACKUPS_RESTORE.md
══════════════════════════════════════════════════════════════
MD
