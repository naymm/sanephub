# Procedimento de restauração — SANEP ERP (Supabase Self-Hosted)

> **Os scripts de backup não fazem restore automático.** Siga sempre estes passos sob supervisão e com downtime planeado.

## 1. Base de dados PostgreSQL

1. Pare escritas na aplicação ou coloque modo manutenção.
2. Liste e descarregue o ficheiro `backup-YYYY-MM-DD-HH-MM.sql.gz`.
3. Decompressão directa para `psql`:

```bash
gunzip -c backup-YYYYMMDD-HHmm.sql.gz | psql "$SUPERUSER_DATABASE_URL"
```

4. Reinicie APIs / edge / workers ligados ao PostgREST.
5. Valide migrações e versões de schema esperadas.

## 2. Storage (object buckets)

O tar `storage-*.tar.gz` espelha a pasta de dados configurada como `SUPABASE_STORAGE_DATA_PATH` no servidor.

```bash
tar -tzf storage-YYYYMMDD-HHmm.tar.gz | head # inspeccionar primeiro
sudo systemctl stop supabase-storage.service # exemplo
sudo rm -rf /var/lib/docker/volumes/STACK_storage/_data/*
sudo tar -xzf storage-YYYYMMDD-HHmm.tar.gz -C /var/lib/docker/volumes/STACK_storage/_data
sudo systemctl start supabase-storage.service
```

Ajuste caminhos e serviços ao seu `docker-compose` real.

## 3. Configurações (`configs-*.tar.gz`)

Reverta apenas ficheiros após comparar checksums/manifesto dentro do arquivo. **Nunca** sobreponha `.env` de produção sem rever segredos e chaves JWT.

## 4. Rollback rápido

Mantenha um snapshot VM/LXD ou disco antes de grandes restores experimentais.

## 5. Testes obrigatórios

Após cada restore funcional execute:

1. Login de um Admin.
2. Leitura/escrita mínima (ex.: listar um módulo, ver dashboard).
3. Upload/download de Storage de teste (bucket privado/público).
