import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useNotifications } from '@/context/NotificationContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Declaracao, StatusDeclaracao } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
import { gerarPdfDeclaracaoServicoBlob, assinaturaPdfFromDeclaracao } from '@/utils/declaracaoServicoPdf';
import { pdfPreviewUrlFromGeneratedBlob, releasePdfPreviewUrl } from '@/utils/pdfPreviewPublicUrl';
import { PdfPreviewDialog } from '@/components/PdfPreviewDialog';
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
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Eye, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';
import { DeclaracaoPedidoFields, validateDeclaracaoPedido } from '@/modules/declaracoes/DeclaracaoPedidoFields';
import { DECLARACAO_STATUS_OPTIONS } from '@/modules/declaracoes/declaracaoConstants';

const STATUS_OPTIONS = DECLARACAO_STATUS_OPTIONS;

export default function PortalDeclaracoesPage() {
  const colaboradorId = useColaboradorId();
  const showMobileCreate = useIsMobileViewport();
  const { declaracoes, addDeclaracao, colaboradoresTodos } = useData();
  const { addNotification } = useNotifications();
  const [statusFilter, setStatusFilter] = useState<StatusDeclaracao | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Declaracao | null>(null);
  const [form, setForm] = useState<Omit<Declaracao, 'id'>>({
    colaboradorId: 0,
    tipo: 'Para Banco',
    dataPedido: new Date().toISOString().slice(0, 10),
    status: 'Pendente',
  });
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const minhasDeclaracoes = colaboradorId == null
    ? []
    : declaracoes.filter(d => d.colaboradorId === colaboradorId);

  const filtered = minhasDeclaracoes.filter(d => {
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter;
    return matchStatus;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('tipo');
  const mobileComparators = useMemo(
    () => ({
      tipo: (a: Declaracao, b: Declaracao) => a.tipo.localeCompare(b.tipo, 'pt', { sensitivity: 'base' }),
      dataPedido: (a: Declaracao, b: Declaracao) => a.dataPedido.localeCompare(b.dataPedido),
      dataEmissao: (a: Declaracao, b: Declaracao) => (a.dataEmissao ?? '').localeCompare(b.dataEmissao ?? ''),
    }),
    [],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const handleImprimirPdf = async (d: Declaracao) => {
    if (d.status !== 'Emitida' && d.status !== 'Entregue') {
      toast.error('Só pode imprimir declarações emitidas ou entregues.');
      return;
    }
    const col = colaboradoresTodos.find(c => c.id === d.colaboradorId);
    if (!col) {
      toast.error('Dados do colaborador não encontrados.');
      return;
    }
    try {
      const blob = await gerarPdfDeclaracaoServicoBlob(d, col, assinaturaPdfFromDeclaracao(d));
      const previewUrl = await pdfPreviewUrlFromGeneratedBlob(blob, 'declaracao');
      setPdfPreviewUrl(previewUrl);
      setPdfPreviewOpen(true);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Não foi possível gerar o PDF.');
    }
  };

  const openPedir = () => {
    if (colaboradorId == null) return;
    setForm({
      colaboradorId,
      tipo: 'Para Banco',
      descricao: undefined,
      banco: undefined,
      paisEmbaixada: undefined,
      dataPedido: new Date().toISOString().slice(0, 10),
      status: 'Pendente',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.colaboradorId) return;
    const validationError = validateDeclaracaoPedido(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      await addDeclaracao(form);
      const col = colaboradoresTodos.find(c => c.id === form.colaboradorId);
      addNotification({
        tipo: 'info',
        titulo: 'Novo pedido de declaração',
        mensagem: `${col?.nome ?? 'Colaborador'} solicitou declaração (${form.tipo}).`,
        moduloOrigem: 'capital-humano',
        destinatarioPerfil: ['RH', 'Admin'],
        link: '/capital-humano/declaracoes',
      });
      setDialogOpen(false);
      toast.success('Pedido de declaração registado. Será processado pelos Recursos Humanos.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registar');
    }
  };

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">As Minhas Declarações</h1>
        <p className="text-muted-foreground text-center py-12">Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">As Minhas Declarações</h1>
        <Button onClick={openPedir} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Pedir Declaração
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Declarações de serviço (para banco, rendimentos, antiguidade). Pode solicitar nova declaração.</p>

      <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusDeclaracao | 'todos')}>
        <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {STATUS_OPTIONS.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
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
                <td className="py-3 px-5 font-medium">{d.tipo}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(d.dataPedido)}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.dataEmissao ? formatDate(d.dataEmissao) : '—'}</td>
                <td className="py-3 px-5"><StatusBadge status={d.status} /></td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhe" onClick={() => { setViewItem(d); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    {(d.status === 'Emitida' || d.status === 'Entregue') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir PDF" onClick={() => handleImprimirPdf(d)}><FileDown className="h-4 w-4" /></Button>
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
              { key: 'tipo', label: 'Tipo' },
              { key: 'dataPedido', label: 'Pedido' },
              { key: 'dataEmissao', label: 'Emissão' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={d => ({
            title: d.tipo,
            trailing: <StatusBadge status={d.status} />,
          })}
          renderDetails={d => [
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
            </>
          )}
        />
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma declaração encontrada.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={() => setDialogOpen(false)}
          moduleKicker="Portal"
          screenTitle="Nova declaração"
          desktopContentClassName="max-w-lg max-h-[90vh] flex flex-col p-6"
          desktopHeader={mobileCreateDesktopHeader(
            'Pedir declaração',
            'Solicite uma declaração de serviço. O pedido será tratado pelos Recursos Humanos.',
          )}
          formBody={
            <div className="grid min-w-0 gap-4 py-2 overflow-y-auto min-h-0">
              <DeclaracaoPedidoFields form={form} onChange={patch => setForm(f => ({ ...f, ...patch }))} />
            </div>
          }
          desktopFooter={
            <DialogFooter className="shrink-0 border-t border-border/80 pt-4 mt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!form.dataPedido}>
                Enviar pedido
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1 rounded-xl"
                disabled={!form.dataPedido}
                onClick={() => void save()}
              >
                Enviar
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
            <DialogTitle>Declaração — {viewItem?.tipo}</DialogTitle>
            <DialogDescription>Detalhe da sua declaração</DialogDescription>
          </DialogHeader>
          {viewItem && (() => {
            const col = colaboradoresTodos.find(c => c.id === viewItem.colaboradorId);
            return (
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
                {col && (viewItem.status === 'Emitida' || viewItem.status === 'Entregue') && (
                  <Button onClick={() => { handleImprimirPdf(viewItem); setViewOpen(false); }} className="w-full sm:w-auto">
                    <FileDown className="h-4 w-4 mr-2" />
                    Imprimir PDF (Declaração de Serviço)
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
