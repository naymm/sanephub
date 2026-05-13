/**
 * Worker genérico: consome fila Redis (`sanephub:queue:jobs`) criada por `enqueueJob`.
 * Escalar horizontalmente: vários workers competem por BRPOP (cada job a um worker).
 *
 * Arranque: `npm run worker` (requer `REDIS_URL`).
 */
import 'dotenv/config';
import { blockingPopJob, getOptionalRedis, touchPresence } from './enterprise/index';

const redis = getOptionalRedis();
if (!redis) {
  console.error('[worker] Defina REDIS_URL no .env para arrancar o worker.');
  process.exit(1);
}

async function processJob(job: Awaited<ReturnType<typeof blockingPopJob>>): Promise<void> {
  if (!job) return;
  console.log(`[worker] job type=${job.type}`, job.payload);
  switch (job.type) {
    case 'ping':
      break;
    case 'presence:touch': {
      const uid = job.payload.userId;
      if (typeof uid === 'string') {
        await touchPresence(redis, uid, 120);
      }
      break;
    }
    default:
      console.warn('[worker] tipo desconhecido (no-op):', job.type);
  }
}

async function main(): Promise<void> {
  console.log('[worker] à escuta da fila (BRPOP 30s)…');
  for (;;) {
    try {
      const job = await blockingPopJob(redis, 30);
      await processJob(job);
    } catch (e) {
      console.error('[worker]', e instanceof Error ? e.message : e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

void main();
