import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { ProcessoJudicial } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, formatKz } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Eye, Scale } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const STATUS_OPCOES: ProcessoJudicial['status'][] = ['Em curso', 'Suspenso', 'Encerrado', 'Ganho', 'Perdido', 'Acordo'];

const LIST_PATH = '/juridico/processos';
const NOVO_PATH = '/juridico/processos/novo';

export default function ProcessosJudiciaisPage() {
  const navigate = useNavigate();
  const { processos, addProcesso, updateProcesso, deleteProcesso, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessoJudicial | null>(null);
  const [form, setForm] = useState<Partial<ProcessoJudicial>>({
    numero: '',
    tribunal: '',
    tipoAccao: '',
    autor: '',
    reu: '',
    valorEmCausa: 0,
    dataEntrada: '',
    advogado: '',
    descricao: '',
    status: 'Em curso',
  });

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? empresas.find(e => e.activo)?.id ?? 1 : currentEmpresaId;
  const canEdit = user?.perfil === 'Admin';

  const filtered = processos.filter(p => {
    const matchSearch =
      !search ||
      p.numero.toLowerCase().includes(search.toLowerCase()) ||
      p.tribunal.toLowerCase().includes(search.toLowerCase()) ||
      p.autor.toLowerCase().includes(search.toLowerCase()) ||
      p.reu.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'todos' || p.status === filterStatus;
    const matchEmpresa = filterEmpresa === 'todos' || (p.empresaId != null && String(p.empresaId) === filterEmpresa);
    return matchSearch && matchStatus && matchEmpresa;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const empresaNome = (id: number | undefined) => (id != null ? empresas.find(e => e.id === id)?.nome ?? String(id) : '—');

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('numero');
  const mobileComparators = useMemo(
    () => ({
      numero: (a: ProcessoJudicial, b: ProcessoJudicial) => a.numero.localeCompare(b.numero, 'pt', { sensitivity: 'base' }),
      tribunal: (a: ProcessoJudicial, b: ProcessoJudicial) => a.tribunal.localeCompare(b.tribunal, 'pt', { sensitivity: 'base' }),
      dataEntrada: (a: ProcessoJudicial, b: ProcessoJudicial) => a.dataEntrada.localeCompare(b.dataEntrada),
      valor: (a: ProcessoJudicial, b: ProcessoJudicial) => a.valorEmCausa - b.valorEmCausa,
      empresa: (a: ProcessoJudicial, b: ProcessoJudicial) =>
        empresaNome(a.empresaId).localeCompare(empresaNome(b.empresaId), 'pt', { sensitivity: 'base' }),
    }),
    [empresas],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const prepareCreate = useCallback(() => {
    setEditing(null);
    const ano = new Date().getFullYear();
    const nextNum = Math.max(0, ...processos.map(p => parseInt(p.numero.replace(/\D/g, ''), 10) || 0)) + 1;
    setForm({
      empresaId: typeof empresaIdForNew === 'number' ? empresaIdForNew : 1,
      numero: `PROC-${ano}-${String(nextNum).padStart(4, '0')}`,
      tribunal: '',
      tipoAccao: '',
      autor: '',
      reu: '',
      valorEmCausa: 0,
      dataEntrada: new Date().toISOString().slice(0, 10),
      advogado: user?.nome ?? '',
      descricao: '',
      status: 'Em curso',
    });
  }, [empresaIdForNew, processos, user?.nome]);

  const resetModal = useCallback(() => {
    setEditing(null);
    setForm({
      numero: '',
      tribunal: '',
      tipoAccao: '',
      autor: '',
      reu: '',
      valorEmCausa: 0,
      dataEntrada: '',
      advogado: '',
      descricao: '',
      status: 'Em curso',
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

  const openEdit = (p: ProcessoJudicial) => {
    setEditing(p);
    setForm({ ...p });
    setDialogOpen(true);
  };

  const openDetail = (p: ProcessoJudicial) => {
    setEditing(p);
    setDetailOpen(true);
  };

  const save = async () => {
    if (!form.numero?.trim() || !form.tribunal?.trim() || !form.dataEntrada) return;
    const payload: Partial<ProcessoJudicial> = {
      empresaId: form.empresaId,
      numero: form.numero.trim(),
      tribunal: form.tribunal.trim(),
      tipoAccao: form.tipoAccao?.trim() ?? '',
      autor: form.autor?.trim() ?? '',
      reu: form.reu?.trim() ?? '',
      valorEmCausa: Number(form.valorEmCausa) || 0,
      dataEntrada: form.dataEntrada,
      proximaAudiencia: form.proximaAudiencia || undefined,
      status: form.status ?? 'Em curso',
      advogado: form.advogado?.trim() ?? '',
      descricao: form.descricao?.trim() ?? '',
      observacoes: form.observacoes,
    };
    try {
      if (editing) await updateProcesso(editing.id, payload);
      else await addProcesso(payload);
      setDialogOpen(false);
      setEditing(null);
      if (isNovoRoute) {
        endMobileCreateFlow();
        navigate(LIST_PATH, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (p: ProcessoJudicial) => {
    if (!window.confirm(`Remover processo ${p.numero}?`)) return;
    try {
      await deleteProcesso(p.id);
      setDetailOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Processos Judiciais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhamento de processos em tribunal: laboral, comercial, fiscal, cível.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo processo
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Pesquisar nº, tribunal, autor, réu..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-9" />
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
              <th className="text-left p-3 font-medium text-muted-foreground">Nº</th>
              {currentEmpresaId === 'consolidado' && <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>}
              <th className="text-left p-3 font-medium text-muted-foreground">Tribunal</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Autor</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Réu</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Valor em causa</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Entrada</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Próx. audiência</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="p-3 font-mono text-xs">{p.numero}</td>
                {currentEmpresaId === 'consolidado' && <td className="p-3 text-muted-foreground">{empresaNome(p.empresaId)}</td>}
                <td className="p-3 max-w-36 truncate" title={p.tribunal}>{p.tribunal}</td>
                <td className="p-3">{p.tipoAccao}</td>
                <td className="p-3 max-w-28 truncate">{p.autor}</td>
                <td className="p-3 max-w-28 truncate">{p.reu}</td>
                <td className="p-3 text-right font-mono text-xs">{formatKz(p.valorEmCausa)}</td>
                <td className="p-3 text-muted-foreground">{formatDate(p.dataEntrada)}</td>
                <td className="p-3 text-muted-foreground">{p.proximaAudiencia ? formatDate(p.proximaAudiencia) : '—'}</td>
                <td className="p-3"><StatusBadge status={p.status} /></td>
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
            ))}
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
              { key: 'numero', label: 'Nº' },
              { key: 'tribunal', label: 'Tribunal' },
              { key: 'valor', label: 'Valor' },
              { key: 'dataEntrada', label: 'Entrada' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={p => ({
            title: p.numero,
            trailing: <StatusBadge status={p.status} />,
          })}
          renderDetails={p => [
            ...(currentEmpresaId === 'consolidado' ? [{ label: 'Empresa', value: empresaNome(p.empresaId) }] : []),
            { label: 'Tribunal', value: p.tribunal },
            { label: 'Tipo', value: p.tipoAccao },
            { label: 'Autor', value: p.autor },
            { label: 'Réu', value: p.reu },
            { label: 'Valor em causa', value: formatKz(p.valorEmCausa) },
            { label: 'Entrada', value: formatDate(p.dataEntrada) },
            { label: 'Próx. audiência', value: p.proximaAudiencia ? formatDate(p.proximaAudiencia) : '—' },
            { label: 'Status', value: <StatusBadge status={p.status} /> },
          ]}
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
          <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum processo judicial encontrado.</p>
          {canEdit && <Button variant="outline" className="mt-3" onClick={openCreate}>Registar processo</Button>}
        </div>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={closeMobileCreate}
          moduleKicker="Jurídico"
          screenTitle={editing ? 'Editar processo judicial' : 'Novo processo judicial'}
          desktopContentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
          desktopHeader={mobileCreateDesktopHeader(
            editing ? 'Editar processo judicial' : 'Novo processo judicial',
            'Dados do processo em tribunal.',
          )}
          formBody={
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nº processo</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="PROC-2024-0001" />
              </div>
              <div className="space-y-2">
                <Label>Tribunal</Label>
                <Input value={form.tribunal} onChange={e => setForm(f => ({ ...f, tribunal: e.target.value }))} placeholder="Tribunal Provincial de Luanda" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de acção</Label>
                <Input value={form.tipoAccao} onChange={e => setForm(f => ({ ...f, tipoAccao: e.target.value }))} placeholder="Laboral, Comercial, Fiscal, Cível" />
              </div>
              <div className="space-y-2">
                <Label>Valor em causa (Kz)</Label>
                <Input type="number" value={form.valorEmCausa || ''} onChange={e => setForm(f => ({ ...f, valorEmCausa: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Autor</Label>
                <Input value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} placeholder="Autor" />
              </div>
              <div className="space-y-2">
                <Label>Réu</Label>
                <Input value={form.reu} onChange={e => setForm(f => ({ ...f, reu: e.target.value }))} placeholder="Réu" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data entrada</Label>
                <Input type="date" value={form.dataEntrada || ''} onChange={e => setForm(f => ({ ...f, dataEntrada: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Próxima audiência</Label>
                <Input type="date" value={form.proximaAudiencia || ''} onChange={e => setForm(f => ({ ...f, proximaAudiencia: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Advogado responsável</Label>
                <Input value={form.advogado} onChange={e => setForm(f => ({ ...f, advogado: e.target.value }))} placeholder="Nome" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ProcessoJudicial['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} placeholder="Resumo do processo" />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Opcional" />
            </div>
          </div>
          }
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => onDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void save()} disabled={!form.numero?.trim() || !form.tribunal?.trim() || !form.dataEntrada}>
                {editing ? 'Guardar' : 'Registar processo'}
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
                disabled={!form.numero?.trim() || !form.tribunal?.trim() || !form.dataEntrada}
                onClick={() => void save()}
              >
                {editing ? 'Guardar' : 'Registar processo'}
              </Button>
            </div>
          }
        />
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe — {editing?.numero}</DialogTitle>
            <DialogDescription>Processo judicial em tribunal.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Empresa:</span> {empresaNome(editing.empresaId)}</div>
                <div><span className="text-muted-foreground">Tribunal:</span> {editing.tribunal}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {editing.tipoAccao}</div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={editing.status} /></div>
                <div><span className="text-muted-foreground">Autor:</span> {editing.autor}</div>
                <div><span className="text-muted-foreground">Réu:</span> {editing.reu}</div>
                <div><span className="text-muted-foreground">Valor em causa:</span> {formatKz(editing.valorEmCausa)}</div>
                <div><span className="text-muted-foreground">Advogado:</span> {editing.advogado}</div>
                <div><span className="text-muted-foreground">Data entrada:</span> {formatDate(editing.dataEntrada)}</div>
                <div><span className="text-muted-foreground">Próx. audiência:</span> {editing.proximaAudiencia ? formatDate(editing.proximaAudiencia) : '—'}</div>
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
