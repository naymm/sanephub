import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function mountApp(): void {
  document.getElementById("sanep-static-splash")?.remove();
  const root = document.getElementById("root");
  if (!root) {
    console.error("[sanep] Elemento #root em falta.");
    return;
  }
  createRoot(root).render(<App />);
}

/** Montagem imediata — evita splash HTML eterno por SW/reload ou awaits bloqueantes. */
mountApp();

if (import.meta.env.DEV) {
  void (async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) {
      console.warn("[sanep] Limpeza de service worker/cache (dev):", e);
    }
  })();
} else {
  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          /* Sem reload automático. */
        },
        onOfflineReady() {},
      });
    })
    .catch(e => {
      console.warn("[sanep] PWA register:", e);
    });
}
