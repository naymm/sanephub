# Arquitectura enterprise — Redis, cache, escalabilidade e observabilidade

Este documento descreve a **base implementada no repositório** e o **caminho recomendado** para evoluir o ERP (Vite + React + Supabase) para uma plataforma **cache-first**, **distribuída** e **observável**, sem ignorar as limitações do modelo Supabase managed.

## Visão geral do stack actual

| Camada | Tecnologia | Notas |
|--------|------------|--------|
| Frontend | Vite, React, TanStack Query | Cache de dados no cliente (`src/lib/query-client.ts`). |
| API / Auth / DB | Supabase (PostgREST, Auth, Realtime, Storage) | Sessões JWT geridas pelo Supabase; Postgres é a fonte de verdade. |
| Gateway opcional | `server/sse-gateway.ts` (Node) | SSE alternativo/complementar ao Realtime; pode usar Redis. |
| Workers | `server/worker.ts` | Consome fila Redis (`BRPOP`). |
| Edge | `supabase/functions/*` | Deno; para Redis serverless preferir **Upstash** (REST) em vez de TCP persistente. |

**Importante:** o browser **não** fala directamente com Redis. Redis entra em **serviços Node**, **workers**, **API própria** ou **Edge + Upstash**.

## Fase 1 — Redis e cache-aside (implementado)

### Variáveis de ambiente

- `REDIS_URL` — URL `redis://…` (ex.: `redis://localhost:6379` ou `redis://redis:6379` no Docker Compose enterprise).
- `SSE_RATE_LIMIT_PER_MIN` — opcional; limite de **novas** ligações SSE por IP e minuto (default alinhado com `RateLimitPresets.sseConnect`).

### Módulo `server/enterprise/`

- `redis.ts` — cliente partilhado opcional (`ioredis`).
- `ttl.ts` — TTLs por domínio (dashboard 5 min, métricas 2 min, utilizadores 30 min, config 24 h, etc.).
- `cache-keys.ts` — convenções de chave (`sanephub:…`) para evitar colisões.
- `cache-aside.ts` — `getOrSetJson`, `invalidateKeys`, `invalidatePrefix` (SCAN + DEL).
- `rate-limit.ts` — janela fixa distribuída (`INCR` + `EXPIRE`); presets para login, API, chat, upload, SSE.
- `presence.ts` — chaves `SETEX` para “online” (TTL curto; renovar por heartbeat).
- `queue.ts` — `enqueueJob` / `blockingPopJob` na lista `sanephub:queue:jobs`.
- `invalidation.ts` — exemplos `afterEmployeeMutation`, `afterDepartmentMutation`, `afterConfigMutation` para chamar **depois** de mutações na camada Node (não ligado automaticamente ao Postgres).

### Fluxo cache-aside

1. Calcular chave (`cacheKeys.*`).
2. `getOrSetJson(redis, key, ttl, loader)`.
3. Em mutação: `invalidateKeys` / `invalidatePrefix` ou helpers em `invalidation.ts`.

### Invalidação automática a partir do Postgres

O Supabase **não** invalida Redis quando o cliente grava directamente no Postgres. Opções enterprise:

1. **Triggers + `pg_net` / HTTP** — após `INSERT/UPDATE/DELETE`, chamar um serviço que executa `invalidatePrefix` (recomendado com API interna protegida).
2. **Edge Function como fachada** — toda mutação passa pela função, que escreve no DB e invalida Redis (Upstash REST).
3. **Outbox pattern** — tabela `outbox` + worker que lê eventos e invalida / publica.

O código de invalidação no Node está pronto para ser chamado a partir desses fluxos.

## Fase 2 — Rate limiting (parcialmente implementado)

- **SSE gateway:** `consumeRateLimit` por IP antes de abrir o stream (`server/sse-gateway.ts`).
- **Login / API / chat / uploads:** presets definidos em `RateLimitPresets`; integrar nas rotas quando existir **API Node** ou **Kong / NGINX** (`limit_req`) na borda.

**Login:** o lockout por tentativas pode continuar no Postgres (já comum em Supabase); Redis acrescenta **limite distribuído** entre instâncias.

## Fase 3 — Realtime e presença

- **Supabase Realtime** escala com o plano Supabase e configuração de publicações/replica.
- **Presença:** usar `touchPresence` + TTL; vários gateways podem escrever a mesma chave Redis.
- **Fan-out multi-instância do SSE:** se várias réplicas do `sse-gateway` subscreverem o mesmo canal Supabase, **todas** recebem os mesmos eventos (aceitável se cada instância só servir clientes próprios). Para **uma única** subscrição Postgres e fan-out Redis, é necessário padrão **leader election** (ex.: chave Redis `SETNX`) — não incluído por defeito; documentar como evolução.

