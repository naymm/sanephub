/**
 * Gateway SSE para todos os módulos: subscreve `postgres_changes` no Supabase (service role)
 * e reenvia eventos para os `EventSource` do browser (`useRealtimeTable`).
 *
 * Arranque: `npm run sse:gateway` (com `.env` com URL Supabase + SUPABASE_SERVICE_ROLE_KEY)
 * Frontend: `VITE_SSE_URL=http://localhost:<porta>` (ex.: 4000)
 *
 * Segurança: em produção, proteger com `SSE_GATEWAY_SECRET` e reverse proxy; não expor sem TLS.
 */
import 'dotenv/config';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { REALTIME_TABLES, isRealtimeTable } from './realtime-tables';

const PORT = Number(process.env.SSE_GATEWAY_PORT ?? 4000);
const CORS_ORIGIN = process.env.SSE_CORS_ORIGIN ?? '*';
const GATEWAY_SECRET = process.env.SSE_GATEWAY_SECRET?.trim();

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceKey) {
  console.error(
    '[sse-gateway] Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env',
  );
  process.exit(1);
}

/** Respostas SSE activas por tabela */
const clientsByTable = new Map<string, Set<http.ServerResponse>>();

function broadcast(table: string, body: { eventType: string; new?: unknown; old?: unknown }) {
  const set = clientsByTable.get(table);
  if (!set?.size) return;
  const line = `data: ${JSON.stringify({
    eventType: body.eventType,
    new: body.new ?? null,
    old: body.old ?? null,
  })}\n\n`;
  for (const res of set) {
    try {
      res.write(line);
    } catch {
      set.delete(res);
    }
  }
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const channelName = 'sse-gateway-all-tables';
const channel = supabase.channel(channelName);

for (const table of REALTIME_TABLES) {
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table },
    (payload: {
      eventType: string;
      new?: Record<string, unknown> | null;
      old?: Record<string, unknown> | null;
    }) => {
      broadcast(table, {
        eventType: payload.eventType,
        new: payload.new ?? undefined,
        old: payload.old ?? undefined,
      });
    },
  );
}

channel.subscribe(status => {
  if (status === 'SUBSCRIBED') {
    console.log(`[sse-gateway] Supabase Realtime SUBSCRIBED (${REALTIME_TABLES.length} tabelas)`);
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.error('[sse-gateway] canal Realtime:', status);
  } else {
    console.log('[sse-gateway] canal Realtime status:', status);
  }
});

function parseTable(url: URL): string | null {
  const t = url.searchParams.get('table')?.trim();
  return t && isRealtimeTable(t) ? t : null;
}

function checkSecret(url: URL): boolean {
  if (!GATEWAY_SECRET) return true;
  const q = url.searchParams.get('token')?.trim();
  return q === GATEWAY_SECRET;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET' || url.pathname !== '/realtime') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  if (!checkSecret(url)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const table = parseTable(url);
  if (!table) {
    res.writeHead(400, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': CORS_ORIGIN });
    res.end(
      `Query "table" inválida. Use uma de: ${REALTIME_TABLES.join(', ')}`,
    );
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'X-Accel-Buffering': 'no',
  });

  let set = clientsByTable.get(table);
  if (!set) {
    set = new Set();
    clientsByTable.set(table, set);
  }
  set.add(res);

  res.write(': connected\n\n');

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    set!.delete(res);
    if (set!.size === 0) clientsByTable.delete(table);
  });
});

server.listen(PORT, () => {
  console.log(`[sse-gateway] http://localhost:${PORT}/realtime?table=<tabela>`);
  if (GATEWAY_SECRET) console.log('[sse-gateway] Protegido com SSE_GATEWAY_SECRET (query token=)');
});
