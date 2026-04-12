import { useCallback, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { syncWebPushSubscription } from '@/lib/webPushClient';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'sanep-web-push-banner-dismissed';

function supportsWebPushSubscribe(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Mobile: convite para notificações push (notícias). Fixo acima da bottom nav para ser sempre visível.
 * `Notification.requestPermission()` corre logo no toque (antes de outros `await`) para Safari/iOS aceitar o gesto.
 */
export function MobileWebPushBanner() {
  const mobile = useIsMobileViewport();
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const vapid = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();
  const canSubscribe = supportsWebPushSubscribe();

  const trySync = useCallback(async () => {
    if (!supabase) return;
    const v = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();
    if (!v) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    await syncWebPushSubscription(supabase, uid);
  }, []);

  useEffect(() => {
    if (!mobile || !isAuthReady || !isAuthenticated || !user || !isSupabaseConfigured() || !supabase) {
      return;
    }
    if (Notification.permission !== 'granted') return;
    void trySync();
  }, [mobile, isAuthReady, isAuthenticated, user, trySync]);

  if (!mobile || !isAuthReady || !isAuthenticated || !user || !isSupabaseConfigured() || !supabase) {
    return null;
  }
  if (typeof Notification === 'undefined') {
    return null;
  }
  if (Notification.permission === 'denied') return null;
  if (Notification.permission === 'granted') return null;
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  /** Safari/iOS exige que `requestPermission()` seja chamado na mesma volta do evento de clique (sem `async`/`await` antes). */
  const enable = () => {
    void Notification.requestPermission().then(permission => {
      if (permission !== 'granted') {
        toast.message('Sem permissão não é possível enviar avisos de novas notícias.');
        return;
      }

      void (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) {
          toast.error('Sessão inválida.');
          return;
        }

        if (!canSubscribe) {
          toast.message(
            'Permissão aceite. Para receber avisos no iPhone, adicione o Sanep Hub ao ecrã inicial e abra a app instalada.',
            { duration: 9000 },
          );
          dismiss();
          return;
        }

        if (!vapid) {
          toast.error(
            'Falta VITE_VAPID_PUBLIC_KEY no build da app. Reinicie o servidor de desenvolvimento após alterar o .env.',
          );
          dismiss();
          return;
        }

        const r = await syncWebPushSubscription(supabase, uid);
        if (r.ok) toast.success('Notificações activadas.');
        else toast.error(r.reason === 'no_vapid' ? 'Configuração incompleta.' : 'Não foi possível activar.');
        dismiss();
      })();
    });
  };

  return (
    <div
      className={cn(
        'fixed left-3 right-3 z-[45] rounded-2xl border border-primary/35 bg-card/95 px-3 py-3 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-card/90',
        'flex items-start gap-2.5 sm:gap-3',
        /* Acima da MobileBottomNav (≈4rem + safe area) */
        'bottom-[calc(4.85rem+env(safe-area-inset-bottom,0px))]',
      )}
      role="region"
      aria-label="Notificações push"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:h-10 sm:w-10">
        <Bell className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-foreground leading-tight">Notificações de notícias</p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug sm:text-xs">
          {canSubscribe
            ? 'Toque em Activar e depois em «Permitir» no alerta do sistema.'
            : 'Toque em Activar para permitir alertas. No iPhone, use também a app no ecrã inicial para receber avisos.'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" className="h-8 text-xs" onClick={enable}>
            Activar
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={dismiss}>
            Agora não
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Fechar"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
