import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Usuario, Perfil } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { normalizePublicMediaUrl } from '@/utils/publicMediaUrl';
import { LockOpen, Search, Plus, Pencil, Trash2, KeyRound, Sparkles, Copy } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ChevronsUpDown } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const PERFIS: Perfil[] = ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico', 'Colaborador'];

export const MODULOS_DISPONIVEIS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard e Notificações' },
  { id: 'capital-humano', label: 'Capital Humano' },
  { id: 'financas', label: 'Finanças' },
  { id: 'contabilidade', label: 'Contabilidade' },
  { id: 'secretaria', label: 'Secretaria Geral' },
  { id: 'gestao-documentos', label: 'Gestão de Documentos' },
  { id: 'juridico', label: 'Jurídico' },
  { id: 'controlo-interno', label: 'Controlo Interno' },
  { id: 'conselho-administracao', label: 'Conselho de Administração' },
  { id: 'portal-colaborador', label: 'Portal Colaborador' },
  { id: 'configuracoes', label: 'Configurações' },
];

function avatarFromNome(nome: string): string {
  return nome
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type UsuarioFormState = Omit<Usuario, 'id'> & { empresaId?: number | null };

const LIST_PATH = '/configuracoes/utilizadores';
const NOVO_PATH = '/configuracoes/utilizadores/novo';

const CHARSET_TEMP_PASSWORD =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=';

function gerarPalavraPasseTemporaria(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARSET_TEMP_PASSWORD[bytes[i]! % CHARSET_TEMP_PASSWORD.length];
  }
  return out;
}

