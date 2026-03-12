import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Usuario, Perfil } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const PERFIS: Perfil[] = ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico', 'Colaborador'];

export const MODULOS_DISPONIVEIS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard e Notificações' },
  { id: 'capital-humano', label: 'Capital Humano' },
  { id: 'financas', label: 'Finanças' },
  { id: 'contabilidade', label: 'Contabilidade' },
  { id: 'secretaria', label: 'Secretaria Geral' },
  { id: 'juridico', label: 'Jurídico' },
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

export default function UtilizadoresPage() {
  const { user: currentUser, usuarios, setUsuarios, createUserInSupabase } = useAuth();
  const { empresas, colaboradores } = useData();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<UsuarioFormState>({
    nome: '',
    email: '',
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
  const filtered = usuariosFromDb.filter(
    u =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.perfil.toLowerCase().includes(search.toLowerCase())
  );
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const openCreate = () => {
    setEditing(null);
    setForm({
      nome: '',
      email: '',
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
    setDialogOpen(true);
  };

  const openEdit = (u: Usuario) => {
    setEditing(u);
    setForm({
      nome: u.nome,
      email: u.email,
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
    if (!editing && !form.senha.trim()) return;
    const avatar = form.avatar.trim() || avatarFromNome(form.nome);
    const senha = editing && !form.senha.trim() ? editing.senha : form.senha;
    /** Colaborador deve ter sempre portal-colaborador nos módulos para manter acesso ao portal */
    const modulos =
      form.perfil === 'Colaborador' && Array.isArray(form.modulos) && form.modulos.length > 0
        ? [...new Set(['portal-colaborador', ...form.modulos])]
        : form.modulos;
    const payload = { ...form, avatar, senha, modulos };

    if (editing) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              nome: form.nome.trim(),
              perfil: form.perfil,
              cargo: (form.cargo ?? '').trim(),
              departamento: (form.departamento ?? '').trim(),
              avatar,
              permissoes: form.permissoes ?? [],
              modulos: modulos ?? null,
              empresa_id: form.empresaId ?? null,
              colaborador_id: form.colaboradorId ?? null,
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
        });
        setDialogOpen(false);
        setEditing(null);
        toast.success('Utilizador criado. Pode fazer login com o email e a password definidos.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao criar utilizador');
      }
      return;
    }

    const newId = Math.max(0, ...usuarios.map(u => u.id)) + 1;
    setUsuarios(prev => [...prev, { id: newId, ...payload }]);
    setDialogOpen(false);
    setEditing(null);
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
          placeholder="Pesquisar nome, email ou perfil..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Utilizador</th>
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

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum utilizador encontrado.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar utilizador' : 'Novo utilizador'}</DialogTitle>
            <DialogDescription>
              Dados do utilizador e módulos a que tem acesso. Se não seleccionar módulos, o acesso segue o perfil.
            </DialogDescription>
          </DialogHeader>
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
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@sanep.ao"
                disabled={!!editing}
              />
              {editing && <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>}
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
              <Select
                value={form.colaboradorId != null ? String(form.colaboradorId) : 'nenhum'}
                onValueChange={v => setForm(f => ({ ...f, colaboradorId: v === 'nenhum' ? null : Number(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="Nenhum — utilizador sem ficha de colaborador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome} — {c.cargo} ({c.emailCorporativo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se associar a um colaborador, este utilizador verá no Portal os seus recibos, férias, faltas e declarações.
              </p>
            </div>
            <div className="space-y-2 border-t border-border/80 pt-4">
              <Label>Acesso a módulos</Label>
              <p className="text-xs text-muted-foreground">
                Seleccione os módulos a que este utilizador pode aceder. Se nenhum for seleccionado, aplica-se o acesso padrão do perfil. Admin ignora esta lista.
                {form.perfil === 'Colaborador' && (
                  <span className="block mt-1 text-primary/90">Para Colaborador: o Portal fica sempre activo; pode ainda atribuir um ou mais módulos de trabalho (ex.: Finanças, Capital Humano).</span>
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
                    src={form.assinaturaImagemUrl}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={save}
              disabled={!form.nome.trim() || !form.email.trim() || (!editing && !form.senha.trim())}
            >
              {editing ? 'Guardar' : 'Criar utilizador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
