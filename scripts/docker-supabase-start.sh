#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "Instale o Supabase CLI: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "A iniciar stack Supabase (Docker)..."
supabase start
echo ""
echo "API (Kong) costuma ficar em http://127.0.0.1:54321"
echo "Para a app noutro contentor ou noutra máquina, use o IP do host e a mesma porta (firewall)."
