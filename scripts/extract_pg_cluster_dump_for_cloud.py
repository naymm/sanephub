#!/usr/bin/env python3
"""
Extrai de um pg_dumpall / backup cluster (formato COPY ... FROM stdin) os blocos
adequados a importar na Supabase alojada: schemas `public` e `auth`.

Exclui por defeito:
  - COPY auth.schema_migrations (histórico interno do Auth; não misturar com a nuvem)

Opcional:
  --with-storage     inclui COPY storage.buckets e storage.objects (omitir se usares
                     supabase storage cp a partir do tar — evita duplicar linhas em storage.objects).
  --skip-auth-audit  omite COPY auth.audit_log_entries (menor ficheiro, menos dados sensíveis).

Uso (streaming, memória baixa):
  python3 scripts/extract_pg_cluster_dump_for_cloud.py /caminho/backup_full.sql > backups/cloud-data.sql

Depois (nuvem com migrações já aplicadas; preferível base sem dados de teste):
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f backups/cloud-data.sql
"""
from __future__ import annotations

import re
import sys

COPY_PUBLIC = re.compile(r"^COPY public\.")
COPY_AUTH = re.compile(r"^COPY auth\.")
COPY_STORAGE_BUCKETS = re.compile(r"^COPY storage\.buckets ")
COPY_STORAGE_OBJECTS = re.compile(r"^COPY storage\.objects ")

def build_exclude(*, skip_auth_audit: bool) -> frozenset[str]:
    s = {"auth.schema_migrations"}
    if skip_auth_audit:
        s.add("auth.audit_log_entries")
    return frozenset(s)


def table_from_copy_line(line: str) -> str | None:
    """'COPY public.foo (...' -> 'public.foo'"""
    if not line.startswith("COPY "):
        return None
    rest = line[5:]
    paren = rest.find(" ")
    if paren == -1:
        return None
    return rest[:paren].strip()


def should_emit(
    line: str, *, with_storage: bool, exclude: frozenset[str]
) -> bool:
    t = table_from_copy_line(line)
    if t is None:
        return False
    if t in exclude:
        return False
    if COPY_PUBLIC.match(line) or COPY_AUTH.match(line):
        return True
    if with_storage and (COPY_STORAGE_BUCKETS.match(line) or COPY_STORAGE_OBJECTS.match(line)):
        return True
    return False


def main() -> int:
    argv = list(sys.argv[1:])
    with_storage = "--with-storage" in argv
    skip_auth_audit = "--skip-auth-audit" in argv
    argv = [a for a in argv if a not in ("--with-storage", "--skip-auth-audit")]
    exclude = build_exclude(skip_auth_audit=skip_auth_audit)
    if len(argv) != 1:
        print(
            "Uso: python3 extract_pg_cluster_dump_for_cloud.py [--with-storage] [--skip-auth-audit] backup_full.sql > saida.sql",
            file=sys.stderr,
        )
        return 2

    path = argv[0]
    sys.stdout.write(
        "-- Gerado por extract_pg_cluster_dump_for_cloud.py\n"
        "-- Importar só em projecto com o mesmo esquema (migrações aplicadas).\n"
        "BEGIN;\n"
        "SET session_replication_role = replica;\n"
    )

    in_block = False
    skip_until_dot = False

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if skip_until_dot:
                if line.rstrip("\r\n") == "\\.":
                    skip_until_dot = False
                continue

            if in_block:
                sys.stdout.write(line)
                if line.rstrip("\r\n") == "\\.":
                    in_block = False
                continue

            if line.startswith("COPY "):
                if not should_emit(line, with_storage=with_storage, exclude=exclude):
                    skip_until_dot = True
                    continue
                in_block = True
                sys.stdout.write(line)

    sys.stdout.write(
        "SET session_replication_role = DEFAULT;\n"
        "COMMIT;\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
