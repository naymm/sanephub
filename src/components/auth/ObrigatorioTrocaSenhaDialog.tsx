import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  avaliarForcaSenha,
  labelForcaSenha,
  SENHA_MIN_CARACTERES,
} from '@/utils/passwordStrength';

/**
 * Após o Admin repor a palavra-passe, o utilizador deve definir uma nova antes de usar a intranet.
 */
export function ObrigatorioTrocaSenhaDialog() {
  const { user, refreshSessionUser } = useAuth();
  const open = Boolean(isSupabaseConfigured() && supabase && user?.obrigarTrocaSenha);

  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [mostrarNova, setMostrarNova] = useState(false);
  const [mostrarConf, setMostrarConf] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNova('');
    setConf('');
    setMostrarNova(false);
    setMostrarConf(false);
    setBusy(false);
  }, [open, user?.id]);

  const forca = useMemo(() => avaliarForcaSenha(nova), [nova]);

  const submeter = useCallback(async () => {
    if (!supabase || !user?.id) return;
    const n = nova.trim();
    const c = conf.trim();
    if (n.length < SENHA_MIN_CARACTERES) {
      toast.error(`A nova palavra-passe deve ter pelo menos ${SENHA_MIN_CARACTERES} caracteres.`);
      return;
    }
    if (forca.nivel === 'fraca') {
      toast.error(
        'A palavra-passe é demasiado fraca. Combine letras maiúsculas e minúsculas, números e símbolos.',
      );
      return;
    }
    if (n !== c) {
      toast.error('A confirmação não coincide com a nova palavra-passe.');
      return;
    }
    setBusy(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password: n });
      if (authErr) {
        toast.error(authErr.message || 'Não foi possível actualizar a palavra-passe.');
        return;
      }
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          obrigar_troca_senha: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (profErr) {
        toast.error(profErr.message || 'Palavra-passe actualizada, mas falhou ao actualizar o perfil. Contacte o suporte.');
        return;
      }
      toast.success('Palavra-passe actualizada.');
      await refreshSessionUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar.');
    } finally {
      setBusy(false);
    }
  }, [conf, forca.nivel, nova, refreshSessionUser, user?.id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100001] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="obrigar-troca-senha-titulo"
    >
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="h-5 w-5" aria-hidden />
            <CardTitle id="obrigar-troca-senha-titulo">Nova palavra-passe obrigatória</CardTitle>
          </div>
          <CardDescription>
            A sua palavra-passe foi reposta pela administração. Por segurança, defina uma nova palavra-passe forte antes de
            continuar a utilizar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-obrig">Nova palavra-passe</Label>
            <div className="relative">
              <Input
                id="nova-obrig"
                type={mostrarNova ? 'text' : 'password'}
                autoComplete="new-password"
                value={nova}
                onChange={e => setNova(e.target.value)}
                disabled={busy}
                className="pr-11"
              />
              <button
                type="button"
                className="absolute right-0.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setMostrarNova(v => !v)}
                disabled={busy}
                aria-label={mostrarNova ? 'Ocultar' : 'Mostrar'}
              >
                {mostrarNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {nova.length > 0 ? (
              <p className={cn('text-xs', forca.nivel === 'fraca' ? 'text-destructive' : 'text-muted-foreground')}>
                Força: {labelForcaSenha(forca.nivel)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="conf-obrig">Confirmar nova palavra-passe</Label>
            <div className="relative">
              <Input
                id="conf-obrig"
                type={mostrarConf ? 'text' : 'password'}
                autoComplete="new-password"
                value={conf}
                onChange={e => setConf(e.target.value)}
                disabled={busy}
                className="pr-11"
              />
              <button
                type="button"
                className="absolute right-0.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setMostrarConf(v => !v)}
                disabled={busy}
                aria-label={mostrarConf ? 'Ocultar' : 'Mostrar'}
              >
                {mostrarConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="button" className="w-full" onClick={() => void submeter()} disabled={busy}>
            {busy ? 'A guardar…' : 'Guardar nova palavra-passe'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
