/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SSE_URL?: string;
  /** Opcional: mesmo valor que `SSE_GATEWAY_SECRET` no gateway (query `token=`) */
  readonly VITE_SSE_TOKEN?: string;
  /**
   * Se `true`, após «Executar backup agora» o browser chama `POST {VITE_SSE_URL}/backups/process-queue`
   * com o JWT do admin. O `sse-gateway` tem de correr no **mesmo host** que `scripts/backups/` e `.env.backup`.
   */
  readonly VITE_BACKUP_TRIGGER_VIA_GATEWAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
