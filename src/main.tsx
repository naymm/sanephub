import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

/** Após `unregister()`, o browser pode manter `navigator.serviceWorker.controller` até um reload — um reload único resolve. */
const DEV_SW_POST_CLEANUP = "sanep_dev_sw_post_cleanup";

/** `vite-plugin-pwa` em dev pode registar `dev-sw.js`; no domínio de produção isso causa reload ao voltar à aba. */
function swScriptUrl(reg: ServiceWorkerRegistration): string {
  const w = reg.waiting ?? reg.installing ?? reg.active;
  return w?.scriptURL ?? "";
}

async function unregisterLegacyDevServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  const devRegs = regs.filter(r => swScriptUrl(r).includes("dev-sw"));
  if (devRegs.length === 0) return false;
  await Promise.all(devRegs.map(r => r.unregister()));
  return true;
}

async function stripAllServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) return false;
  await Promise.all(regs.map(r => r.unregister()));
  return true;
}

async function clearAllCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
}

async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV) {
    if (sessionStorage.getItem(DEV_SW_POST_CLEANUP)) {
      sessionStorage.removeItem(DEV_SW_POST_CLEANUP);
    } else {
      const removedRegs = await stripAllServiceWorkers();
      await clearAllCaches();
      const controlled = Boolean(navigator.serviceWorker?.controller);
      if (removedRegs || controlled) {
        sessionStorage.setItem(DEV_SW_POST_CLEANUP, "1");
        window.location.reload();
        return;
      }
    }
  } else {
    await unregisterLegacyDevServiceWorkers();
    registerSW({
      immediate: true,
      onNeedRefresh() {
        /* Sem reload automático; nova versão fica disponível no próximo carregamento manual. */
      },
      onOfflineReady() {},
    });
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
