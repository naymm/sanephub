/**
 * Gateway SSE para todos os módulos: subscreve `postgres_changes` no Supabase (service role)
 * e reenvia eventos para os `EventSource` do browser (`useRealtimeTable`).
 *
 * Arranque: `npm run sse:gateway` (com `.env` com URL Supabase + SUPABASE_SERVICE_ROLE_KEY)
 * Frontend: `VITE_SSE_URL=http://localhost:<porta>` (ex.: 4000)
 *
 * Opcional — processar fila de backups manual (mesmo host que `scripts/backups/`):
 *   POST /backups/process-queue
 *   Headers: Authorization: Bearer <access_token do utilizador Admin>
 *           X-SSE-Token: <opcional, se SSE_GATEWAY_SECRET estiver definido>
 *
 * Segurança: em produção, proteger com `SSE_GATEWAY_SECRET` e reverse proxy; não expor sem TLS.
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { REALTIME_TABLES, isRealtimeTable } from './realtime-tables';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function checkSseToken(req: http.IncomingMessage, url: URL): boolean {
  if (!GATEWAY_SECRET) return true;
  const raw = req.headers['x-sse-token'];
  const headerToken = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const q = url.searchParams.get('token')?.trim();
  return headerToken === GATEWAY_SECRET || q === GATEWAY_SECRET;
}

function corsHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cache-Control, X-SSE-Token',
    ...extra,
  };
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
  withCors = true,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (withCors) Object.assign(headers, corsHeaders());
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function backupScriptsDir(): string {
  const fromEnv = process.env.BACKUP_SCRIPTS_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(__dirname, '..', 'scripts', 'backups');
}

function runProcessBackupQueue(): Promise<{ code: number; stdout: string; stderr: string }> {
  const scriptsDir = backupScriptsDir();
  const scriptPath = path.join(scriptsDir, 'process-backup-queue.sh');
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath], {
      cwd: scriptsDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const cap = 120_000;
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
      if (stdout.length > cap) stdout = stdout.slice(-cap / 2);
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
      if (stderr.length > cap) stderr = stderr.slice(-cap / 2);
    });
    child.on('error', err => reject(err));
    child.on('close', code => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function handleBackupProcessQueue(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  if (!checkSseToken(req, url)) {
    sendJson(res, 403, { error: 'Token do gateway inválido (X-SSE-Token ou token=).' });
    return;
  }

  const auth = req.headers.authorization?.trim();
  const jwt = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!jwt) {
    sendJson(res, 401, { error: 'Cabeçalho Authorization: Bearer <access_token> obrigatório.' });
    return;
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user?.id) {
    sendJson(res, 401, { error: 'Sessão inválida ou expirada.' });
    return;
  }

  const uid = userData.user.id;
  const { data: profile, error: pe } = await supabase
    .from('profiles')
    .select('perfil')
    .eq('auth_user_id', uid)
    .maybeSingle();

  if (pe || profile?.perfil !== 'Admin') {
    sendJson(res, 403, { error: 'Apenas administradores podem executar o processador de backups.' });
    return;
  }

  try {
    const { code, stdout, stderr } = await runProcessBackupQueue();
    const tail = (s: string) => (s.length > 8000 ? s.slice(-8000) : s);
    sendJson(res, code === 0 ? 200 : 500, {
      ok: code === 0,
      exitCode: code,
      stdout: tail(stdout),
      stderr: tail(stderr),
    });
  } catch (e) {
    console.error('[sse-gateway] process-backup-queue:', e);
    sendJson(res, 500, {
      error: e instanceof Error ? e.message : 'Falha ao executar process-backup-queue.sh',
    });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/backups/process-queue') {
    void handleBackupProcessQueue(req, res, url);
    return;
  }

  if (req.method !== 'GET' || url.pathname !== '/realtime') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  if (!checkSseToken(req, url)) {
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
  console.log(`[sse-gateway] POST http://localhost:${PORT}/backups/process-queue (JWT Admin + scripts em ${backupScriptsDir()})`);
  if (GATEWAY_SECRET) console.log('[sse-gateway] Protegido com SSE_GATEWAY_SECRET (query token= ou header X-SSE-Token)');
});
