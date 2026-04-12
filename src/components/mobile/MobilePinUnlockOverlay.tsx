import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PONTO_PIN_LENGTH, rpcVerificarMeuPontoPin } from '@/lib/pontoPinRpc';
import { supabase } from '@/lib/supabase';
import { MobilePinDots, MobilePinKeypad } from '@/components/mobile/MobilePinKeypad';
import { PontoPinOtpFields } from '@/components/ponto/PontoPinOtpFields';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { userAvatarFallbackLabel, userAvatarImageSrc } from '@/utils/userAvatar';

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
  const isMobileViewport = useIsMobileViewport();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const attemptRef = useRef(0);

  const greeting = firstNameFromNome(user?.nome);
  const avatarPhotoUrl = userAvatarImageSrc(user);
  const avatarFallback = userAvatarFallbackLabel(user);

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

  if (!isMobileViewport) {
    return (
      <div
        className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-hidden overscroll-none p-6"
        role="dialog"
        aria-modal
        aria-labelledby="pin-unlock-title"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[hsl(var(--navy))]/40 via-transparent to-[hsl(var(--navy))]/50" aria-hidden />

        <div className="relative w-full max-w-[440px] animate-in fade-in zoom-in-95 rounded-2xl border border-white/10 bg-[hsl(var(--navy))]/95 p-10 shadow-2xl ring-1 ring-white/5 duration-200">
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo-white.png"
              alt="GRUPO SANEP"
              className="mb-6 h-10 w-auto max-w-[200px] object-contain"
              width={200}
              height={40}
            />
            <Avatar className="h-16 w-16 ring-2 ring-white/15">
              {avatarPhotoUrl ? (
                <AvatarImage src={avatarPhotoUrl} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-white/10 text-lg font-semibold text-white">{avatarFallback}</AvatarFallback>
            </Avatar>
            <h1 id="pin-unlock-title" className="mt-5 text-2xl font-bold tracking-tight text-white">
              Olá, {greeting}
            </h1>
            <p className="mt-2 text-sm text-white/75">
              Olá,{' '}
               Utilize o PIN para continuar.
            </p>
            {user?.email ? (
              <p className="mt-2 max-w-full truncate text-xs text-white/45">{user.email}</p>
            ) : null}

            <div className="mt-8 w-full">
              <PontoPinOtpFields
                variant="dark"
                value={digits}
                onChange={setDigits}
                disabled={busy}
                autoFocus
                containerClassName="gap-1"
              />
            </div>

            <button
              type="button"
              className="mt-10 flex items-center justify-center gap-2 text-sm text-white/55 transition hover:text-[hsl(var(--primary))]"
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

  return (
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] items-stretch justify-center overflow-hidden overscroll-none"
      role="dialog"
      aria-modal
      aria-labelledby="pin-unlock-title"
    >
      <div className="relative flex h-full w-full max-h-full min-h-0 flex-col bg-[hsl(var(--navy))]">
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy))] to-[hsl(var(--navy-lighter))] px-5 pb-10 pt-[max(1.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))]">
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
              className="mb-3 h-10 w-auto max-w-[200px] object-contain"
              width={200}
              height={40}
            />
          </div>
        </div>

        <div className="relative z-[1] -mt-8 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[1.85rem] bg-background px-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
          <div className="flex shrink-0 justify-center">
            <Avatar className="h-14 w-14 ring-2 ring-border/40">
              {avatarPhotoUrl ? (
                <AvatarImage src={avatarPhotoUrl} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="text-base font-semibold">{avatarFallback}</AvatarFallback>
            </Avatar>
          </div>
          <h1 id="pin-unlock-title" className="mt-3 shrink-0 text-center text-xl font-bold tracking-tight text-foreground">
            Olá, {greeting}
          </h1>
          <p className="mt-1 shrink-0 text-center text-sm text-muted-foreground">Introduza o PIN para continuar</p>

          <div className="mt-2 w-full shrink-0">
            <MobilePinDots
              filled={digits.length}
              total={PONTO_PIN_LENGTH}
              size="sm"
              className="py-0.5"
            />
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col justify-center py-1">
            <MobilePinKeypad
              variant="cardDense"
              onDigit={append}
              onBackspace={backspace}
              disabled={busy}
            />
          </div>

          <button
            type="button"
            className="mx-auto mt-auto flex shrink-0 items-center justify-center gap-2 py-2 text-sm text-muted-foreground transition hover:text-foreground"
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