## Fase 4 — NGINX enterprise

Ficheiro de referência: `docker/nginx.enterprise.conf` — gzip, HTTP/2, cabeçalhos de segurança, proxy para `web` e `/realtime` para o gateway Node, timeouts longos para SSE.

- **Brotli:** não incluído na imagem stock; usar CDN ou imagem nginx com `ngx_brotli`.
- **Rate limit na borda:** `limit_req_zone` / `limit_req` (exemplo comentado no ficheiro).

## Fase 5 — Docker e escalabilidade horizontal

- `docker-compose.yml` — serviço `web` (build estático + nginx interno).
- `docker-compose.enterprise.yml` — **Redis** (AOF, LRU) + **worker** (`npm run worker` via `tsx`).

```bash
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml up -d
```

Para **várias réplicas** de `web`, usar um NGINX à frente (`docker/nginx.enterprise.conf`) com `upstream` e `least_conn` ou IP hash.

**Rolling deploy / zero downtime:** healthchecks, pelo menos 2 réplicas, drenar ligações SSE antes de terminar pods (preStop hook + grace period).

## Fase 6 — Observabilidade

Stack opcional: `infra/observability/docker-compose.yml` (Prometheus + Grafana).

```bash
cd infra/observability && docker compose up -d
```

- **Sentry:** integrar no frontend (`@sentry/react`) e opcionalmente no Node; seguir documentação oficial.
- **Loki:** adicionar como segundo passo (config `loki-config.yaml` + Promtail ou agente único).
- **Métricas do gateway:** expor `/metrics` com `prom-client` no `sse-gateway` e apontar o scrape no `prometheus.yml` (bloco comentado).

## Fase 7 — Segurança

- Cabeçalhos no NGINX (`X-Frame-Options`, `CSP`, etc.); afinar `connect-src` para o URL do Supabase e do SSE.
- **CSRF:** relevante para cookies de sessão; com JWT em `Authorization` o risco é diferente — avaliar formulários legacy.
- **SQL injection:** continuar a usar PostgREST + RLS; nunca concatenar SQL no cliente.
- **Audit logs:** já alinhado com migrações de auditoria no Postgres.

## Fase 8 — Performance frontend

- `createAppQueryClient()` — `staleTime` / `gcTime` por omissão; por ecrã usar `useQuery({ staleTime: CacheTTL.dashboard * 1000 })` importando constantes espelhadas ou duplicando valores alinhados com `server/enterprise/ttl.ts`.
- **Code splitting:** já há `lazy()` em partes do `App.tsx`; estender a rotas pesadas.
- **Listas:** virtualizar tabelas muito grandes (`@tanstack/react-virtual`).

## Fase 9 — Base de dados

- Índices e RLS no Supabase continuam a ser a principal alavanca.
- **Read replicas:** suportadas no Supabase em planos superiores; read-only no cliente via connection string separada se exposto.
- **Materialized views** + `REFRESH` agendado (pg_cron ou worker) para relatórios pesados.

## Scripts npm úteis

| Script | Descrição |
|--------|-----------|
| `npm run sse:gateway` | Gateway SSE (opcional `REDIS_URL`). |
| `npm run worker` | Worker de fila Redis. |
| `npm run compose:enterprise` | Prefixo para `docker compose …` com ficheiro enterprise. |

## Deploy resumido

1. Build da imagem `web` com `VITE_*` correctos.
2. Subir Redis + workers (`docker-compose.enterprise.yml`).
3. Colocar NGINX enterprise à frente (TLS terminado no load balancer ou no NGINX).
4. Definir `REDIS_URL` no ambiente do gateway e dos workers.
5. Aplicar políticas de invalidação (triggers ou API) antes de depender de cache para dados críticos.

## Escalabilidade e fiabilidade

- **Estado:** Redis para cache, rate limit, filas e presença; Postgres para dados duráveis.
- **Filas:** `BRPOP` é suficiente para cargas médias; para retries e prioridades migrar para **BullMQ** ou **Temporal**.
- **Alta disponibilidade:** Redis Sentinel ou Redis Cluster; Postgres gerido pelo Supabase com backups.

---

Este ficheiro reflecte a **primeira entrega de código** no repositório; as fases 2–9 incluem itens a integrar incrementalmente nos módulos de negócio (RH, financeiro, chat, etc.) à medida que forem expostos através de serviços que possam chamar `server/enterprise`.
