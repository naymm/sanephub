# Gateway SSE (todos os módulos)

O frontend (`useRealtimeTable` em `DataContext` + `NotificationContext`) abre um `EventSource` por tabela quando defines:

```env
VITE_SSE_URL=http://localhost:4000
```

Opcional (se usares `SSE_GATEWAY_SECRET` no gateway):

```env
VITE_SSE_TOKEN=o_mesmo_segredo
```

## Arranque

1. Aplica as migrations Supabase (as tabelas têm de estar na publicação `supabase_realtime`).
2. No `.env` do projecto: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (o gateway usa a **service role** para receber todos os `postgres_changes`).
3. Terminal 1: `npm run dev`
4. Terminal 2: `npm run sse:gateway`

Variáveis do gateway (opcionais):

| Variável | Default | Descrição |
|----------|---------|-----------|
| `SSE_GATEWAY_PORT` | `4000` | Porta HTTP |
| `SSE_CORS_ORIGIN` | `*` | CORS para o browser |
| `SSE_GATEWAY_SECRET` | — | Se definido, o cliente tem de passar `?token=` (via `VITE_SSE_TOKEN`) |

## Arquitectura

- Um único canal Supabase Realtime no servidor escuta `postgres_changes` em **todas** as tabelas listadas em `server/realtime-tables.ts` (alinhar com `NUMERIC_KEYS` no frontend).
- Cada browser mantém N ligações SSE (`/realtime?table=...`); o servidor só envia eventos da tabela pedida.

Em produção: colocar o gateway atrás de HTTPS, limitar origens CORS e usar segredo ou rede privada.
