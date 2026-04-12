/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('push', (event: PushEvent) => {
  let title = 'Sanep Hub';
  let body = 'Nova atualização';
  let url = '/dashboard';
  let tag = 'sanep-default';

  try {
    const raw = event.data?.text();
    if (raw) {
      const parsed = JSON.parse(raw) as { title?: string; body?: string; url?: string; tag?: string };
      if (typeof parsed.title === 'string') title = parsed.title;
      if (typeof parsed.body === 'string') body = parsed.body;
      if (typeof parsed.url === 'string') url = parsed.url;
      if (typeof parsed.tag === 'string') tag = parsed.tag;
    }
  } catch {
    /* ignore */
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192.png',
      badge: '/favicon.png',
      tag,
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? '/dashboard';
  const scope = self.registration.scope;
  const absolute = new URL(targetUrl, scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        const c = client as WindowClient;
        if (c.url.startsWith(new URL(scope).origin)) {
          if (typeof c.navigate === 'function') {
            void c.navigate(absolute);
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute);
      }
    }),
  );
});
