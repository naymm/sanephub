import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

/** `vite-plugin-pwa` em dev pode registar `dev-sw.js`; se isso ficar no domínio de produção causa reload ao voltar à aba. */
function swScriptUrl(reg: ServiceWorkerRegistration): string {
  const w = reg.waiting ?? reg.installing ?? reg.active;
  return w?.scriptURL ?? "";
}

async function unregisterLegacyDevServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.filter(r => swScriptUrl(r).includes("dev-sw")).map(r => r.unregister()),
  );
}

// Service Worker apenas em produção (`registerType: "prompt"` no vite.config → sem reload automático).
// Em dev: garantir ausência total de SW (registos antigos + caches podem causar reload ao voltar à aba).
if (import.meta.env.DEV) {
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => void r.unregister());
    });
  }
  if ("caches" in window) {
    void caches.keys().then(keys => {
      keys.forEach(k => void caches.delete(k));
    });
  }
} else {
  void unregisterLegacyDevServiceWorkers().then(() => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        /* Não recarregar automaticamente; updates ficam disponíveis no próximo carregamento manual. */
      },
      onOfflineReady() {
        /* opcional */
      },
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
