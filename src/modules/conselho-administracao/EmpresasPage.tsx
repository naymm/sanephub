import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Empresa } from '@/types';
import { MODULOS_ATIVOS_PADRAO_GRUPO } from '@/utils/empresaModulos';
import { Building2, Users, FileText, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const MODULOS_DISPONIVEIS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'capital-humano', label: 'Capital Humano' },
  { id: 'financas', label: 'Finanças' },
  { id: 'contabilidade', label: 'Contabilidade' },
  { id: 'planeamento', label: 'Planeamento' },
  { id: 'secretaria', label: 'Secretaria Geral' },
  { id: 'gestao-documentos', label: 'Gestão de Documentos' },
  { id: 'juridico', label: 'Jurídico' },
  { id: 'conselho-administracao', label: 'Conselho de Administração' },
  { id: 'portal-colaborador', label: 'Portal Colaborador' },
  { id: 'comunicacao-interna', label: 'Comunicação interna' },
];

export default function EmpresasPage() {
  const { user } = useAuth();
  const { empresas, addEmpresa, updateEmpresa, colaboradores, requisicoes } = useData();
  const { currentEmpresaId, setCurrentEmpresaId, isGroupLevel } = useTenant();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState<Omit<Empresa, 'id'> & { id?: number }>({
    codigo: '',
    nome: '',
    nif: '',
    morada: '',
    activo: true,
    modulosAtivos: undefined,
  });

  const isAdmin = user?.perfil === 'Admin';
  const filtered = empresas.filter(
    e => (e.nome.toLowerCase().includes(search.toLowerCase()) || e.codigo.toLowerCase().includes(search.toLowerCase()))
  );
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const countColabs = (empresaId: number) => colaboradores.filter(c => c.empresaId === empresaId).length;
  const countReqs = (empresaId: number) => requisicoes.filter(r => r.empresaId === empresaId).length;

  const openCreate = () => {
    setEditing(null);
    setForm({
      codigo: '',
      nome: '',
      nif: '',
      morada: '',
      activo: true,
      modulosAtivos: [...MODULOS_ATIVOS_PADRAO_GRUPO],
    });
    setDialogOpen(true);
  };

  const openEdit = (empresa: Empresa) => {
    setEditing(empresa);
    setForm({
      codigo: empresa.codigo,
      nome: empresa.nome,
      nif: empresa.nif ?? '',
      morada: empresa.morada ?? '',
      activo: empresa.activo,
      modulosAtivos: empresa.modulosAtivos ? [...empresa.modulosAtivos] : undefined,
    });
    setDialogOpen(true);
  };

  const toggleModulo = (id: string) => {
    setForm(f => {
      const list = f.modulosAtivos ?? [];
      const next = list.includes(id) ? list.filter(m => m !== id) : [...list, id];
      return { ...f, modulosAtivos: next.length ? next : undefined };
    });
  };

  const save = async () => {
    if (!form.codigo.trim() || !form.nome.trim()) return;
    const payload = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      nif: form.nif?.trim() || undefined,
      morada: form.morada?.trim() || undefined,
      activo: form.activo,
      modulosAtivos: form.modulosAtivos?.length ? form.modulosAtivos : undefined,
    };
    try {
      if (editing) await updateEmpresa(editing.id, payload);
      else await addEmpresa(payload);
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Empresas do Grupo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão multi-empresa: cada unidade opera de forma autónoma com segregação completa de dados. O Grupo (PCA/Admin) tem visão consolidada.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Nova empresa
          </Button>
        )}
      </div>

      {isGroupLevel && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/80">
          <span className="text-sm font-medium">Contexto actual:</span>
          <Button
            variant={currentEmpresaId === 'consolidado' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentEmpresaId('consolidado')}
          >
            Visão consolidada (Grupo)
          </Button>
          {empresas.filter(e => e.activo).map(e => (
            <Button
              key={e.id}
              variant={currentEmpresaId === e.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentEmpresaId(e.id)}
            >
              {e.codigo}
            </Button>
          ))}
        </div>
      )}

      <div className="relative max-w-sm">
        <Input placeholder="Pesquisar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="h-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pagination.slice.map(empresa => (
          <div
            key={empresa.id}
            className="rounded-xl border border-border/80 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="flex items-center gap-2">
                {empresa.activo ? (
                  <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                    Activa
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Inactiva
                  </span>
                )}
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(empresa)} title="Editar empresa">
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <h3 className="mt-4 font-semibold text-foreground">{empresa.nome}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{empresa.codigo}</p>
            {empresa.nif && <p className="text-xs text-muted-foreground mt-1">NIF: {empresa.nif}</p>}
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> {countColabs(empresa.id)} colaboradores
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="h-4 w-4" /> {countReqs(empresa.id)} requisições
              </span>
            </div>
            {isGroupLevel && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => setCurrentEmpresaId(empresa.id)}
                disabled={!empresa.activo}
              >
                Ver contexto desta empresa
              </Button>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma empresa encontrada.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      {/* Dialog Nova / Editar empresa (só Admin) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
            <DialogDescription>
              Preencha os dados da empresa do grupo. Código e nome são obrigatórios.{' '}
              {editing
                ? 'O pacote de módulos pode ser ajustado; por defeito o grupo usa o mesmo conjunto em todas as unidades.'
                : 'Os módulos vêm pré-preenchidos com o pacote padrão do grupo (igual ao da Sanep SGPS); pode alterar antes de guardar.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                  placeholder="ex: SANEP-SGPS"
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-2">
                <Label>NIF</Label>
                <Input value={form.nif} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Razão social" />
            </div>
            <div className="space-y-2">
              <Label>Morada</Label>
              <Textarea value={form.morada} onChange={e => setForm(f => ({ ...f, morada: e.target.value }))} placeholder="Opcional" rows={2} className="resize-none" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="activo" checked={form.activo} onCheckedChange={c => setForm(f => ({ ...f, activo: c === true }))} />
              <Label htmlFor="activo" className="cursor-pointer">Empresa activa (visível no login e no selector)</Label>
            </div>
            <div className="space-y-2 border-t border-border/80 pt-4">
              <Label>Módulos permitidos</Label>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Se nenhum for seleccionado, não restringe por empresa (ver perfil do utilizador).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs h-8"
                  onClick={() =>
                    setForm(f => ({ ...f, modulosAtivos: [...MODULOS_ATIVOS_PADRAO_GRUPO] }))
                  }
                >
                  Pacote grupo (Sanep SGPS)
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {MODULOS_DISPONIVEIS.map(m => (
                  <div key={m.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`mod-${m.id}`}
                      checked={(form.modulosAtivos ?? []).includes(m.id)}
                      onCheckedChange={() => toggleModulo(m.id)}
                    />
                    <Label htmlFor={`mod-${m.id}`} className="cursor-pointer text-sm font-normal">{m.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.codigo.trim() || !form.nome.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