export default function UtilizadoresPage() {
  const navigate = useNavigate();
  const { user: currentUser, usuarios, setUsuarios, createUserInSupabase, resetUserPasswordAsAdmin } = useAuth();
  const { empresas, colaboradoresTodos } = useData();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [colaboradorSelectOpen, setColaboradorSelectOpen] = useState(false);
  const [lockMeta, setLockMeta] = useState<Record<number, { locked: boolean; attempts: number }>>({});
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<Usuario | null>(null);
  const [resetPwdTemp, setResetPwdTemp] = useState('');
  const [resetPwdTemp2, setResetPwdTemp2] = useState('');
  const [resetPwdBusy, setResetPwdBusy] = useState(false);
  const [resetPwdSuccessValue, setResetPwdSuccessValue] = useState<string | null>(null);
  const [form, setForm] = useState<UsuarioFormState>({
    nome: '',
    email: '',
    username: '',
    senha: '',
    perfil: 'Colaborador',
    cargo: '',
    departamento: '',
    avatar: '',
    permissoes: [],
    modulos: [],
    empresaId: null,
    colaboradorId: null,
    assinaturaLinha: '',
    assinaturaCargo: '',
    assinaturaImagemUrl: '',
  });

  // Apenas utilizadores da base de dados (Supabase). Sem Supabase a página fica vazia (sem mock/seed).
  const usuariosFromDb = isSupabaseConfigured() ? usuarios : [];

  const loadLockMeta = useCallback(async () => {
    if (currentUser?.perfil !== 'Admin') return;
    if (!isSupabaseConfigured() || !supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, login_locked_at, login_failed_attempts')
      .order('id', { ascending: true });
    if (error || !data) return;
    const next: Record<number, { locked: boolean; attempts: number }> = {};
    for (const row of data as any[]) {
      const id = Number(row.id);
      next[id] = {
        locked: Boolean(row.login_locked_at),
        attempts: Number(row.login_failed_attempts ?? 0),
      };
    }
    setLockMeta(next);
  }, [currentUser?.perfil]);

  useEffect(() => {
    void loadLockMeta();
  }, [loadLockMeta]);

  const unlockLogin = useCallback(
    async (u: Usuario) => {
      if (!isSupabaseConfigured() || !supabase) return;
      try {
        const { error } = await supabase.rpc('admin_unlock_login', { p_profile_id: u.id });
        if (error) throw error;
        toast.success('Conta desbloqueada.');
        await loadLockMeta();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Não foi possível desbloquear a conta.');
      }
    },
    [loadLockMeta],
  );

  const openAdminResetPasswordDialog = (u: Usuario) => {
    setResetPwdTarget(u);
    setResetPwdTemp('');
    setResetPwdTemp2('');
    setResetPwdSuccessValue(null);
    setResetPwdOpen(true);
  };

  const gerarResetPwdAleatoria = () => {
    const pwd = gerarPalavraPasseTemporaria(16);
    setResetPwdTemp(pwd);
    setResetPwdTemp2(pwd);
    toast.success('Palavra-passe gerada. Anote-a para comunicar ao utilizador.');
  };

  const submitAdminResetPassword = async () => {
    if (!resetPwdTarget) return;
    const a = resetPwdTemp.trim();
    const b = resetPwdTemp2.trim();
    if (a.length < 8) {
      toast.error('A palavra-passe temporária deve ter pelo menos 8 caracteres.');
      return;
    }
    if (a !== b) {
      toast.error('As duas palavras-passe não coincidem.');
      return;
    }
    setResetPwdBusy(true);
    try {
      await resetUserPasswordAsAdmin({ target_profile_id: resetPwdTarget.id, new_password: a });
      setResetPwdSuccessValue(a);
      toast.success('Palavra-passe reposta. Copie a palavra-passe abaixo para enviar ao utilizador.');
      await loadLockMeta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao repor a palavra-passe.');
    } finally {
      setResetPwdBusy(false);
    }
  };

  const closeResetPwdDialog = () => {
    setResetPwdOpen(false);
    setResetPwdTarget(null);
    setResetPwdTemp('');
    setResetPwdTemp2('');
    setResetPwdSuccessValue(null);
  };

  const copiarSenhaReposta = async () => {
    const v = resetPwdSuccessValue?.trim();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      toast.success('Copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar. Seleccione o texto e copie manualmente.');
    }
  };

  const filtered = usuariosFromDb.filter(
    u =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
      u.perfil.toLowerCase().includes(search.toLowerCase())
  );
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('nome');
  const mobileComparators = useMemo(
    () => ({
      nome: (a: Usuario, b: Usuario) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }),
      login: (a: Usuario, b: Usuario) =>
        (a.username ?? a.email.split('@')[0] ?? '').localeCompare(b.username ?? b.email.split('@')[0] ?? '', 'pt', {
          sensitivity: 'base',
        }),
      email: (a: Usuario, b: Usuario) => a.email.localeCompare(b.email, 'pt', { sensitivity: 'base' }),
      perfil: (a: Usuario, b: Usuario) => a.perfil.localeCompare(b.perfil, 'pt', { sensitivity: 'base' }),
    }),
    [],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const prepareCreate = useCallback(() => {
    setEditing(null);
    setForm({
      nome: '',
      email: '',
      username: '',
      senha: '',
      perfil: 'Colaborador',
      cargo: '',
      departamento: '',
      avatar: '',
      permissoes: [],
      modulos: [],
      empresaId: null,
      colaboradorId: null,
      assinaturaLinha: '',
      assinaturaCargo: '',
      assinaturaImagemUrl: '',
    });
  }, []);

  const resetModal = useCallback(() => {
    setEditing(null);
    setForm({
      nome: '',
      email: '',
      username: '',
      senha: '',
      perfil: 'Colaborador',
      cargo: '',
      departamento: '',
      avatar: '',
      permissoes: [],
      modulos: [],
      empresaId: null,
      colaboradorId: null,
      assinaturaLinha: '',
      assinaturaCargo: '',
      assinaturaImagemUrl: '',
    });
  }, []);

  const {
    isNovoRoute,
    showMobileCreate,
    openCreateNavigateOrDialog,
    closeMobileCreate,
    onDialogOpenChange,
    endMobileCreateFlow,
  } = useMobileCreateRoute({
    listPath: LIST_PATH,
    novoPath: NOVO_PATH,
    dialogOpen,
    setDialogOpen,
    prepareCreate,
    resetModal,
  });

  const openCreate = () => openCreateNavigateOrDialog();

  const openEdit = (u: Usuario) => {
    setEditing(u);
    setForm({
      nome: u.nome,
      email: u.email,
      username: u.username ?? u.email.split('@')[0] ?? '',
      senha: u.senha,
      perfil: u.perfil,
      cargo: u.cargo,
      departamento: u.departamento,
      avatar: u.avatar,
      permissoes: u.permissoes ?? [],
      modulos: u.modulos ?? [],
      empresaId: u.empresaId ?? null,
      colaboradorId: u.colaboradorId ?? null,
      assinaturaLinha: u.assinaturaLinha ?? '',
      assinaturaCargo: u.assinaturaCargo ?? '',
      assinaturaImagemUrl: u.assinaturaImagemUrl ?? '',
    });
    setDialogOpen(true);
  };

  const toggleModulo = (id: string) => {
    setForm(f => ({
      ...f,
      modulos: f.modulos?.includes(id)
        ? (f.modulos ?? []).filter(m => m !== id)
        : [...(f.modulos ?? []), id],
    }));
  };

  const save = async () => {
    if (!form.nome.trim() || !form.email.trim()) return;
    if (isSupabaseConfigured() && !form.username?.trim()) return;
    if (!editing && !form.senha.trim()) return;
    const avatar = form.avatar.trim() || avatarFromNome(form.nome);
    const senha = editing && !form.senha.trim() ? editing.senha : form.senha;
    /** Colaborador deve ter sempre portal-colaborador nos módulos para manter acesso ao portal */
    const modulos =
      form.perfil === 'Colaborador' && Array.isArray(form.modulos) && form.modulos.length > 0
        ? [...new Set(['portal-colaborador', ...form.modulos])]
        : form.modulos;
    const colabLinked = form.colaboradorId
      ? colaboradoresTodos.find(c => c.id === form.colaboradorId)
      : undefined;
    const numeroMecPerfil =
      colabLinked?.numeroMec?.trim() ? colabLinked.numeroMec.trim() : null;

    const payload = { ...form, avatar, senha, modulos, numeroMec: numeroMecPerfil ?? undefined };

    if (editing) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              nome: form.nome.trim(),
              username: form.username.trim().toLowerCase().replace(/\s+/g, ''),
              perfil: form.perfil,
              cargo: (form.cargo ?? '').trim(),
              departamento: (form.departamento ?? '').trim(),
              avatar,
              permissoes: form.permissoes ?? [],
              modulos: modulos ?? null,
              empresa_id: form.empresaId ?? null,
              colaborador_id: form.colaboradorId ?? null,
              numero_mec: numeroMecPerfil,
              assinatura_linha: (form.assinaturaLinha ?? '').trim() || null,
              assinatura_cargo: (form.assinaturaCargo ?? '').trim() || null,
              assinatura_imagem_url: (form.assinaturaImagemUrl ?? '').trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editing.id);
          if (error) throw new Error(error.message);
          setUsuarios(prev =>
            prev.map(u => (u.id === editing.id ? { ...editing, ...payload } : u))
          );
          setDialogOpen(false);
          setEditing(null);
          toast.success('Utilizador actualizado.');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Erro ao actualizar utilizador');
        }
        return;
      }
      setUsuarios(prev =>
        prev.map(u => (u.id === editing.id ? { ...editing, ...payload } : u))
      );
      setDialogOpen(false);
      setEditing(null);
      return;
    }

    if (isSupabaseConfigured() && createUserInSupabase) {
      try {
        await createUserInSupabase({
          email: form.email.trim(),
          username: form.username.trim().toLowerCase().replace(/\s+/g, ''),
          password: senha,
          nome: form.nome.trim(),
          perfil: form.perfil,
          cargo: form.cargo?.trim() ?? '',
          departamento: form.departamento?.trim() ?? '',
          avatar,
          permissoes: form.permissoes ?? [],
          modulos: modulos ?? null,
          empresa_id: form.empresaId ?? null,
          colaborador_id: form.colaboradorId ?? null,
          numero_mec: numeroMecPerfil,
        });
        setDialogOpen(false);
        setEditing(null);
        if (isNovoRoute) {
          endMobileCreateFlow();
          navigate(LIST_PATH, { replace: true });
        }
        toast.success('Utilizador criado. Pode fazer login com o nome de utilizador e a password definidos.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao criar utilizador');
      }
      return;
    }

    const newId = Math.max(0, ...usuarios.map(u => u.id)) + 1;
    setUsuarios(prev => [...prev, { id: newId, ...payload }]);
    setDialogOpen(false);
    setEditing(null);
    if (isNovoRoute) {
      endMobileCreateFlow();
      navigate(LIST_PATH, { replace: true });
    }
  };

  const remove = async (u: Usuario) => {
    if (u.perfil === 'Admin' && usuariosFromDb.filter(x => x.perfil === 'Admin').length <= 1) return;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', u.id);
        if (error) throw new Error(error.message);
        setUsuarios(prev => prev.filter(x => x.id !== u.id));
        toast.success('Utilizador removido.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao remover utilizador');
      }
      return;
    }
    setUsuarios(prev => prev.filter(x => x.id !== u.id));
  };

  const isOnlyAdmin = (u: Usuario) => u.perfil === 'Admin' && usuariosFromDb.filter(x => x.perfil === 'Admin').length <= 1;

  const handleAssinaturaUpload = async (file: File) => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Upload de assinatura requer Supabase configurado.');
      return;
    }
    try {
      const ext = file.name.split('.').pop() || 'png';
      const baseId = editing?.id ?? Date.now();
      const path = `user-${baseId}/assinatura-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('assinaturas').upload(path, file, { upsert: true });
      if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar assinatura');
      const { data: pub } = supabase.storage.from('assinaturas').getPublicUrl(data.path);
      setForm(f => ({ ...f, assinaturaImagemUrl: pub.publicUrl }));
      toast.success('Assinatura digital carregada com sucesso.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar a assinatura.');
    }
  };

  if (currentUser?.perfil !== 'Admin') {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Utilizadores</h1>
        <p className="text-muted-foreground">Acesso reservado ao Administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Gestão de Utilizadores</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo utilizador
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Crie e edite utilizadores. Defina os módulos a que cada um tem acesso. Admin tem sempre acesso a todos os módulos.
      </p>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar nome, utilizador, email ou perfil..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Login</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Perfil</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cargo / Dept.</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acesso módulos</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(u => (
              <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {u.avatar || avatarFromNome(u.nome)}
                    </span>
                    <span className="font-medium">{u.nome}</span>
                  </span>
                </td>
                <td className="py-3 px-5 text-muted-foreground font-mono text-xs">
                  {u.username ?? u.email.split('@')[0] ?? '—'}
                </td>
                <td className="py-3 px-5 text-muted-foreground">{u.email}</td>
                <td className="py-3 px-5">{u.perfil}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-40 truncate">{u.cargo} — {u.departamento}</td>
                <td className="py-3 px-5 text-muted-foreground">
                  {u.perfil === 'Admin'
                    ? 'Todos'
                    : Array.isArray(u.modulos) && u.modulos.length > 0
                      ? `${u.modulos.length} módulo(s)`
                      : 'Por perfil'}
                </td>
                <td className="py-3 px-5 text-right">
                  {lockMeta[u.id]?.locked ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-700"
                      onClick={() => void unlockLogin(u)}
                      title="Desbloquear login"
                      aria-label="Desbloquear login"
                    >
                      <LockOpen className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {currentUser?.perfil === 'Admin' && isSupabaseConfigured() ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openAdminResetPasswordDialog(u)}
                      title="Repor palavra-passe (obriga nova ao login)"
                      aria-label="Repor palavra-passe"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remove(u)}
                    disabled={isOnlyAdmin(u)}
                    title={isOnlyAdmin(u) ? 'Não pode remover o único Admin' : 'Remover'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={u => u.id}
          sortBar={{
            options: [
              { key: 'nome', label: 'Nome' },
              { key: 'login', label: 'Login' },
              { key: 'email', label: 'Email' },
              { key: 'perfil', label: 'Perfil' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={u => ({
            avatar: (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {u.avatar || avatarFromNome(u.nome)}
              </span>
            ),
            title: u.nome,
            trailing: <span className="text-xs text-muted-foreground">{u.perfil}</span>,
          })}
          renderDetails={u => [
            { label: 'Login', value: <span className="font-mono text-xs">{u.username ?? u.email.split('@')[0] ?? '—'}</span> },
            { label: 'Email', value: u.email },
            { label: 'Perfil', value: u.perfil },
            ...(lockMeta[u.id]?.locked
              ? [
                  {
                    label: 'Login',
                    value: (
                      <span className="text-xs font-medium text-amber-700">
                        Bloqueado (3 tentativas). Só Admin desbloqueia.
                      </span>
                    ),
                  },
                ]
              : []),
            { label: 'Cargo / Dept.', value: `${u.cargo} — ${u.departamento}` },
            {
              label: 'Acesso módulos',
              value:
                u.perfil === 'Admin'
                  ? 'Todos'
                  : Array.isArray(u.modulos) && u.modulos.length > 0
                    ? `${u.modulos.length} módulo(s)`
                    : 'Por perfil',
            },
          ]}
          renderActions={u => (
            <>
              {lockMeta[u.id]?.locked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => void unlockLogin(u)}
                  aria-label="Desbloquear login"
                  title="Desbloquear login"
                >
                  <LockOpen className="h-4 w-4" />
                </Button>
              ) : null}
              {currentUser?.perfil === 'Admin' && isSupabaseConfigured() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => openAdminResetPasswordDialog(u)}
                  aria-label="Repor palavra-passe"
                  title="Repor palavra-passe"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openEdit(u)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(u)}
                disabled={isOnlyAdmin(u)}
                aria-label={isOnlyAdmin(u) ? 'Não pode remover o único Admin' : 'Remover'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum utilizador encontrado.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={closeMobileCreate}
          moduleKicker="Configurações"
          screenTitle={editing ? 'Editar utilizador' : 'Novo utilizador'}
          desktopContentClassName="max-w-lg max-h-[90vh] overflow-y-auto"
          desktopHeader={mobileCreateDesktopHeader(
            editing ? 'Editar utilizador' : 'Novo utilizador',
            'Dados do utilizador. Para perfis de direcção e áreas, os módulos marcados somam-se ao acesso do perfil. Para Colaborador, a lista de módulos é a referência principal (junto com o portal).',
          )}
          formBody={
            <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value, avatar: f.avatar || avatarFromNome(e.target.value) }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Iniciais (avatar)</Label>
                <Input
                  value={form.avatar}
                  onChange={e => setForm(f => ({ ...f, avatar: e.target.value }))}
                  placeholder="Ex: AF"
                  maxLength={3}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => {
                  const v = e.target.value;
                  setForm(f => {
                    const next = { ...f, email: v };
                    if (!editing && !f.username?.trim()) {
                      const local = v.split('@')[0]?.toLowerCase().replace(/\s+/g, '') ?? '';
                      if (local) next.username = local;
                    }
                    return next;
                  });
                }}
                placeholder="email@sanep.ao"
                disabled={!!editing}
              />
              {editing && <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>}
            </div>
            <div className="space-y-2">
              <Label>Nome de utilizador (login)</Label>
              <Input
                value={form.username ?? ''}
                onChange={e =>
                  setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))
                }
                placeholder="ex.: naym"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <p className="text-xs text-muted-foreground">
                Único no sistema. Ao criar, é sugerido a partir da parte local do email.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Palavra-passe</Label>
              <Input
                type="password"
                value={form.senha}
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                placeholder={editing ? 'Deixar em branco para manter' : 'Senha de acesso'}
              />
              {editing && <p className="text-xs text-muted-foreground">Deixe em branco para manter a senha actual.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={form.perfil} onValueChange={v => setForm(f => ({ ...f, perfil: v as Perfil }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERFIS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Cargo" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={form.empresaId != null ? String(form.empresaId) : 'grupo'}
                onValueChange={v =>
                  setForm(f => ({
                    ...f,
                    empresaId: v === 'grupo' ? null : Number(v),
                  }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Seleccione a empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grupo">Grupo (nível Grupo)</SelectItem>
                  {empresas.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Para Admin, PCA e Planeamento use normalmente «Grupo». Para utilizadores de empresa (ex.: RH, Finanças, Director),
                seleccione a empresa onde este colaborador fará parte.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} placeholder="Departamento" />
            </div>
            <div className="space-y-2">
              <Label>Associar a colaborador (opcional)</Label>
              <Popover open={colaboradorSelectOpen} onOpenChange={setColaboradorSelectOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {form.colaboradorId != null
                      ? `${colaboradoresTodos.find(c => c.id === form.colaboradorId)?.nome ?? 'Seleccionar colaborador'}`
                      : 'Nenhum — utilizador sem ficha de colaborador'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar colaborador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="nenhum"
                          onSelect={() => {
                            setForm(f => ({ ...f, colaboradorId: null }));
                            setColaboradorSelectOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', form.colaboradorId == null ? 'opacity-100' : 'opacity-0')} />
                          Nenhum
                        </CommandItem>
                        {colaboradoresTodos.map(c => (
                          <CommandItem
                            key={c.id}
                            value={c.nome}
                            onSelect={() => {
                              setForm(f => ({ ...f, colaboradorId: c.id }));
                              setColaboradorSelectOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', form.colaboradorId === c.id ? 'opacity-100' : 'opacity-0')} />
                            {c.nome} — {c.cargo} ({c.emailCorporativo})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Se associar a um colaborador, este utilizador verá no Portal os seus recibos, férias, faltas e declarações.
              </p>
            </div>
            <div className="space-y-2 border-t border-border/80 pt-4">
              <Label>Acesso a módulos</Label>
              <p className="text-xs text-muted-foreground">
                Seleccione os módulos a que este utilizador pode aceder. Se nenhum for seleccionado, aplica-se o acesso padrão do perfil. Admin ignora esta lista.
                {form.perfil === 'Colaborador' && (
                  <span className="block mt-1 text-primary/90">Para Colaborador: o Portal fica sempre activo; pode ainda atribuir um ou mais módulos de trabalho (ex.: Finanças, Capital Humano, Gestão de Documentos).</span>
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {MODULOS_DISPONIVEIS.map(m => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.modulos?.includes(m.id) ?? false}
                      onCheckedChange={() => toggleModulo(m.id)}
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 border-t border-border/80 pt-4">
              <Label className="text-sm font-semibold">Assinatura digital (para documentos)</Label>
              <p className="text-xs text-muted-foreground">
                Estes dados serão usados nos documentos (ex.: despachos, declarações) quando este utilizador for o signatário.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Texto de assinatura</Label>
                <Input
                  value={form.assinaturaLinha ?? ''}
                  onChange={e => setForm(f => ({ ...f, assinaturaLinha: e.target.value }))}
                  placeholder="Ex.: Naym Mupoia"
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo na assinatura</Label>
                <Input
                  value={form.assinaturaCargo ?? ''}
                  onChange={e => setForm(f => ({ ...f, assinaturaCargo: e.target.value }))}
                  placeholder="Ex.: Director de IT"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Imagem de assinatura digital</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleAssinaturaUpload(file);
                }}
              />
              {!isSupabaseConfigured() && (
                <p className="text-xs text-muted-foreground">
                  Upload de assinatura disponível apenas quando o Supabase estiver configurado.
                </p>
              )}
              {form.assinaturaImagemUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={normalizePublicMediaUrl(form.assinaturaImagemUrl) ?? form.assinaturaImagemUrl}
                    alt="Pré-visualização da assinatura"
                    className="h-12 border border-border/80 rounded bg-muted object-contain"
                  />
                  <p className="text-xs text-muted-foreground break-all max-w-xs">
                    {form.assinaturaImagemUrl}
                  </p>
                </div>
              )}
            </div>
          </div>
          }
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => onDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void save()}
                disabled={
                  !form.nome.trim() ||
                  !form.email.trim() ||
                  (isSupabaseConfigured() && !form.username?.trim()) ||
                  (!editing && !form.senha.trim())
                }
              >
                {editing ? 'Guardar' : 'Criar utilizador'}
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={closeMobileCreate}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1 rounded-xl"
                disabled={
                  !form.nome.trim() ||
                  !form.email.trim() ||
                  (isSupabaseConfigured() && !form.username?.trim()) ||
                  (!editing && !form.senha.trim())
                }
                onClick={() => void save()}
              >
                {editing ? 'Guardar' : 'Criar utilizador'}
              </Button>
            </div>
          }
        />
      </Dialog>

      <Dialog
        open={resetPwdOpen}
        onOpenChange={v => {
          if (!v) closeResetPwdDialog();
        }}
      >
        <DialogContent className="max-w-md">
          {resetPwdSuccessValue != null && resetPwdTarget ? (
            <>
              <DialogHeader>
                <DialogTitle>Palavra-passe reposta</DialogTitle>
                <DialogDescription>
                  A palavra-passe de <span className="font-medium text-foreground">{resetPwdTarget.nome}</span> foi
                  actualizada. Copie o valor abaixo e envie-o ao utilizador de forma segura. No primeiro login, será
                  pedida uma nova palavra-passe.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label htmlFor="reset-pwd-copiado">Palavra-passe temporária</Label>
                <div className="flex gap-2">
                  <Input
                    id="reset-pwd-copiado"
                    readOnly
                    className="font-mono text-sm"
                    value={resetPwdSuccessValue}
                    onFocus={e => e.target.select()}
                  />
                  <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={() => void copiarSenhaReposta()}>
                    <Copy className="h-4 w-4" aria-hidden />
                    Copiar
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={closeResetPwdDialog}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Repor palavra-passe</DialogTitle>
                <DialogDescription>
                  {resetPwdTarget ? (
                    <>
                      Utilizador: <span className="font-medium text-foreground">{resetPwdTarget.nome}</span> (
                      {resetPwdTarget.email}). Defina uma palavra-passe temporária (mín. 8 caracteres). No próximo login, o
                      sistema pedirá uma nova palavra-passe forte antes de continuar.
                    </>
                  ) : null}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <Label htmlFor="reset-pwd-temp">Palavra-passe temporária</Label>
                    <Button
                      id="reset-pwd-gerar"
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={gerarResetPwdAleatoria}
                      disabled={resetPwdBusy}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      Gerar aleatoriamente
                    </Button>
                  </div>
                  <Input
                    id="reset-pwd-temp"
                    type="password"
                    autoComplete="new-password"
                    value={resetPwdTemp}
                    onChange={e => setResetPwdTemp(e.target.value)}
                    disabled={resetPwdBusy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-pwd-temp2">Confirmar palavra-passe temporária</Label>
                  <Input
                    id="reset-pwd-temp2"
                    type="password"
                    autoComplete="new-password"
                    value={resetPwdTemp2}
                    onChange={e => setResetPwdTemp2(e.target.value)}
                    disabled={resetPwdBusy}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeResetPwdDialog} disabled={resetPwdBusy}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void submitAdminResetPassword()} disabled={resetPwdBusy}>
                  {resetPwdBusy ? 'A repor…' : 'Repor palavra-passe'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
