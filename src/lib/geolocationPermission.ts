/**
 * Dispara o diálogo nativo de permissão de localização (GPS / rede).
 * Deve ser chamado a partir de um gesto do utilizador no Safari/iOS PWA.
 */
export type GeolocationPromptResult =
  | { ok: true }
  | { ok: false; code: 'denied' | 'timeout' | 'unavailable' | 'unsupported' };

export function pedirPermissaoLocalizacao(): Promise<GeolocationPromptResult> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, code: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve({ ok: true }),
      err => {
        if (err.code === err.PERMISSION_DENIED) resolve({ ok: false, code: 'denied' });
        else if (err.code === err.TIMEOUT) resolve({ ok: false, code: 'timeout' });
        else resolve({ ok: false, code: 'unavailable' });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 25_000,
      },
    );
  });
}

/** Leitura leve para «aquecer» permissão em browsers que permitem sem gesto (ex.: Android PWA). */
export function pedirPermissaoLocalizacaoLeve(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 12_000,
      },
    );
  });
}
