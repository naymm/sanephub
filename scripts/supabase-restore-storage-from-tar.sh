#!/usr/bin/env bash
# Envia ficheiros de um backup local (tar com árvore stub/stub/<bucket>/...) para o
# projecto Supabase **ligado** (`supabase link`), via API de Storage.
#
# Estrutura esperada (igual ao teu storage_backup.tar.gz):
#   stub/stub/<bucket_id>/.../ficheiro
#
# Cada pasta directa sob stub/stub/ deve corresponder a um bucket id no projecto
# (ex.: noticias, eventos, gestao-documentos, … — ver migrações storage.buckets).
#
# Pré-requisitos:
#   - `supabase link` na raiz do repo
#   - `supabase storage cp` disponível (CLI recente)
#
# Uso:
#   ./scripts/supabase-restore-storage-from-tar.sh /caminho/storage_backup.tar.gz
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TAR="${1:-}"
if [[ -z "$TAR" || ! -f "$TAR" ]]; then
  echo "Uso: $0 /caminho/storage_backup.tar.gz" >&2
  exit 1
fi

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

echo "→ A extrair para ${WORK}"
tar -xzf "$TAR" -C "$WORK"

STUB_ROOT="${WORK}/stub/stub"
if [[ ! -d "$STUB_ROOT" ]]; then
  echo "Estrutura inesperada: não encontrei ${STUB_ROOT} dentro do tar." >&2
  exit 1
fi

echo "→ A enviar buckets (projecto ligado) a partir de: ${STUB_ROOT}"
for bucket_path in "$STUB_ROOT"/*; do
  [[ -d "$bucket_path" ]] || continue
  name="$(basename "$bucket_path")"
  echo "  bucket: ${name}"
  supabase storage cp -r -j 4 --yes "$bucket_path" "ss:///${name}/"
done

echo "Concluído."
