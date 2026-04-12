/**
 * Fuso oficial para marcação de ponto: WAT (UTC+1), sem horário de verão.
 * Alinhado a Angola (`Africa/Luanda`).
 */
export const PONTO_FUSO_IANA = 'Africa/Luanda';

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPart['type'],
  fallback: string,
): string {
  return parts.find(p => p.type === type)?.value ?? fallback;
}

/** Data civil (yyyy-MM-dd) no relógio da zona do ponto. */
export function dataCalendarioPonto(de: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: PONTO_FUSO_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(de);
  return `${part(p, 'year', '1970')}-${part(p, 'month', '01')}-${part(p, 'day', '01')}`;
}

/**
 * Início do dia civil na zona do ponto (00:00 WAT) e fim exclusivo (00:00 do dia seguinte),
 * em ISO UTC — para filtros `data_hora` em Supabase.
 */
export function diaCivilPontoBounds(): { startIso: string; endIso: string; dateKey: string } {
  const dateKey = dataCalendarioPonto();
  const startMs = Date.parse(`${dateKey}T00:00:00+01:00`);
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return {
    dateKey,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

/**
 * Instantâneo actual como ISO 8601 com offset +01:00 (hora «oficial» do ponto no insert).
 */
export function agoraIsoParaDataHoraPonto(de: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: PONTO_FUSO_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(de);
  const y = part(p, 'year', '1970');
  const mo = part(p, 'month', '01');
  const day = part(p, 'day', '01');
  const h = part(p, 'hour', '00');
  const mi = part(p, 'minute', '00');
  const s = part(p, 'second', '00');
  return `${y}-${mo}-${day}T${h}:${mi}:${s}+01:00`;
}

/** Formata a hora (HH:mm:ss) de um instante ISO para o fuso do ponto (WAT). */
export function formatarHoraEmFusoPonto(isoOuTimestamp: string): string | null {
  if (!isoOuTimestamp?.trim()) return null;
  const raw = isoOuTimestamp.trim();
  const normalized = raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00Z`;
  let t: number;
  try {
    t = Date.parse(normalized);
  } catch {
    return null;
  }
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: PONTO_FUSO_IANA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}
