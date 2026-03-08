import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type LoginEmpresaId } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Mail, AlertCircle, Building2 } from 'lucide-react';

export default function Login() {
  const { empresas } = useData();
  const empresasAtivas = empresas.filter(e => e.activo);
  const [empresaId, setEmpresaId] = useState<LoginEmpresaId>('grupo');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !senha) { setError('Preencha todos os campos.'); return; }
    const success = login(empresaId, email, senha);
    if (success) navigate('/dashboard');
    else setError('Credenciais inválidas. Verifique a empresa, email e senha.');
  };

  const fillDemo = (eid: LoginEmpresaId, em: string, pw: string) => {
    setEmpresaId(eid);
    setEmail(em);
    setSenha(pw);
    setError('');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left - Brand Panel (minimalista) */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--sidebar-accent)/0.15),transparent)]" />
        <div className="relative z-10 text-center px-12">
          <h1 className="text-4xl font-semibold text-sidebar-primary tracking-tight mb-3">GRUPO SANEP</h1>
          <div className="w-16 h-px bg-sidebar-foreground/20 mx-auto mb-5" />
          <p className="text-sidebar-foreground/70 text-sm">Sistema de Gestão Empresarial</p>
          <p className="text-sidebar-foreground/50 text-xs mt-1">Intranet Corporativa</p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px] space-y-8">
          <div className="lg:hidden text-center mb-6">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">GRUPO SANEP</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Sistema de Gestão</p>
          </div>

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
              <Label htmlFor="empresa" className="text-xs font-medium text-muted-foreground">Empresa / contexto</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  id="empresa"
                  value={empresaId === 'grupo' ? 'grupo' : String(empresaId)}
                  onChange={e => setEmpresaId(e.target.value === 'grupo' ? 'grupo' : Number(e.target.value))}
                  className="flex h-10 w-full rounded-lg border border-border/80 bg-background pl-10 pr-4 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="grupo">Grupo (Admin / PCA)</option>
                  {empresasAtivas.map(e => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email corporativo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@sanep.ao"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10 h-10 rounded-lg border-border/80 bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha" className="text-xs font-medium text-muted-foreground">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="pl-10 h-10 rounded-lg border-border/80 bg-background"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-10 rounded-lg font-medium">
              Entrar
            </Button>
          </form>

          <div className="border-t border-border/80 pt-5">
            <p className="text-xs text-muted-foreground text-center mb-2">Contas de demonstração</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { empresaId: 'grupo' as const, email: 'antonio@sanep.ao', senha: 'admin123', label: 'Admin (Grupo)' },
                { empresaId: 'grupo' as const, email: 'pca@sanep.ao', senha: 'pca123', label: 'PCA (Grupo)' },
                { empresaId: 1 as const, email: 'maria@sanep.ao', senha: 'rh123', label: 'RH (Holding)' },
                { empresaId: 1 as const, email: 'joao@sanep.ao', senha: 'fin123', label: 'Finanças (Holding)' },
                { empresaId: 1 as const, email: 'isabel@sanep.ao', senha: 'jur123', label: 'Jurídico (Holding)' },
                { empresaId: 2 as const, email: 'ines@sanep.pt', senha: 'pt123', label: 'Finanças (Crediangolar)' },
              ].map(c => (
                <button
                  key={`${c.empresaId}-${c.email}`}
                  type="button"
                  className="p-2.5 rounded-lg border border-border/80 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => fillDemo(c.empresaId, c.email, c.senha)}
                >
                  <span className="font-medium text-foreground">{c.label}</span>
                  <span className="block text-muted-foreground truncate mt-0.5">{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
