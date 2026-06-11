import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Reembolso, ReembolsoLinha, StatusReembolso } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatKz, formatDate } from '@/utils/formatters';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Eye, Check, X, Banknote, Paperclip, AlertCircle } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { PdfPreviewDialog } from '@/components/PdfPreviewDialog';
import {
  REEMBOLSO_STATUS_OPTIONS,
  formatarIbanReembolso,
  uploadComprovativoPagamentoReembolso,
} from '@/modules/financas/reembolsoUtils';
import { nextReferenciaTesouraria } from '@/utils/tesourariaReferencia';

export default function ReembolsosPage() {
  const { user } = useAuth();
  const {
    reembolsos,
    reembolsoLinhas,
    colaboradoresTodos,
    updateReembolso,
    addMovimentoTesouraria,
    movimentosTesouraria,
    contasBancarias,
    centrosCusto,
  } = useData();

  const canAccessFinancas = hasModuleAccess(user, 'financas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusReembolso | 'todos'>('todos');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewReembolso, setViewReembolso] = useState<Reembolso | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Reembolso | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [correcaoOpen, setCorrecaoOpen] = useState(false);
  const [correcaoTarget, setCorrecaoTarget] = useState<Reembolso | null>(null);
  const [motivoCorrecao, setMotivoCorrecao] = useState('');
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoTarget, setPagoTarget] = useState<Reembolso | null>(null);
  const [pagoContaId, setPagoContaId] = useState('');
  const [comprovativos, setComprovativos] = useState<string[]>([]);
  const [pagoSubmitting, setPagoSubmitting] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const colaboradorNome = (id: number) => colaboradoresTodos.find(c => c.id === id)?.nome ?? `Colab. #${id}`;

  const linhasPorReembolso = useMemo(() => {
    const m = new Map<number, ReembolsoLinha[]>();
    for (const l of reembolsoLinhas) {
      if (!m.has(l.reembolsoId)) m.set(l.reembolsoId, []);
      m.get(l.reembolsoId)!.push(l);
    }
    for (const [, list] of m) list.sort((a, b) => a.ordem - b.ordem);
    return m;
  }, [reembolsoLinhas]);

  const filtered = reembolsos.filter(r => {
    const nome = colaboradorNome(r.solicitanteColaboradorId).toLowerCase();
    const matchSearch =
      r.num.toLowerCase().includes(search.toLowerCase()) || nome.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const marcarEmAnalise = async (r: Reembolso) => {
    try {
      await updateReembolso(r.id, { status: 'Em Análise' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao actualizar');
    }
  };

  const aprovar = async (r: Reembolso) => {
    try {
      await updateReembolso(r.id, { status: 'Aprovado', aprovadoPor: user?.nome });
      toast.success('Reembolso aprovado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aprovar');
    }
  };

  const rejeitar = async () => {
    if (!rejectTarget) return;
    try {
      await updateReembolso(rejectTarget.id, {
        status: 'Rejeitado',
        motivoRejeicao: motivoRejeicao.trim() || undefined,
      });
      setRejectOpen(false);
      setRejectTarget(null);
      setMotivoRejeicao('');
      toast.success('Reembolso rejeitado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao rejeitar');
    }
  };

  const solicitarCorrecao = async () => {
    if (!correcaoTarget || !motivoCorrecao.trim()) {
      toast.error('Indique o motivo da correcção.');
      return;
    }
    try {
      await updateReembolso(correcaoTarget.id, {
        status: 'Aguarda Correcção',
        motivoCorrecao: motivoCorrecao.trim(),
      });
      setCorrecaoOpen(false);
      setCorrecaoTarget(null);
      setMotivoCorrecao('');
      toast.success('Pedido de correcção enviado ao colaborador.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao solicitar correcção');
    }
  };

  const openPago = (r: Reembolso) => {
    setPagoTarget(r);
    setComprovativos(r.comprovativoPagamentoAnexos ?? []);
    setPagoContaId('');
    setPagoOpen(true);
  };

  const uploadComprovativo = async (file: File) => {
    if (!pagoTarget) return;
    try {
      const url = await uploadComprovativoPagamentoReembolso(file, pagoTarget.id);
      setComprovativos(prev => [...prev, url]);
      toast.success('Comprovativo anexado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no upload');
    }
  };

  const confirmarPagamento = async () => {
    if (!pagoTarget || pagoSubmitting) return;
    if (comprovativos.length === 0) {
      toast.error('Anexe o comprovativo de pagamento.');
      return;
    }
    const contaId = Number(pagoContaId);
    if (!pagoContaId || !Number.isFinite(contaId)) {
      toast.error('Seleccione a conta bancária.');
      return;
    }
    const conta = contasBancarias.find(c => c.id === contaId);
    if (!conta || conta.empresaId !== pagoTarget.empresaId) {
      toast.error('Conta inválida para esta empresa.');
      return;
    }
    setPagoSubmitting(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const registadoEm = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const beneficiario =
        pagoTarget.nomeReembolso?.trim() || colaboradorNome(pagoTarget.solicitanteColaboradorId);

      await updateReembolso(pagoTarget.id, {
        status: 'Pago',
        dataPagamento: hoje,
        comprovativoPagamentoAnexos: comprovativos,
      });

      const referenciaTes = nextReferenciaTesouraria(movimentosTesouraria, pagoTarget.empresaId, 'saida');
      const centroCustoId = centrosCusto.find(c => c.empresaId === pagoTarget.empresaId)?.id;

      await addMovimentoTesouraria({
        empresaId: pagoTarget.empresaId,
        tipo: 'saida',
        referencia: referenciaTes,
        valor: pagoTarget.montanteTotal,
        data: hoje,
        metodoPagamento: 'Transferência',
        descricao: `Reembolso ${pagoTarget.num}`,
        categoriaSaida: 'despesas_operacionais',
        beneficiario,
        observacoes: pagoTarget.ibanReembolso
          ? `IBAN reembolso: ${formatarIbanReembolso(pagoTarget.ibanReembolso)}`
          : undefined,
        centroCustoId,
        contaBancariaId: contaId,
        comprovativoAnexos: comprovativos,
        reembolsoId: pagoTarget.id,
        registadoPor: user?.nome ?? '',
        registadoEm,
      });

      toast.success('Pagamento confirmado.');
      setPagoOpen(false);
      setPagoTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao confirmar pagamento');
    } finally {
      setPagoSubmitting(false);
    }
  };

  const podeAnalisar = (s: StatusReembolso) => s === 'Pendente' || s === 'Em Análise';
  const podeDecidir = (s: StatusReembolso) => s === 'Pendente' || s === 'Em Análise';

  const renderAcoes = (r: Reembolso) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Ações
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuItem onSelect={() => { setViewReembolso(r); setViewOpen(true); }}>
          <Eye className="h-4 w-4 mr-2" />
          Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canAccessFinancas || !podeAnalisar(r.status)} onSelect={() => void marcarEmAnalise(r)}>
          Em análise
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canAccessFinancas || !podeDecidir(r.status)} onSelect={() => void aprovar(r)}>
          <Check className="h-4 w-4 mr-2" />
          Aprovar
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canAccessFinancas || !podeDecidir(r.status)}
          onSelect={() => { setCorrecaoTarget(r); setMotivoCorrecao(''); setCorrecaoOpen(true); }}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Solicitar correcção
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canAccessFinancas || !podeDecidir(r.status)}
          onSelect={() => { setRejectTarget(r); setMotivoRejeicao(''); setRejectOpen(true); }}
        >
          <X className="h-4 w-4 mr-2" />
          Rejeitar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canAccessFinancas || r.status !== 'Aprovado'} onSelect={() => openPago(r)}>
          <Banknote className="h-4 w-4 mr-2" />
          Confirmar pagamento
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!canAccessFinancas) {
    return <p className="text-sm text-muted-foreground">Sem acesso ao módulo Finanças.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Reembolsos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Análise e aprovação de pedidos de reembolso submetidos pelos colaboradores.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Pesquisar nº ou colaborador…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusReembolso | 'todos')}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REEMBOLSO_STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Nº</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Colaborador</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Tipo</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Montante</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(r => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                <td className="py-3 px-5 font-mono text-xs">{r.num}</td>
                <td className="py-3 px-5">{colaboradorNome(r.solicitanteColaboradorId)}</td>
                <td className="py-3 px-5 capitalize">{r.tipo}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.montanteTotal)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(r.data)}</td>
                <td className="py-3 px-5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-3 px-5 text-right">{renderAcoes(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={pagination.slice}
          rowId={r => r.id}
          renderSummary={r => ({
            title: r.num,
            trailing: <StatusBadge status={r.status} />,
          })}
          renderDetails={r => [
            { label: 'Colaborador', value: colaboradorNome(r.solicitanteColaboradorId) },
            { label: 'Montante', value: formatKz(r.montanteTotal) },
            { label: 'Data', value: formatDate(r.data) },
          ]}
          renderActions={r => renderAcoes(r)}
        />
      </div>

      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewReembolso?.num}</DialogTitle>
            <DialogDescription>Pedido de reembolso</DialogDescription>
          </DialogHeader>
          {viewReembolso ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Colaborador</span>
                <span>{colaboradorNome(viewReembolso.solicitanteColaboradorId)}</span>
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={viewReembolso.status} />
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono">{formatKz(viewReembolso.montanteTotal)}</span>
                <span className="text-muted-foreground">Nome (reembolso)</span>
                <span>{viewReembolso.nomeReembolso?.trim() || '—'}</span>
                <span className="text-muted-foreground">IBAN</span>
                <span className="font-mono text-xs">
                  {viewReembolso.ibanReembolso?.trim() ? formatarIbanReembolso(viewReembolso.ibanReembolso) : '—'}
                </span>
              </div>
              {(linhasPorReembolso.get(viewReembolso.id) ?? []).map((l, i) => (
                <div key={l.id} className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium">
                    {viewReembolso.tipo === 'lote' ? `${i + 1}. ` : ''}
                    {l.nomeEntidade}
                  </p>
                  <p className="text-muted-foreground">{l.descricao}</p>
                  <p className="font-mono">{formatKz(l.montante)}</p>
                  <div className="flex flex-wrap gap-2">
                    {(l.reciboAnexos ?? []).map((url, ri) => (
                      <Button
                        key={ri}
                        variant="outline"
                        size="sm"
                        onClick={() => { setPdfPreviewUrl(url); setPdfPreviewOpen(true); }}
                      >
                        <Paperclip className="h-3.5 w-3.5 mr-1" />
                        Recibo
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar reembolso</DialogTitle>
          </DialogHeader>
          <Textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} placeholder="Motivo (opcional)" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void rejeitar()}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={correcaoOpen} onOpenChange={setCorrecaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar correcção</DialogTitle>
            <DialogDescription>O colaborador poderá corrigir e reenviar o pedido.</DialogDescription>
          </DialogHeader>
          <Textarea value={motivoCorrecao} onChange={e => setMotivoCorrecao(e.target.value)} placeholder="Descreva o que deve ser corrigido" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrecaoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void solicitarCorrecao()}>
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
            <DialogDescription>
              {pagoTarget ? `${pagoTarget.num} — ${formatKz(pagoTarget.montanteTotal)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pagoTarget?.nomeReembolso || pagoTarget?.ibanReembolso ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Titular: </span>
                  {pagoTarget.nomeReembolso?.trim() || '—'}
                </p>
                <p className="font-mono text-xs">
                  <span className="text-muted-foreground font-sans">IBAN: </span>
                  {pagoTarget.ibanReembolso?.trim() ? formatarIbanReembolso(pagoTarget.ibanReembolso) : '—'}
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Conta bancária (empresa)</Label>
              <Select value={pagoContaId} onValueChange={setPagoContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar conta" />
                </SelectTrigger>
                <SelectContent>
                  {contasBancarias
                    .filter(c => c.empresaId === pagoTarget?.empresaId)
                    .map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.numeroConta} — {c.titular}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comprovativo de pagamento</Label>
              <Input
                type="file"
                accept=".pdf,image/*"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void uploadComprovativo(f);
                  e.target.value = '';
                }}
              />
              {comprovativos.map((url, i) => (
                <Button key={i} variant="outline" size="sm" onClick={() => { setPdfPreviewUrl(url); setPdfPreviewOpen(true); }}>
                  Comprovativo {i + 1}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmarPagamento()} disabled={pagoSubmitting}>
              {pagoSubmitting ? 'A processar…' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewDialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen} url={pdfPreviewUrl} iframeTitle="Documento" />
    </div>
  );
}
