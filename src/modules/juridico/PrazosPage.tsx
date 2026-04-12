import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { PrazoLegal } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, diasRestantes } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Eye, CalendarClock } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const PRIORIDADE_OPCOES: PrazoLegal['prioridade'][] = ['Baixa', 'Média', 'Alta', 'Crítica'];
const STATUS_OPCOES: PrazoLegal['status'][] = ['Pendente', 'Em Tratamento', 'Concluído', 'Vencido'];

export default function PrazosPage() {
  const { prazos, addPrazo, updatePrazo, deletePrazo, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<PrazoLegal | null>(null);
  const [form, setForm] = useState<Partial<PrazoLegal>>({});

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? empresas.find(e => e.activo)?.id ?? 1 : currentEmpresaId;
  const canEdit = user?.perfil === 'Admin';

  const filtered = prazos.filter(p => {
    const matchSearch =
      !search ||
      p.titulo.toLowerCase().includes(search.toLowerCase()) ||
      p.tipo.toLowerCase().includes(search.toLowerCase()) ||
      (p.vinculoProcesso && p.vinculoProcesso.toLowerCase().includes(search.toLowerCase())) ||
      (p.vinculoContrato && p.vinculoContrato.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === 'todos' || p.status === filterStatus;
    const matchEmpresa = filterEmpresa === 'todos' || (p.empresaId != null && String(p.empresaId) === filterEmpresa);
    return matchSearch && matchStatus && matchEmpresa;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const empresaNome = (id: number | undefined) => (id != null ? empresas.find(e => e.id === id)?.nome ?? String(id) : '—');

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('titulo');
  const mobileComparators = useMemo(
    () => ({
      titulo: (a: PrazoLegal, b: PrazoLegal) => a.titulo.localeCompare(b.titulo, 'pt', { sensitivity: 'base' }),
      tipo: (a: PrazoLegal, b: PrazoLegal) => a.tipo.localeCompare(b.tipo, 'pt', { sensitivity: 'base' }),
      dataLimite: (a: PrazoLegal, b: PrazoLegal) => a.dataLimite.localeCompare(b.dataLimite),
      empresa: (a: PrazoLegal, b: PrazoLegal) =>
        empresaNome(a.empresaId).localeCompare(empresaNome(b.empresaId), 'pt', { sensitivity: 'base' }),
    }),
    [empresas],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const getRowClass = (p: PrazoLegal) => {
    if (p.status === 'Concluído') return '';
    const d = diasRestantes(p.dataLimite);
    if (d < 0) return 'bg-destructive/5';
    if (d <= 7) return 'bg-orange-50 dark:bg-orange-950/20';
    if (d <= 15) return 'bg-amber-50/50 dark:bg-amber-950/20';
    return '';
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      empresaId: typeof empresaIdForNew === 'number' ? empresaIdForNew : 1,
      titulo: '',
      tipo: '',
      descricao: '',
      dataLimite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      prioridade: 'Média',
      responsavel: user?.nome ?? '',
      status: 'Pendente',
      vinculoProcesso: '',
      vinculoContrato: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: PrazoLegal) => {
    setEditing(p);
    setForm({ ...p });
    setDialogOpen(true);
  };

  const openDetail = (p: PrazoLegal) => {
    setEditing(p);
    setDetailOpen(true);
  };

  const save = async () => {
    if (!form.titulo?.trim() || !form.dataLimite) return;
    const payload: Partial<PrazoLegal> = {
      empresaId: form.empresaId,
      titulo: form.titulo.trim(),
      tipo: form.tipo?.trim() ?? '',
      descricao: form.descricao?.trim() ?? '',
      dataLimite: form.dataLimite,
      prioridade: form.prioridade ?? 'Média',
      responsavel: form.responsavel?.trim() ?? '',
      status: form.status ?? 'Pendente',
      vinculoProcesso: form.vinculoProcesso?.trim() || undefined,
      vinculoContrato: form.vinculoContrato?.trim() || undefined,
      observacoes: form.observacoes,
    };
    try {
      if (editing) await updatePrazo(editing.id, payload);
      else await addPrazo(payload);
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (p: PrazoLegal) => {
    if (!window.confirm(`Remover prazo "${p.titulo}"?`)) return;
    try {
      await deletePrazo(p.id);
      setDetailOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Prazos Legais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prazos processuais, caducidades e obrigações legais com alertas de vencimento.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo prazo
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Pesquisar título, tipo, processo, contrato..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-9" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPCOES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentEmpresaId === 'consolidado' && (
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {empresas.filter(e => e.activo).map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="hidden md:block table-container overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Título</th>
              {currentEmpresaId === 'consolidado' && <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>}
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Data Limite</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Dias</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Prioridade</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(p => {
              const d = diasRestantes(p.dataLimite);
              return (
                <tr key={p.id} className={cn('border-b last:border-0 hover:bg-muted/20 transition-colors', getRowClass(p))}>
                  <td className="p-3 font-medium max-w-48 truncate" title={p.titulo}>{p.titulo}</td>
                  {currentEmpresaId === 'consolidado' && <td className="p-3 text-muted-foreground">{empresaNome(p.empresaId)}</td>}
                  <td className="p-3 text-muted-foreground">{p.tipo}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(p.dataLimite)}</td>
                  <td className={cn('p-3 font-semibold', d < 0 ? 'text-destructive' : d <= 7 ? 'text-orange-600' : d <= 30 ? 'text-amber-600' : 'text-muted-foreground')}>
                    {d < 0 ? `Vencido (${Math.abs(d)}d)` : `${d} dias`}
                  </td>
                  <td className="p-3"><StatusBadge status={p.prioridade} /></td>
                  <td className="p-3 text-muted-foreground">{p.responsavel}</td>
                  <td className="p-3"><StatusBadge status={p.status} pulse={p.status === 'Vencido'} /></td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(p)} title="Ver"><Eye className="h-4 w-4" /></Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(p)} title="Remover"><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={p => p.id}
          sortBar={{
            options: [
              ...(currentEmpresaId === 'consolidado' ? [{ key: 'empresa', label: 'Empresa' } as const] : []),
              { key: 'titulo', label: 'Título' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'dataLimite', label: 'Data limite' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={p => {
            const d = diasRestantes(p.dataLimite);
            return {
              title: p.titulo,
              trailing: (
                <span className={cn('text-xs font-semibold', d < 0 ? 'text-destructive' : d <= 7 ? 'text-orange-600' : 'text-muted-foreground')}>
                  {d < 0 ? `Vencido (${Math.abs(d)}d)` : `${d} dias`}
                </span>
              ),
            };
          }}
          renderDetails={p => {
            const d = diasRestantes(p.dataLimite);
            return [
              ...(currentEmpresaId === 'consolidado' ? [{ label: 'Empresa', value: empresaNome(p.empresaId) }] : []),
              { label: 'Tipo', value: p.tipo },
              { label: 'Data limite', value: formatDate(p.dataLimite) },
              { label: 'Dias', value: d < 0 ? `Vencido (${Math.abs(d)}d)` : `${d} dias` },
              { label: 'Prioridade', value: <StatusBadge status={p.prioridade} /> },
              { label: 'Responsável', value: p.responsavel },
              { label: 'Status', value: <StatusBadge status={p.status} pulse={p.status === 'Vencido'} /> },
            ];
          }}
          renderActions={p => (
            <>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openDetail(p)} aria-label="Ver">
                <Eye className="h-4 w-4" />
              </Button>
              {canEdit && (
                <>
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openEdit(p)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => remove(p)}
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </>
          )}
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 rounded-lg border border-dashed border-border/80">
          <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum prazo legal encontrado.</p>
          {canEdit && <Button variant="outline" className="mt-3" onClick={openCreate}>Registar prazo</Button>}
        </div>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar prazo legal' : 'Novo prazo legal'}</DialogTitle>
            <DialogDescription>Registo de prazo processual ou obrigação legal.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {currentEmpresaId === 'consolidado' && (
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={form.empresaId != null ? String(form.empresaId) : '1'} onValueChange={v => setForm(f => ({ ...f, empresaId: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {empresas.filter(e => e.activo).map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Prazo para recurso fiscal" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} placeholder="Fiscal, Laboral, Contratual..." />
              </div>
              <div className="space-y-2">
                <Label>Data limite</Label>
                <Input type="date" value={form.dataLimite || ''} onChange={e => setForm(f => ({ ...f, dataLimite: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v as PrazoLegal['prioridade'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADE_OPCOES.map(pr => (
                      <SelectItem key={pr} value={pr}>{pr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vínculo processo (ref.)</Label>
                <Input value={form.vinculoProcesso} onChange={e => setForm(f => ({ ...f, vinculoProcesso: e.target.value }))} placeholder="Nº processo judicial" />
              </div>
              <div className="space-y-2">
                <Label>Vínculo contrato (ref.)</Label>
                <Input value={form.vinculoContrato} onChange={e => setForm(f => ({ ...f, vinculoContrato: e.target.value }))} placeholder="Nº contrato" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} placeholder="Contexto do prazo" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as PrazoLegal['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPCOES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.titulo?.trim() || !form.dataLimite}>
              {editing ? 'Guardar' : 'Registar prazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe — {editing?.titulo}</DialogTitle>
            <DialogDescription>Prazo legal.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Empresa:</span> {empresaNome(editing.empresaId)}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {editing.tipo}</div>
                <div><span className="text-muted-foreground">Data limite:</span> {formatDate(editing.dataLimite)}</div>
                <div><span className="text-muted-foreground">Dias:</span> {editing.status === 'Concluído' ? '—' : diasRestantes(editing.dataLimite) < 0 ? `Vencido (${Math.abs(diasRestantes(editing.dataLimite))}d)` : `${diasRestantes(editing.dataLimite)} dias`}</div>
                <div><span className="text-muted-foreground">Prioridade:</span> <StatusBadge status={editing.prioridade} /></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={editing.status} /></div>
                <div><span className="text-muted-foreground">Responsável:</span> {editing.responsavel}</div>
                <div><span className="text-muted-foreground">Vínculo processo:</span> {editing.vinculoProcesso || '—'}</div>
                <div><span className="text-muted-foreground">Vínculo contrato:</span> {editing.vinculoContrato || '—'}</div>
              </div>
              <div><span className="text-muted-foreground">Descrição:</span><p className="mt-1">{editing.descricao}</p></div>
              {editing.observacoes && <div><span className="text-muted-foreground">Observações:</span><p className="mt-1">{editing.observacoes}</p></div>}
              <DialogFooter>
                {canEdit && <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(editing); }}>Editar</Button>}
                <Button onClick={() => setDetailOpen(false)}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
