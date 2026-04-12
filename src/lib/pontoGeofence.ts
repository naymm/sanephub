import type { ColaboradorGeofenceLink, Geofence } from '@/types';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distância em metros entre dois pontos WGS84 (fórmula de Haversine). */
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Geofences activas, da empresa, ligadas ao colaborador em `colaborador_geofences`. */
export function geofencesPermitidasParaColaborador(
  colaboradorId: number,
  empresaId: number,
  todasGeofences: Geofence[],
  links: ColaboradorGeofenceLink[],
): Geofence[] {
  const ids = new Set(links.filter(l => l.colaboradorId === colaboradorId).map(l => l.geofenceId));
  return todasGeofences.filter(
    g => ids.has(g.id) && g.activo && g.empresaId === empresaId,
  );
}

/**
 * Zonas contra as quais validar a marcação de ponto:
 * — se o colaborador tem zonas atribuídas, usa só essas;
 * — senão, se a empresa tem pelo menos uma zona activa cadastrada, usa **todas** as zonas activas da empresa.
 */
export function geofencesParaMarcacaoPonto(
  colaboradorId: number,
  empresaId: number,
  todasGeofences: Geofence[],
  links: ColaboradorGeofenceLink[],
): Geofence[] {
  const atribuidas = geofencesPermitidasParaColaborador(
    colaboradorId,
    empresaId,
    todasGeofences,
    links,
  );
  if (atribuidas.length > 0) return atribuidas;
  return todasGeofences.filter(g => g.activo && g.empresaId === empresaId);
}

/**
 * Primeira zona (menor id) em que o dispositivo está dentro do raio.
 * Se `accuracyMeters` for conhecido, exige `distância + incerteza ≤ raio` (Haversine ao centro).
 */
export function geofenceQueContemPonto(
  lat: number,
  lng: number,
  candidatas: Geofence[],
  accuracyMeters?: number | null,
): Geofence | null {
  const margem =
    accuracyMeters != null && Number.isFinite(accuracyMeters) && accuracyMeters > 0
      ? accuracyMeters
      : 0;
  const dentro = candidatas.filter(g => {
    const d = distanciaMetros(lat, lng, g.centerLat, g.centerLng);
    return d + margem <= g.radiusMeters;
  });
  if (!dentro.length) return null;
  return [...dentro].sort((a, b) => a.id - b.id)[0] ?? null;
}

export type ResultadoMarcacaoGeofence =
  | { ok: true; exigeZona: false; geofenceId?: undefined; isWithinGeofence?: undefined }
  | { ok: true; exigeZona: true; geofenceId: number; isWithinGeofence: true }
  | { ok: false; codigo: 'fora_da_zona' | 'localizacao_indisponivel'; mensagem: string };

/**
 * Se existem zonas de ponto a considerar (atribuídas ao colaborador ou, na falta disso, todas as activas da empresa),
 * exige GPS e posição dentro do raio de pelo menos uma.
 */
export function validarMarcacaoComGeofences(input: {
  colaboradorId: number;
  empresaId: number;
  coords: { lat: number; lng: number; accuracyM?: number } | null;
  geofences: Geofence[];
  links: ColaboradorGeofenceLink[];
}): ResultadoMarcacaoGeofence {
  const candidatas = geofencesParaMarcacaoPonto(
    input.colaboradorId,
    input.empresaId,
    input.geofences,
    input.links,
  );
  if (candidatas.length === 0) {
    return { ok: true, exigeZona: false };
  }
  if (!input.coords) {
    return {
      ok: false,
      codigo: 'localizacao_indisponivel',
      mensagem:
        'É necessária a localização do dispositivo para comparar com as zonas cadastradas. Permita o acesso ao GPS e tente novamente. O ponto não foi registado.',
    };
  }
  const acc = input.coords.accuracyM ?? null;
  const zona = geofenceQueContemPonto(input.coords.lat, input.coords.lng, candidatas, acc);
  if (!zona) {
    const minRaio = Math.min(...candidatas.map(g => g.radiusMeters));
    const accRounded = acc != null && Number.isFinite(acc) ? Math.round(acc) : null;
    const sufixoPrecisao =
      accRounded != null && accRounded > minRaio * 0.85;
    return {
      ok: false,
      codigo: 'fora_da_zona',
      mensagem:
        'A sua posição actual não se encontra dentro do raio de nenhuma zona de ponto registada para a empresa.',
    };
  }
  return { ok: true, exigeZona: true, geofenceId: zona.id, isWithinGeofence: true };
}
