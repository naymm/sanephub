import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { useNotifications } from '@/context/NotificationContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import { PdfPreviewDialog } from '@/components/PdfPreviewDialog';
import { useAuth } from '@/context/AuthContext';
import type { Declaracao, TipoDeclaracao, StatusDeclaracao } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
import { gerarPdfDeclaracaoServicoBlob, assinaturaPdfFromDeclaracao } from '@/utils/declaracaoServicoPdf';
import { pdfPreviewUrlFromGeneratedBlob, releasePdfPreviewUrl } from '@/utils/pdfPreviewPublicUrl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Search, Plus, Pencil, Eye, Check, FileDown, Trash2, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const TIPO_OPTIONS: TipoDeclaracao[] = ['Para Banco', 'Embaixada', 'Rendimentos', 'Outro'];
const STATUS_OPTIONS: StatusDeclaracao[] = ['Pendente', 'Emitida', 'Entregue'];

const LIST_PATH = '/capital-humano/declaracoes';
const NOVO_PATH = '/capital-humano/declaracoes/novo';

export default function DeclaracoesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { declaracoes, addDeclaracao, updateDeclaracao, deleteDeclaracao, colaboradores } = useData();
  const { addNotification } = useNotifications();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusDeclaracao | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Declaracao | null>(null);
  const [viewItem, setViewItem] = useState<Declaracao | null>(null);
  const [form, setForm] = useState<Omit<Declaracao, 'id'>>({
    colaboradorId: 0,
    tipo: 'Para Banco',
    dataPedido: new Date().toISOString().slice(0, 10),
    status: 'Pendente',
  });
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [colabSelectOpen, setColabSelectOpen] = useState(false);

  const prepareCreate = useCallback(() => {
    setEditing(null);
    setForm({
      colaboradorId: colaboradores[0]?.id ?? 0,
      tipo: 'Para Banco',
      dataPedido: new Date().toISOString().slice(0, 10),
      status: 'Pendente',
    });
  }, [colaboradores]);

  const resetModal = useCallback(() => {
    setEditing(null);
    setColabSelectOpen(false);
    setForm({
      colaboradorId: colaboradores[0]?.id ?? 0,
      tipo: 'Para Banco',
      dataPedido: new Date().toISOString().slice(0, 10),
      status: 'Pendente',
    });
  }, [colaboradores]);

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

  const getColabName = (id: number) => colaboradores.find(c => c.id === id)?.nome ?? 'N/A';
  const canEliminar = user?.perfil === 'Admin';

  const handleImprimirPdf = async (d: Declaracao) => {
    if (d.status !== 'Emitida' && d.status !== 'Entregue') {
      toast.error('Só pode imprimir declarações emitidas ou entregues.');
      return;
    }
    const col = colaboradores.find(c => c.id === d.colaboradorId);
    if (!col) {
      toast.error('Dados do colaborador não encontrados.');
      return;
    }
    try {
      // Igual ao portal: assinatura gravada na declaração (emitente_assinatura_imagem_url, emitido_por, etc.)
      const blob = await gerarPdfDeclaracaoServicoBlob(d, col, assinaturaPdfFromDeclaracao(d));
      const previewUrl = await pdfPreviewUrlFromGeneratedBlob(blob, 'declaracao');
      setPdfPreviewUrl(previewUrl);
      setPdfPreviewOpen(true);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Não foi possível gerar o PDF.');
    }
  };

  const filtered = declaracoes.filter(d => {
    const matchSearch = getColabName(d.colaboradorId).toLowerCase().includes(search.toLowerCase()) || d.tipo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('colab');
  const mobileComparators = useMemo(
    () => ({
      colab: (a: Declaracao, b: Declaracao) => {
        const na = colaboradores.find(c => c.id === a.colaboradorId)?.nome ?? 'N/A';
        const nb = colaboradores.find(c => c.id === b.colaboradorId)?.nome ?? 'N/A';
        return na.localeCompare(nb, 'pt', { sensitivity: 'base' });
      },
      tipo: (a: Declaracao, b: Declaracao) => a.tipo.localeCompare(b.tipo, 'pt', { sensitivity: 'base' }),
      dataPedido: (a: Declaracao, b: Declaracao) => a.dataPedido.localeCompare(b.dataPedido),
    }),
    [colaboradores],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const openCreate = () => openCreateNavigateOrDialog();

  const openEdit = (d: Declaracao) => {
    setEditing(d);
    setForm({
      colaboradorId: d.colaboradorId,
      tipo: d.tipo,
      descricao: d.descricao,
      banco: d.banco,
      paisEmbaixada: d.paisEmbaixada,
      dataPedido: d.dataPedido,
      dataEmissao: d.dataEmissao,
      dataEntrega: d.dataEntrega,
      status: d.status,
      emitidoPor: d.emitidoPor,
      observacoes: d.observacoes,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.colaboradorId || !form.dataPedido) return;
    try {
      if (editing) await updateDeclaracao(editing.id, form);
      else {
        await addDeclaracao(form);
        const nome = getColabName(form.colaboradorId);
        addNotification({
          tipo: 'info',
          titulo: 'Declaração registada (RH)',
          mensagem: `Foi criada uma declaração (${form.tipo}) para ${nome}.`,
          moduloOrigem: 'capital-humano',
          destinatarioPerfil: ['Colaborador'],
          destinatarioColaboradorId: form.colaboradorId,
          link: '/portal/declaracoes',
        });
      }
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

  const marcarEmitida = async (d: Declaracao) => {
    const dataEmissao = new Date().toISOString().slice(0, 10);
    const emitidoPor = user?.assinaturaLinha?.trim() || user?.nome;
    try {
      const updated = await updateDeclaracao(d.id, {
        status: 'Emitida',
        dataEmissao,
        emitidoPor,
        emitenteAssinaturaCargo: user?.assinaturaCargo?.trim() || user?.cargo,
        emitenteAssinaturaImagemUrl: user?.assinaturaImagemUrl?.trim() || undefined,
      });
      addNotification({
        tipo: 'sucesso',
        titulo: 'Declaração emitida',
        mensagem: `A sua declaração (${d.tipo}) foi emitida. Pode descarregar o PDF em «As minhas declarações».`,
        moduloOrigem: 'capital-humano',
        destinatarioPerfil: ['Colaborador'],
        destinatarioColaboradorId: d.colaboradorId,
        link: '/portal/declaracoes',
      });
      // PDF com os mesmos dados persistidos (emitente_assinatura_imagem_url, etc.)
      void handleImprimirPdf(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao actualizar');
    }
  };

  const marcarEntregue = async (d: Declaracao) => {
    try {
      await updateDeclaracao(d.id, { status: 'Entregue', dataEntrega: new Date().toISOString().slice(0, 10) });
      addNotification({
        tipo: 'info',
        titulo: 'Declaração entregue',
        mensagem: `A declaração (${d.tipo}) foi registada como entregue.`,
        moduloOrigem: 'capital-humano',
        destinatarioPerfil: ['Colaborador'],
        destinatarioColaboradorId: d.colaboradorId,
        link: '/portal/declaracoes',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao actualizar');
    }
  };

  const remove = async (d: Declaracao) => {
    if (!canEliminar) {
      toast.error('Apenas administradores podem eliminar declarações.');
      return;
    }
    if (!window.confirm('Remover esta declaração?')) return;
    try {
      await deleteDeclaracao(d.id);
      toast.success('Declaração removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Declarações</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova Declaração
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusDeclaracao | 'todos')}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data pedido</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data emissão</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(d => (
              <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{getColabName(d.colaboradorId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.tipo}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(d.dataPedido)}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.dataEmissao ? formatDate(d.dataEmissao) : '—'}</td>
                <td className="py-3 px-5"><StatusBadge status={d.status} /></td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhe" onClick={() => { setViewItem(d); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    {(d.status === 'Emitida' || d.status === 'Entregue') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir PDF" onClick={() => handleImprimirPdf(d)}><FileDown className="h-4 w-4" /></Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                    {canEliminar && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d)} title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {d.status === 'Pendente' && (
                      <Button variant="ghost" size="sm" onClick={() => marcarEmitida(d)}>Emitir</Button>
                    )}
                    {d.status === 'Emitida' && (
                      <Button variant="ghost" size="sm" onClick={() => marcarEntregue(d)}><Check className="h-4 w-4 mr-1" />Entregue</Button>
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
          rowId={d => d.id}
          sortBar={{
            options: [
              { key: 'colab', label: 'Colaborador' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'dataPedido', label: 'Pedido' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={d => ({
            title: getColabName(d.colaboradorId),
            trailing: <StatusBadge status={d.status} />,
          })}
          renderDetails={d => [
            { label: 'Tipo', value: d.tipo },
            { label: 'Data pedido', value: formatDate(d.dataPedido) },
            { label: 'Data emissão', value: d.dataEmissao ? formatDate(d.dataEmissao) : '—' },
            { label: 'Status', value: <StatusBadge status={d.status} /> },
          ]}
          renderActions={d => (
            <>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => { setViewItem(d); setViewOpen(true); }} aria-label="Ver detalhe">
                <Eye className="h-4 w-4" />
              </Button>
              {(d.status === 'Emitida' || d.status === 'Entregue') && (
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => handleImprimirPdf(d)} aria-label="Imprimir PDF">
                  <FileDown className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openEdit(d)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              {canEliminar && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(d)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {d.status === 'Pendente' && (
                <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => marcarEmitida(d)}>
                  Emitir
                </Button>
              )}
              {d.status === 'Emitida' && (
                <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => marcarEntregue(d)}>
                  <Check className="h-4 w-4 mr-1" />
                  Entregue
                </Button>
              )}
            </>
          )}
        />
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma declaração encontrada.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={closeMobileCreate}
          moduleKicker="Capital Humano"
          screenTitle={editing ? 'Editar declaração' : 'Nova declaração'}
          desktopContentClassName="max-w-lg max-h-[90vh] overflow-y-auto"
          desktopHeader={mobileCreateDesktopHeader(
            editing ? 'Editar declaração' : 'Nova declaração',
            'Pedido de declaração para o colaborador.',
          )}
          formBody={
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Popover open={colabSelectOpen} onOpenChange={setColabSelectOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={colabSelectOpen}
                      className="w-full justify-between font-normal"
                    >
                      {form.colaboradorId
                        ? (colaboradores.find(c => c.id === form.colaboradorId)?.nome ?? 'Seleccionar')
                        : 'Seleccionar colaborador'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar colaborador..." />
                      <CommandList>
                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          {colaboradores.map(c => (
                            <CommandItem
                              key={c.id}
                              value={c.nome}
                              onSelect={() => {
                                setForm(f => ({ ...f, colaboradorId: c.id }));
                                setColabSelectOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  form.colaboradorId === c.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {c.nome} — {c.departamento}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoDeclaracao }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input value={form.descricao ?? ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value || undefined }))} placeholder="ex: Crédito habitação" />
              </div>
              <div className="space-y-2">
                <Label>Data pedido</Label>
                <Input type="date" value={form.dataPedido} onChange={e => setForm(f => ({ ...f, dataPedido: e.target.value }))} />
              </div>
              {editing && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data emissão</Label>
                      <Input type="date" value={form.dataEmissao ?? ''} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value || undefined }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Data entrega</Label>
                      <Input type="date" value={form.dataEntrega ?? ''} onChange={e => setForm(f => ({ ...f, dataEntrega: e.target.value || undefined }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusDeclaracao }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Emitido por</Label>
                    <Input value={form.emitidoPor ?? ''} onChange={e => setForm(f => ({ ...f, emitidoPor: e.target.value || undefined }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea value={form.observacoes ?? ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value || undefined }))} rows={2} />
                  </div>
                </>
              )}
            </div>
          }
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void save()} disabled={!form.colaboradorId || !form.dataPedido}>
                Guardar
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
                disabled={!form.colaboradorId || !form.dataPedido}
                onClick={() => void save()}
              >
                Guardar
              </Button>
            </div>
          }
        />
      </Dialog>

      <PdfPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={open => {
          setPdfPreviewOpen(open);
          if (!open) {
            setPdfPreviewUrl(prev => {
              releasePdfPreviewUrl(prev);
              return null;
            });
          }
        }}
        url={pdfPreviewUrl}
        iframeTitle="Pré-visualização da declaração de serviço"
      />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declaração — {viewItem && getColabName(viewItem.colaboradorId)}</DialogTitle>
            <DialogDescription>{viewItem?.tipo}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
                {viewItem.banco && <p><span className="text-muted-foreground">Banco:</span> {viewItem.banco}</p>}
                {viewItem.paisEmbaixada && <p><span className="text-muted-foreground">País (Embaixada):</span> {viewItem.paisEmbaixada}</p>}
                {viewItem.descricao && <p><span className="text-muted-foreground">Descrição:</span> {viewItem.descricao}</p>}
                <p><span className="text-muted-foreground">Data pedido:</span> {formatDate(viewItem.dataPedido)}</p>
                <p><span className="text-muted-foreground">Data emissão:</span> {viewItem.dataEmissao ? formatDate(viewItem.dataEmissao) : '—'}</p>
                <p><span className="text-muted-foreground">Data entrega:</span> {viewItem.dataEntrega ? formatDate(viewItem.dataEntrega) : '—'}</p>
                <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
                {viewItem.emitidoPor && <p><span className="text-muted-foreground">Emitido por:</span> {viewItem.emitidoPor}</p>}
              </div>
              {(viewItem.status === 'Emitida' || viewItem.status === 'Entregue') && (
                <Button onClick={() => { handleImprimirPdf(viewItem); setViewOpen(false); }} className="w-full sm:w-auto">
                  <FileDown className="h-4 w-4 mr-2" />
                  Imprimir PDF (Declaração de Serviço)
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
