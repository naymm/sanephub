/**
 * Geolocalização WGS84 para marcação de ponto — equilíbrio entre rapidez e precisão.
 * Acumula amostras com `watchPosition`, mas termina cedo se a precisão for boa ou após um tempo razoável.
 */

export type PosicaoDispositivo = {
  lat: number;
  lng: number;
  /** Raio de incerteza reportado pelo dispositivo (metros), ou null se inválido. */
  accuracyM: number | null;
};

export type ObterPosicaoPrecisaOptions = {
  /** Tempo máximo absoluto (ms). */
  timeoutMs?: number;
};

/** Não esperar mais que isto por uma melhoria marginal. */
const DEFAULT_MAX_MS = 12_000;
/** Ignorar leituras dos primeiros ms (muitas vezes rede/Wi‑Fi). */
const MIN_ANTES_DE_ACEITAR_BOA_MS = 1_400;
/** Se accuracy ≤ isto (m) após o mínimo acima, usa já (GPS útil). */
const ACCURACY_BOA_METROS = 48;
/** Após isto (ms), usa a melhor amostra recolhida mesmo que a accuracy ainda seja alta. */
const USAR_MELHOR_APOS_MS = 6_500;

const GEO_OPTS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 18_000,
};

function accuracyParaComparar(accuracy: number | undefined): number {
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return accuracy;
}

function coordsSaoValidasWgs84(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function posicaoParaResultado(pos: GeolocationPosition): PosicaoDispositivo | null {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  if (!coordsSaoValidasWgs84(lat, lng)) return null;
  const acc = pos.coords.accuracy;
  return {
    lat,
    lng,
    accuracyM: Number.isFinite(acc) && acc > 0 ? acc : null,
  };
}

function melhorPosicao(a: GeolocationPosition | null, b: GeolocationPosition): GeolocationPosition {
  if (!a) return b;
  return accuracyParaComparar(b.coords.accuracy) < accuracyParaComparar(a.coords.accuracy) ? b : a;
}

export function obterPosicaoDispositivoPrecisa(
  options?: ObterPosicaoPrecisaOptions,
): Promise<PosicaoDispositivo | null> {
  const maxMs = options?.timeoutMs ?? DEFAULT_MAX_MS;

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    let settled = false;
    let best: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    const t0 = Date.now();

    const finish = (value: PosicaoDispositivo | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutHandle);
      if (pollId != null) {
        window.clearInterval(pollId);
        pollId = null;
      }
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      resolve(value);
    };

    const tentarTerminarCedo = () => {
      if (settled || !best) return;
      const elapsed = Date.now() - t0;
      const acc = accuracyParaComparar(best.coords.accuracy);
      if (elapsed >= MIN_ANTES_DE_ACEITAR_BOA_MS && acc <= ACCURACY_BOA_METROS) {
        const r = posicaoParaResultado(best);
        if (r) finish(r);
        return;
      }
      if (elapsed >= USAR_MELHOR_APOS_MS) {
        const r = posicaoParaResultado(best);
        if (r) finish(r);
      }
    };

    const consider = (pos: GeolocationPosition) => {
      best = melhorPosicao(best, pos);
      tentarTerminarCedo();
    };

    pollId = window.setInterval(() => {
      if (settled) return;
      tentarTerminarCedo();
    }, 350);

    const timeoutHandle = window.setTimeout(() => {
      if (settled) return;
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (best) {
        const r = posicaoParaResultado(best);
        if (r) {
          finish(r);
          return;
        }
      }
      navigator.geolocation.getCurrentPosition(
        pos => finish(posicaoParaResultado(pos)),
        () => finish(null),
        { ...GEO_OPTS, timeout: Math.min(10_000, maxMs) },
      );
    }, maxMs);

    watchId = navigator.geolocation.watchPosition(
      consider,
      err => {
        if (err?.code === err.PERMISSION_DENIED) finish(null);
      },
      GEO_OPTS,
    );
  });
}

/** Sem geofences: uma leitura rápida (timeout curto). */
export function obterPosicaoDispositivoSimples(timeoutMs = 10_000): Promise<PosicaoDispositivo | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve(posicaoParaResultado(pos)),
      () => resolve(null),
      { ...GEO_OPTS, timeout: timeoutMs },
    );
  });
}
