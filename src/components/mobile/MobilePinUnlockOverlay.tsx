import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PONTO_PIN_LENGTH, rpcVerificarMeuPontoPin } from '@/lib/pontoPinRpc';
import { supabase } from '@/lib/supabase';
import { MobilePinDots, MobilePinKeypad } from '@/components/mobile/MobilePinKeypad';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';

type Props = {
  onSuccess: () => void;
};

function firstNameFromNome(nome: string | undefined): string {
  const t = nome?.trim();
  if (!t) return 'Utilizador';
  return t.split(/\s+/)[0] ?? 'Utilizador';
}

export function MobilePinUnlockOverlay({ onSuccess }: Props) {
  const { logout, user } = useAuth();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const attemptRef = useRef(0);

  const greeting = firstNameFromNome(user?.nome);

  useEffect(() => {
    if (digits.length !== PONTO_PIN_LENGTH || !supabase) return;

    let cancelled = false;
    const id = ++attemptRef.current;
    setBusy(true);
    void rpcVerificarMeuPontoPin(supabase, digits)
      .then(ok => {
        if (cancelled || attemptRef.current !== id) return;
        setBusy(false);
        if (ok) {
          setDigits('');
          onSuccess();
        } else {
          setDigits('');
          toast.error('PIN incorrecto.');
        }
      })
      .catch(e => {
        if (cancelled || attemptRef.current !== id) return;
        setBusy(false);
        setDigits('');
        toast.error(e instanceof Error ? e.message : 'Não foi possível verificar o PIN.');
      });
    return () => {
      cancelled = true;
      setBusy(false);
    };
  }, [digits, onSuccess]);

  const append = (d: string) => {
    if (busy || digits.length >= PONTO_PIN_LENGTH) return;
    setDigits(prev => prev + d);
  };

  const backspace = () => {
    if (busy) return;
    setDigits(prev => prev.slice(0, -1));
  };

  return (
    <div
      className="fixed inset-0 z-[100] min-h-[100dvh] overflow-y-auto lg:hidden"
      role="dialog"
      aria-modal
      aria-labelledby="pin-unlock-title"
    >
      <div className="relative flex min-h-[100dvh] flex-col bg-[hsl(var(--navy))]">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy))] to-[hsl(var(--navy-lighter))] px-5 pb-16 pt-[max(2rem,calc(env(safe-area-inset-top,0px)+1.25rem))]">
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/[0.06]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-8 left-1/4 h-40 w-40 rounded-full bg-[hsl(var(--primary)/0.12)] blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 h-32 w-48 rounded-full bg-white/[0.04]"
            aria-hidden
          />
          <p className="text-transparent">PIN</p>
          <p className="text-transparent">PIN</p>
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo-white.png"
              alt="GRUPO SANEP"
              className="mb-5 h-12 w-auto max-w-[220px] object-contain"
              width={220}
              height={48}
            />
          </div>
        </div>

        <div className="relative z-[1] -mt-10 flex min-h-0 flex-1 flex-col rounded-t-[1.85rem] bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-8 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
          <h1 id="pin-unlock-title" className="text-center text-2xl font-bold tracking-tight text-foreground">
            Olá, {greeting}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">Introduza o PIN para continuar</p>

          <div className="mt-8 w-full">
            <MobilePinDots filled={digits.length} total={PONTO_PIN_LENGTH} size="md" />
          </div>

          <div className="mt-10 w-full flex-1">
            <MobilePinKeypad
              variant="card"
              onDigit={append}
              onBackspace={backspace}
              disabled={busy}
            />
          </div>

          <button
            type="button"
            className="mx-auto mt-8 flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Terminar sessão
          </button>
        </div>
      </div>
    </div>
  );
}
