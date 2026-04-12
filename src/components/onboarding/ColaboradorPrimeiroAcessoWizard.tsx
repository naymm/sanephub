import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { PONTO_PIN_LENGTH, rpcDefinirMeuPontoPin, rpcPerfilTemPontoPin } from '@/lib/pontoPinRpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PontoPinOtpFields } from '@/components/ponto/PontoPinOtpFields';
import { KeyRound, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { userAvatarFallbackLabel, userAvatarImageSrc } from '@/utils/userAvatar';
import {
  avaliarForcaSenha,
  labelForcaSenha,
  SENHA_MIN_CARACTERES,
} from '@/utils/passwordStrength';

async function marcarPrimeiroAcessoConcluido(profileId: number): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { error } = await supabase
    .from('profiles')
    .update({
      primeiro_acesso_pendente: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId);
  if (error) throw new Error(error.message);
}

function firstNameFromNome(nome: string | undefined): string {
  const t = nome?.trim();
  if (!t) return 'Utilizador';
  return t.split(/\s+/)[0] ?? 'Utilizador';
}

function PasswordComVisibilidade({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  mostrar,
  onAlternarMostrar,
  invalid,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  disabled?: boolean;
  mostrar: boolean;
  onAlternarMostrar: () => void;
  /** Erro visual (ex.: confirmação não coincide). */
  invalid?: boolean;
  onBlur?: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={mostrar ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            'pr-11',
            invalid && 'border-destructive focus-visible:ring-destructive/40',
          )}
        />
        <button
          type="button"
          className="absolute right-0.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onAlternarMostrar}
          disabled={disabled}
          aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={mostrar}
        >
          {mostrar ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

/**
 * Ecrã obrigatório no primeiro login do perfil Colaborador (Supabase): alterar senha + definir PIN de ponto.
 * Cobre mobile e desktop (renderizado no Layout autenticado).
 */
export function ColaboradorPrimeiroAcessoWizard() {
  const { user, refreshSessionUser } = useAuth();
  const open =
    Boolean(isSupabaseConfigured() && supabase && user?.perfil === 'Colaborador' && user.primeiroAcessoPendente);

  const [step, setStep] = useState(1);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [pin, setPin] = useState('');
  const [pinConf, setPinConf] = useState('');
  const [busy, setBusy] = useState(false);
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const forcaNova = useMemo(() => avaliarForcaSenha(novaSenha), [novaSenha]);

  /**
   * Resultado da verificação nova ≠ confirmar, só após sair do input (blur).
   * `null` = ainda não foi feita verificação por blur.
   */
  const [confirmacaoAposBlur, setConfirmacaoAposBlur] = useState<
    null | 'match' | 'mismatch' | 'vazio'
  >(null);

  const aplicarVerificacaoConfirmacao = useCallback(() => {
    const n = novaSenha.trim();
    const c = confirmarSenha.trim();
    if (c.length === 0) {
      setConfirmacaoAposBlur('vazio');
      return;
    }
    if (n === c) setConfirmacaoAposBlur('match');
    else setConfirmacaoAposBlur('mismatch');
  }, [novaSenha, confirmarSenha]);

  /** Ao sair da «nova senha», revalidar se já existe texto na confirmação. */
  const onBlurNovaSenha = useCallback(() => {
    if (confirmarSenha.trim().length === 0) {
      setConfirmacaoAposBlur(null);
      return;
    }
    aplicarVerificacaoConfirmacao();
  }, [aplicarVerificacaoConfirmacao, confirmarSenha]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setPin('');
    setPinConf('');
    setBusy(false);
    setMostrarSenhaAtual(false);
    setMostrarNovaSenha(false);
    setMostrarConfirmar(false);
    setConfirmacaoAposBlur(null);
  }, [open, user?.id]);

  const handlePasswordStep = useCallback(async () => {
    if (!supabase || !user?.email) return;
    const a = senhaAtual.trim();
    const n = novaSenha.trim();
    const c = confirmarSenha.trim();
    if (!a) {
      toast.error('Introduza a senha actual.');
      return;
    }
    if (n.length < SENHA_MIN_CARACTERES) {
      toast.error(`A nova senha deve ter pelo menos ${SENHA_MIN_CARACTERES} caracteres.`);
      return;
    }
    if (avaliarForcaSenha(n).nivel === 'fraca') {
      toast.error(
        'A senha é demasiado fraca. Combine letras maiúsculas e minúsculas, números e símbolos para uma senha mais segura.',
      );
      return;
    }
    if (n !== c) {
      toast.error('A confirmação da nova senha não coincide.');
      return;
    }
    if (n === a) {
      toast.error('A nova senha não pode ser igual à senha actual. Escolha uma senha diferente.');
      return;
    }
    setBusy(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email.trim(),
        password: a,
      });
      if (signErr) {
        toast.error('Senha actual incorrecta.');
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: n });
      if (updErr) {
        toast.error(updErr.message || 'Não foi possível actualizar a senha.');
        return;
      }
      toast.success('Senha actualizada.');
      setStep(2);
      setPin('');
      setPinConf('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao alterar a senha.');
    } finally {
      setBusy(false);
    }
  }, [confirmarSenha, novaSenha, senhaAtual, user?.email]);

  const handlePinStep = useCallback(async () => {
    if (!supabase || !user?.id) return;
    if (pin.length !== PONTO_PIN_LENGTH || pinConf.length !== PONTO_PIN_LENGTH) {
      toast.error(`Preencha os dois campos com ${PONTO_PIN_LENGTH} dígitos.`);
      return;
    }
    if (pin !== pinConf) {
      toast.error('Os PINs não coincidem.');
      return;
    }
    setBusy(true);
    try {
      const jaTemPin = await rpcPerfilTemPontoPin(supabase);
      if (!jaTemPin) {
        await rpcDefinirMeuPontoPin(supabase, pin);
      }
      try {
        await marcarPrimeiroAcessoConcluido(user.id);
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `${e.message} O PIN foi guardado; toque em Concluir de novo ou contacte os RH.`
            : 'Erro ao concluir o registo.',
        );
        await refreshSessionUser();
        return;
      }
      await refreshSessionUser();
      toast.success('Conta configurada. Bem-vindo!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar o PIN.');
    } finally {
      setBusy(false);
    }
  }, [pin, pinConf, refreshSessionUser, user?.id]);

  if (!open) return null;

  const avatarPhotoUrl = userAvatarImageSrc(user);
  const avatarFallback = userAvatarFallbackLabel(user);
  const greeting = firstNameFromNome(user?.nome);
  const tituloPasso = step === 1 ? 'Primeiro acesso — senha' : 'Definir PIN de ponto';
  const descricaoPasso =
    step === 1
      ? 'Por segurança, altere a senha temporária por uma senha sua. Esta operação só é necessária uma vez.'
      : `Escolha um código de ${PONTO_PIN_LENGTH} dígitos para confirmar marcações de ponto e para desbloquear a app no telemóvel.`;

  const formulario = (
    <>
      {step === 1 ? (
        <>
          <PasswordComVisibilidade
            id="cpa-senha-atual"
            label="Senha actual"
            value={senhaAtual}
            onChange={setSenhaAtual}
            autoComplete="current-password"
            disabled={busy}
            mostrar={mostrarSenhaAtual}
            onAlternarMostrar={() => setMostrarSenhaAtual(v => !v)}
          />
          <div className="space-y-2">
            <PasswordComVisibilidade
              id="cpa-nova"
              label={`Nova senha (mín. ${SENHA_MIN_CARACTERES} caracteres)`}
              value={novaSenha}
              onChange={setNovaSenha}
              autoComplete="new-password"
              disabled={busy}
              mostrar={mostrarNovaSenha}
              onAlternarMostrar={() => setMostrarNovaSenha(v => !v)}
              onBlur={onBlurNovaSenha}
            />
            <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Força da senha</span>
                <span
                  className={cn(
                    'font-semibold',
                    forcaNova.nivel === 'fraca' && 'text-destructive',
                    forcaNova.nivel === 'media' && 'text-amber-600 dark:text-amber-500',
                    forcaNova.nivel === 'forte' && 'text-emerald-600 dark:text-emerald-500',
                  )}
                >
                  {labelForcaSenha(forcaNova.nivel)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-200',
                    forcaNova.nivel === 'fraca' && 'bg-destructive',
                    forcaNova.nivel === 'media' && 'bg-amber-500',
                    forcaNova.nivel === 'forte' && 'bg-emerald-600',
                  )}
                  style={{ width: `${Math.min(100, (forcaNova.pontos / 6) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {forcaNova.nivel === 'fraca'
                  ? 'Use pelo menos 8 caracteres e combine maiúsculas, minúsculas, números e símbolos.'
                  : forcaNova.nivel === 'media'
                    ? 'Bom começo. Adicione mais variedade para ficar mais forte.'
                    : 'Excelente — senha robusta.'}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <PasswordComVisibilidade
              id="cpa-conf"
              label="Confirmar nova senha"
              value={confirmarSenha}
              onChange={setConfirmarSenha}
              autoComplete="new-password"
              disabled={busy}
              mostrar={mostrarConfirmar}
              onAlternarMostrar={() => setMostrarConfirmar(v => !v)}
              invalid={confirmacaoAposBlur === 'mismatch'}
              onBlur={aplicarVerificacaoConfirmacao}
            />
            {confirmacaoAposBlur === 'mismatch' && (
              <p className="text-xs font-medium text-destructive" role="status">
                As senhas não coincidem.
              </p>
            )}
            {confirmacaoAposBlur === 'match' && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-500" role="status">
                As senhas coincidem.
              </p>
            )}
            {confirmacaoAposBlur === 'vazio' && (
              <p className="text-xs font-medium text-muted-foreground" role="status">
                Preencha a confirmação da nova senha.
              </p>
            )}
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={busy || confirmacaoAposBlur === 'mismatch'}
            onClick={() => void handlePasswordStep()}
          >
            {busy ? 'A validar…' : 'Continuar'}
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Novo PIN</Label>
            <PontoPinOtpFields value={pin} onChange={setPin} disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label>Confirmar PIN</Label>
            <PontoPinOtpFields value={pinConf} onChange={setPinConf} disabled={busy} />
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:justify-between">
            <Button
              type="button"
              variant="outline"
              className="w-full md:w-auto"
              disabled={busy}
              onClick={() => {
                setStep(1);
                setPin('');
                setPinConf('');
              }}
            >
              Voltar
            </Button>
            <Button type="button" className="w-full md:w-auto md:min-w-[10rem]" disabled={busy} onClick={() => void handlePinStep()}>
              {busy ? 'A guardar…' : 'Concluir'}
            </Button>
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      {/* Mobile — mesmo invólucro que o desbloqueio por PIN (navy + cartão branco) */}
      <div
        className="fixed inset-0 z-[200] h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none md:hidden"
        role="dialog"
        aria-modal
        aria-labelledby="primeiro-acesso-titulo"
      >
        <div className="relative flex h-full max-h-full min-h-0 flex-col bg-[hsl(var(--navy))]">
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
            <p className="text-transparent">SANEP</p>
            <p className="text-transparent">SANEP</p>
            <div className="flex flex-col items-center text-center">
              <img
                src="/logo-white.png"
                alt="GRUPO SANEP"
                className="mb-2 h-10 w-auto max-w-[200px] object-contain"
                width={200}
                height={40}
              />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Passo {step} de 2</p>
            </div>
          </div>

          <div className="relative z-[1] -mt-8 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[1.85rem] bg-background shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-5">
              <div className="flex shrink-0 justify-center">
                <Avatar className="h-14 w-14 ring-2 ring-border/40">
                  {avatarPhotoUrl ? (
                    <AvatarImage src={avatarPhotoUrl} alt="" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-base font-semibold">{avatarFallback}</AvatarFallback>
                </Avatar>
              </div>
              <h1 id="primeiro-acesso-titulo" className="mt-3 text-center text-xl font-bold tracking-tight text-foreground">
                Olá, {greeting}
              </h1>
              <p className="mt-1 text-center text-sm font-semibold text-foreground">{tituloPasso}</p>
              <p className="mt-2 text-center text-sm text-muted-foreground">{descricaoPasso}</p>
              <div className="mt-5 space-y-4 pb-2">{formulario}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop — cartão modal */}
      <div
        className="fixed inset-0 z-[200] hidden items-center justify-center bg-background/80 backdrop-blur-sm md:flex md:p-4"
        role="dialog"
        aria-modal
        aria-labelledby="primeiro-acesso-titulo-desktop"
      >
        <Card className="max-h-[90vh] w-full max-w-md overflow-y-auto">
          <CardHeader className="space-y-1 border-b bg-muted/30 pb-4">
            <div className="flex items-center gap-2 text-primary">
              {step === 1 ? <KeyRound className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Passo {step} de 2
              </span>
            </div>
            <CardTitle id="primeiro-acesso-titulo-desktop" className="text-xl">
              {tituloPasso}
            </CardTitle>
            <CardDescription>{descricaoPasso}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">{formulario}</CardContent>
        </Card>
      </div>
    </>
  );
}
