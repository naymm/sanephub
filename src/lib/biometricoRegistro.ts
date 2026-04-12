import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatarHoraEmFusoPonto } from '@/lib/pontoFusoHorario';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import type { NormalizedBiometricoRegistro } from '@/types';

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickBool(obj: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (['true', 't', '1', 'sim', 's', 'yes'].includes(s)) return true;
      if (['false', 'f', '0', 'não', 'nao', 'n', 'no'].includes(s)) return false;
    }
    if (typeof v === 'number') return v !== 0;
  }
  return null;
}

function pickMeta(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return null;
}

/** Nome amigável a partir de `client_meta` / variantes (ex.: System.deviceInfo.deviceName). */
export function extrairDeviceNameBiometricMeta(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const system = meta.System ?? meta.system;
  if (!system || typeof system !== 'object') return null;
  const deviceInfo = (system as Record<string, unknown>).deviceInfo;
  if (!deviceInfo || typeof deviceInfo !== 'object') return null;
  const name = (deviceInfo as Record<string, unknown>).deviceName;
  const s = name != null ? String(name).trim() : '';
  return s || null;
}

/**
 * Converte uma linha snake_case da BD para camelCase e valores normalizados para a UI
 * (aceita nomes de colunas alternativos comuns em esquemas PT/EN).
 */
export function mapBiometricoRegistroRow(row: Record<string, unknown>): Record<string, unknown> {
  return mapRowFromDb<Record<string, unknown>>('biometrico_registros', row);
}

function parseToDataIso(val: string | null): string | null {
  if (!val?.trim()) return null;
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    return format(parseISO(s), 'yyyy-MM-dd');
  } catch {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      return `${m[3]}-${mm}-${dd}`;
    }
  }
  return null;
}

function horaDeTimestamp(iso: string): string | null {
  return formatarHoraEmFusoPonto(iso);
}

function formatarDataPt(dataIso: string): string {
  if (!dataIso || dataIso.length < 10) return '—';
  try {
    return format(parseISO(`${dataIso.slice(0, 10)}T12:00:00`), 'dd/MM/yyyy', { locale: pt });
  } catch {
    return '—';
  }
}

export function normalizeBiometricoRegistro(camel: Record<string, unknown>): NormalizedBiometricoRegistro {
  const rawId = camel.id;
  const id: number | string =
    rawId == null
      ? 0
      : typeof rawId === 'number' && Number.isFinite(rawId)
        ? rawId
        : String(rawId);

  const occurredAtIso =
    pickString(camel, ['occurredAt', 'dataHora', 'dataRegisto', 'registadoEm', 'timestamp']) ??
    pickString(camel, ['createdAt', 'criadoEm']) ??
    '';

  const clientMeta =
    pickMeta(camel, ['clientMeta', 'metaCliente', 'meta_cliente', 'payload', 'dadosExtra']) ?? null;

  const kind = pickString(camel, ['kind', 'tipo', 'tipoMarcacao', 'tipoRegisto']) ?? '—';
  const kindLower = kind.toLowerCase();

  const colData = pickString(camel, ['data', 'dataDia', 'dia', 'dataReferencia']);
  let dataIso = parseToDataIso(colData);
  if (!dataIso && occurredAtIso.length >= 10) {
    dataIso = parseToDataIso(occurredAtIso) ?? occurredAtIso.slice(0, 10);
  }
  const dataTexto = dataIso ? formatarDataPt(dataIso) : '—';

  const entradaCol = pickString(camel, ['entrada', 'horaEntrada', 'hora_entrada', 'marcacaoEntrada', 'checkIn']);
  const saidaCol = pickString(camel, ['saida', 'horaSaida', 'hora_saida', 'marcacaoSaida', 'checkOut']);

  const temEntradaExplicita = Boolean(entradaCol?.trim());
  const temSaidaExplicita = Boolean(saidaCol?.trim());
  let entradaTexto = '';
  let saidaTexto = '';

  if (temEntradaExplicita || temSaidaExplicita) {
    entradaTexto = entradaCol?.trim() ?? '';
    saidaTexto = saidaCol?.trim() ?? '';
  } else if (occurredAtIso.trim()) {
    const h = horaDeTimestamp(occurredAtIso);
    const pareceSaida =
      kindLower.includes('saída') ||
      (kindLower.includes('saida') && !kindLower.includes('entrada')) ||
      kindLower.includes('clock_out');
    const pareceEntrada =
      kindLower.includes('entrada') || kindLower.includes('clock_in') || kindLower.includes('picagem');
    if (pareceSaida && !pareceEntrada) {
      saidaTexto = h ?? '';
    } else {
      entradaTexto = h ?? '';
    }
  }

  const entradaFinal = entradaTexto.trim() || '—';
  const saidaFinal = saidaTexto.trim() || '—';

  const verificationMethod = pickString(camel, ['verificationMethod', 'metodoVerificacao', 'metodo_verificacao']);
  const viaDirect = pickString(camel, ['via', 'canal', 'origem', 'meio', 'meioRegisto', 'fonte']);
  const device = extrairDeviceNameBiometricMeta(clientMeta);
  const viaTexto = viaDirect ?? verificationMethod ?? device ?? '—';

  const localTexto = pickString(camel, [
    'local',
    'localizacao',
    'localizacaoTexto',
    'morada',
    'endereco',
    'descricaoLocal',
    'nomeLocal',
    'zonaTexto',
    'ponto',
  ]);

  const empresaColunaTexto = pickString(camel, [
    'empresa',
    'empresaNome',
    'empresa_nome',
    'nomeEmpresa',
    'nome_empresa',
    'empresaTexto',
    'empresa_texto',
  ]);

  return {
    id,
    rawCamel: camel,
    numeroMec: pickString(camel, ['numeroMec']),
    occurredAtIso,
    dataIso: dataIso ?? '',
    dataTexto,
    entradaTexto: entradaFinal,
    saidaTexto: saidaFinal,
    localTexto,
    empresaColunaTexto,
    viaTexto,
    kind,
    status: pickString(camel, ['status', 'estado', 'situacao']) ?? '—',
    empresaId: pickNumber(camel, ['empresaId']),
    pinVerified: pickBool(camel, ['pinVerified', 'pinVerificado']),
    faceVerified: pickBool(camel, ['faceVerified', 'faceVerificada', 'verificacaoFacial']),
    faceConfidence: pickNumber(camel, ['faceConfidence', 'nivelConfiancaFace', 'confiancaFace']),
    verificationMethod,
    locationLat: pickNumber(camel, ['locationLat', 'latitude', 'lat']),
    locationLng: pickNumber(camel, ['locationLng', 'longitude', 'lng', 'lon']),
    locationAccuracyM: pickNumber(camel, ['locationAccuracyM', 'precisaoMetros', 'precisao_m', 'accuracyM']),
    geofenceId: pickNumber(camel, ['geofenceId', 'geocercaId', 'zonaId']),
    isWithinGeofence: pickBool(camel, ['isWithinGeofence', 'dentroGeocerca', 'dentro_geocerca']),
    selfieStoragePath: pickString(camel, ['selfieStoragePath', 'caminhoSelfie', 'fotoPath']),
    authUserId: pickString(camel, ['authUserId']),
    clientMeta,
  };
}

