import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, AlertCircle, Eye, EyeOff, Mail } from 'lucide-react';
import { toast } from 'sonner';

const REMEMBER_KEY = 'sanep_login_remember_username';

export default function Login() {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated, isAuthReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && isAuthenticated) navigate('/dashboard');
  }, [isAuthReady, isAuthenticated, navigate]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !senha) {
      setError('Preencha todos os campos.');
      return;
    }
    const success = await login(username, senha);
    if (success) {
      try {
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, username.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }
      navigate('/dashboard');
    } else {
      setError('Credenciais inválidas. Verifique o nome de utilizador e a senha.');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-lighter))] lg:bg-background">
        <div className="text-sm text-white/80 lg:text-muted-foreground">A carregar…</div>
      </div>
    );
  }

  const formFields = (
    <>
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="username" className="sr-only">
          Nome de utilizador
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary"
            aria-hidden
          />
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="Nome de utilizador ou email"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="h-12 rounded-full border-border/80 bg-background pl-12 pr-4 text-base shadow-sm placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="senha" className="sr-only">
          Senha
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary"
            aria-hidden
          />
          <Input
            id="senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            className="h-12 rounded-full border-border/80 bg-background pl-12 pr-12 text-base shadow-sm placeholder:text-muted-foreground/70"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            onClick={() => setMostrarSenha(v => !v)}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={v => setRememberMe(v === true)}
            className="border-primary/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
          />
          <span className="font-medium text-primary">Lembrar-me</span>
        </label>
        <button
          type="button"
          className="text-sm font-medium text-primary transition hover:text-primary/90"
          onClick={() =>
            toast.message('Recuperação de senha', {
              description: 'Contacte o administrador do sistema ou a equipa de TI.',
            })
          }
        >
          Esqueceu a senha?
        </button>
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
      >
        Entrar
      </Button>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Mobile — referência: fundo navy, cartão branco com cantos muito redondos */}
      <div className="relative flex min-h-[100dvh] flex-col lg:hidden">
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
          <p className="text-transparent">Entrar</p>
          <p className="text-transparent">Entrar</p>
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo-white.png"
              alt="GRUPO SANEP"
              className="mb-5 h-12 w-auto max-w-[220px] object-contain"
              width={220}
              height={48}
            />

            {/* <h1 className="max-w-[280px] text-3xl font-bold leading-tight tracking-tight text-white">
              Entre e continue a gerir o seu trabalho
            </h1> */}
            {/* <p className="mt-3 max-w-[300px] text-sm leading-relaxed text-white/65">
              Inicie sessão na intranet GRUPO SANEP para aceder a todos os módulos da sua organização.
            </p> */}
          </div>
        </div>

        <div className="relative z-[1] -mt-10 flex flex-1 flex-col rounded-t-[1.85rem] bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
          <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-md flex-col gap-4">
            {formFields}
          </form>
        </div>
      </div>

      {/* Desktop — layout existente */}
      <div className="hidden min-h-screen lg:flex bg-background">
        <div className="hidden lg:flex lg:w-1/2 bg-sidebar items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--sidebar-accent)/0.15),transparent)]" />
          <div className="relative z-10 text-center px-12">
            <h1 className="text-4xl font-semibold text-sidebar-primary tracking-tight mb-3">GRUPO SANEP</h1>
            <div className="w-16 h-px bg-sidebar-foreground/20 mx-auto mb-5" />
            <p className="text-sidebar-foreground/70 text-sm">Sistema de Gestão Empresarial</p>
            <p className="text-sidebar-foreground/50 text-xs mt-1">Intranet Corporativa</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-[380px] space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Entrar</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Introduza as suas credenciais de acesso</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 text-destructive text-sm border border-destructive/20">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="username-desktop" className="text-xs font-medium text-muted-foreground">
                  Nome de utilizador
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username-desktop"
                    type="text"
                    autoComplete="username"
                    placeholder="ex.: naym"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="pl-10 h-10 rounded-lg border-border/80 bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="senha-desktop" className="text-xs font-medium text-muted-foreground">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="senha-desktop"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    className="pl-10 pr-10 h-10 rounded-lg border-border/80 bg-background"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    onClick={() => setMostrarSenha(v => !v)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={rememberMe} onCheckedChange={v => setRememberMe(v === true)} />
                  Lembrar-me
                </label>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() =>
                    toast.message('Recuperação de senha', {
                      description: 'Contacte o administrador do sistema ou a equipa de TI.',
                    })
                  }
                >
                  Esqueceu a senha?
                </button>
              </div>

              <Button type="submit" className="w-full h-10 rounded-lg font-medium">
                Entrar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
