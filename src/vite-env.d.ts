/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SSE_URL?: string;
  /** Opcional: mesmo valor que `SSE_GATEWAY_SECRET` no gateway (query `token=`) */
  readonly VITE_SSE_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
