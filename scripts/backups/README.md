# Backups automatizados (Self-Hosted)

Este módulo corre **no servidor onde o Docker/Supabase está instalado**. O painel ERP apenas fila pedidos (`queued`) e mostra estado — **credenciais nunca ficam na base nem no frontend**.

## Requisitos

- `bash`, `psql`, `pg_dump`, `gzip`, `tar`, `du`, opcionalmente `docker` apenas se integrar outros passos externos.
- `rclone` (opcional, para upload remoto já configurado: `rclone config`).

## Instalação rápida

```bash
cd scripts/backups
cp .env.example .env.backup
chmod +x *.sh backup-*.sh 2>/dev/null || chmod +x backup.sh backup-*.sh process-backup-queue.sh upload-drive.sh cleanup-old-backups.sh restore-info.sh backup-db.sh backup-storage.sh backup-configs.sh
# editar .env.backup com caminhos reais da sua VPS
```

Aplicar a migração Supabase correspondente ao módulo `erp_backup_*` (ver `supabase/migrations/`).

## Agendamentos cron sugeridos

```cron
# Backup completo todas as madrugadas (02h)
0 2 * * * /caminho/para/sanephub/scripts/backups/backup.sh --cron >>/var/log/erp-backup-cron.log 2>&1

# Processar fila de pedidos manuais a cada minuto
* * * * * /caminho/para/sanephub/scripts/backups/process-backup-queue.sh >>/var/log/erp-backup-queue.log 2>&1
```

## Fluxo manual (ERP «Executar Backup Agora»)

1. O administrador prime o botão no ERP → INSERT `erp_backup_runs(status=queued)`.
2. Em até 60s o cron do `process-backup-queue.sh` bloqueia a linha (`running`) e lança `backup.sh --from-queue-id <uuid>`.
3. O estado volta a aparecer no painel quando o script finaliza.

**Se o painel ficar eternamente em «Pendente na fila»:** o processador não está a correr. O browser **não** executa backups — tem de haver `process-backup-queue.sh` no servidor (cron ou uma execução manual em SSH).

### Alternativa: mesmo clique no ERP dispara o script (opcional)

Se o processo Node **`npm run sse:gateway`** correr no **mesmo servidor** que os scripts de backup (com `scripts/backups/.env.backup` correcto):

1. No build do frontend: `VITE_SSE_URL` (URL do gateway) e `VITE_BACKUP_TRIGGER_VIA_GATEWAY=true`.
2. Com `SSE_GATEWAY_SECRET`, defina também `VITE_SSE_TOKEN` (o POST envia `X-SSE-Token`).
3. O endpoint `POST /backups/process-queue` valida o JWT do utilizador e exige perfil **Admin**, depois executa `process-backup-queue.sh`.

Variável opcional no host do gateway: `BACKUP_SCRIPTS_DIR` (caminho absoluto para a pasta `scripts/backups` se não for a relativa ao repositório).

Se não configurar cron da fila, use manualmente na shell:

```bash
./process-backup-queue.sh
```

## Restore

Consulte **`docs/BACKUPS_RESTORE.md`**. Execute sempre em ambiente de teste primeiro.
