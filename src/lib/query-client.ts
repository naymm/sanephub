import { QueryClient } from '@tanstack/react-query';

/**
 * Defaults alinhados com política cache-first no servidor (ver `docs/ENTERPRISE-ARCHITECTURE.md`).
 * Sobrescrever por query: `staleTime` / `gcTime` por domínio (dashboard vs detalhe).
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