/** Dia civil `yyyy-MM-dd` para agrupar / filtrar (alinhado à página de marcações). */
export function biometricoDataDiaIso(r: NormalizedBiometricoRegistro): string {
  if (r.dataIso && r.dataIso.length >= 10) return r.dataIso.slice(0, 10);
  const d = r.occurredAtIso?.trim();
  if (d && d.length >= 10) return d.slice(0, 10);
  return '';
}

function occurredAtSortMs(iso: string): number {
  const t = iso?.trim();
  if (!t) return Number.POSITIVE_INFINITY;
  try {
    const norm = t.includes('T') ? t : `${t.slice(0, 10)}T12:00:00`;
    const n = parseISO(norm).getTime();
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function parseHoraSegundos(s: string): number | null {
  const t = s.trim();
  if (!t || t === '—') return null;
  const parts = t.split(':').map(p => parseInt(p, 10));
  if (parts.some(n => !Number.isFinite(n))) return null;
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const sec = parts[2] ?? 0;
  return h * 3600 + m * 60 + sec;
}

function extremoHoras(valores: string[], min: boolean): string | null {
  let best: { t: string; sec: number } | null = null;
  for (const v of valores) {
    const sec = parseHoraSegundos(v);
    if (sec == null) continue;
    if (!best || (min ? sec < best.sec : sec > best.sec)) best = { t: v.trim(), sec };
  }
  return best?.t ?? null;
}

function juntarUnicosLegiveis(vals: (string | null | undefined)[], sep: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of vals) {
    const s = (v ?? '').trim();
    if (!s || s === '—') continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.length ? out.join(sep) : '—';
}

function mergeBoolAnyTrue(vals: (boolean | null | undefined)[]): boolean | null {
  const defined = vals.filter((v): v is boolean => v === true || v === false);
  if (!defined.length) return null;
  if (defined.some(Boolean)) return true;
  return false;
}

function fundirGrupoBiometrico(group: NormalizedBiometricoRegistro[]): NormalizedBiometricoRegistro {
  const sorted = [...group].sort((a, b) => occurredAtSortMs(a.occurredAtIso) - occurredAtSortMs(b.occurredAtIso));
  const first = sorted[0];

  const entradas = sorted.map(r => r.entradaTexto).filter(t => t && t !== '—');
  const saidas = sorted.map(r => r.saidaTexto).filter(t => t && t !== '—');

  let entradaTexto = extremoHoras(entradas, true) ?? '—';
  let saidaTexto = extremoHoras(saidas, false) ?? '—';

  const comInstante = sorted.filter(
    r => r.occurredAtIso.trim() && occurredAtSortMs(r.occurredAtIso) < Number.POSITIVE_INFINITY,
  );
  if (entradaTexto === '—' && comInstante.length) {
    const h = horaDeTimestamp(comInstante[0].occurredAtIso);
    if (h) entradaTexto = h;
  }
  if (saidaTexto === '—' && comInstante.length >= 2) {
    const h = horaDeTimestamp(comInstante[comInstante.length - 1].occurredAtIso);
    if (h) saidaTexto = h;
  }

  const dk = biometricoDataDiaIso(first);
  const dataIso = dk.length >= 10 ? dk : first.dataIso;
  const dataTexto = dataIso.length >= 10 ? formatarDataPt(dataIso) : first.dataTexto;

  const kind = juntarUnicosLegiveis(sorted.map(r => r.kind), ', ');
  const status = juntarUnicosLegiveis(sorted.map(r => r.status), ', ');
  const viaTexto = juntarUnicosLegiveis(sorted.map(r => r.viaTexto), ', ');
  const localMerged = juntarUnicosLegiveis(sorted.map(r => r.localTexto ?? ''), ' · ');
  const localTexto = localMerged === '—' ? null : localMerged;
  const empresaColMerged = juntarUnicosLegiveis(sorted.map(r => r.empresaColunaTexto ?? ''), ' · ');
  const empresaColunaTexto = empresaColMerged === '—' ? null : empresaColMerged;

  const comLoc = sorted.find(r => r.locationLat != null && r.locationLng != null);
  const locLat = comLoc?.locationLat ?? first.locationLat;
  const locLng = comLoc?.locationLng ?? first.locationLng;
  const verificationMerged = juntarUnicosLegiveis(sorted.map(r => r.verificationMethod), ', ');

  const id = `dia:${dataIso}:${(first.numeroMec ?? '').trim().toLowerCase()}`;

  return {
    id,
    rawCamel: first.rawCamel,
    numeroMec: first.numeroMec,
    occurredAtIso: first.occurredAtIso,
    dataIso,
    dataTexto,
    entradaTexto,
    saidaTexto,
    localTexto,
    empresaColunaTexto,
    viaTexto,
    kind,
    status,
    empresaId: first.empresaId,
    pinVerified: mergeBoolAnyTrue(sorted.map(r => r.pinVerified)),
    faceVerified: mergeBoolAnyTrue(sorted.map(r => r.faceVerified)),
    faceConfidence: sorted.find(r => r.faceConfidence != null)?.faceConfidence ?? first.faceConfidence,
    verificationMethod: verificationMerged === '—' ? null : verificationMerged,
    locationLat: locLat,
    locationLng: locLng,
    locationAccuracyM: comLoc?.locationAccuracyM ?? first.locationAccuracyM,
    geofenceId: sorted.find(r => r.geofenceId != null)?.geofenceId ?? first.geofenceId,
    isWithinGeofence: (() => {
      const ws = sorted.map(r => r.isWithinGeofence);
      if (ws.every(w => w == null)) return null;
      if (ws.some(w => w === true)) return true;
      if (ws.some(w => w === false)) return false;
      return null;
    })(),
    selfieStoragePath: sorted.find(r => r.selfieStoragePath)?.selfieStoragePath ?? first.selfieStoragePath,
    authUserId: first.authUserId,
    clientMeta: first.clientMeta,
    mergedSources: sorted,
  };
}

/** Uma linha por dia e por `numero_mec`; sem data ou sem nº mec, mantém linhas soltas. */
export function agruparRegistrosBiometricoPorDiaNumeroMec(
  rows: NormalizedBiometricoRegistro[],
): NormalizedBiometricoRegistro[] {
  const byKey = new Map<string, NormalizedBiometricoRegistro[]>();
  const orphans: NormalizedBiometricoRegistro[] = [];

  for (const r of rows) {
    const dk = biometricoDataDiaIso(r);
    const mec = (r.numeroMec ?? '').trim().toLowerCase();
    if (dk.length >= 10 && mec) {
      const k = `${dk}__${mec}`;
      const arr = byKey.get(k) ?? [];
      arr.push(r);
      byKey.set(k, arr);
    } else {
      orphans.push(r);
    }
  }

  const merged: NormalizedBiometricoRegistro[] = [];
  for (const group of byKey.values()) {
    merged.push(group.length === 1 ? group[0] : fundirGrupoBiometrico(group));
  }
  merged.push(...orphans);

  merged.sort((a, b) => {
    const da = biometricoDataDiaIso(a);
    const db = biometricoDataDiaIso(b);
    const cmp = db.localeCompare(da);
    if (cmp !== 0) return cmp;
    return (a.numeroMec ?? '').localeCompare(b.numeroMec ?? '', 'pt');
  });

  return merged;
}
