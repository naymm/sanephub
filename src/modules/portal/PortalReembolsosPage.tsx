import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import { useNotifications } from '@/context/NotificationContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Paperclip, Eye } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { PdfPreviewDialog } from '@/components/PdfPreviewDialog';
import {
  REEMBOLSO_STATUS_OPTIONS,
  colaboradorPodeEditarReembolso,
  emptyLinhaForm,
  nextReembolsoNum,
  formatarIbanReembolso,
  IBAN_REEMBOLSO_PLACEHOLDER,
  mascaraIbanReembolsoEmEdicao,
  normalizarIbanReembolso,
  sumLinhasMontante,
  tipoReembolsoFromLinhas,
  validarDadosPagamentoReembolso,
  uploadReciboReembolso,
  type ReembolsoLinhaForm,
} from '@/modules/financas/reembolsoUtils';
import type { ReembolsoLinhaInput } from '@/lib/supabaseData';

const LIST_PATH = '/portal/reembolsos';
const NOVO_PATH = '/portal/reembolsos/novo';

function linhasToInput(linhas: ReembolsoLinhaForm[]): ReembolsoLinhaInput[] {
  return linhas.map((l, i) => ({
    ordem: i,
    nomeEntidade: l.nomeEntidade.trim(),
    descricao: l.descricao.trim(),
    montante: l.montante,
    reciboAnexos: l.reciboAnexos,
  }));
}

function linhasFromDb(linhas: ReembolsoLinha[]): ReembolsoLinhaForm[] {
  return [...linhas]
    .sort((a, b) => a.ordem - b.ordem)
    .map(l => ({
      key: String(l.id),
      nomeEntidade: l.nomeEntidade,
      descricao: l.descricao,
      montante: l.montante,
      reciboAnexos: l.reciboAnexos ?? [],
    }));
}

export default function PortalReembolsosPage() {
  const navigate = useNavigate();
  const colaboradorId = useColaboradorId();
  const { reembolsos, reembolsoLinhas, addReembolsoComLinhas, updateReembolso, replaceReembolsoLinhas, colaboradoresTodos } =
    useData();
  const { currentEmpresaId } = useTenant();
  const { addNotification } = useNotifications();

  const [statusFilter, setStatusFilter] = useState<StatusReembolso | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewReembolso, setViewReembolso] = useState<Reembolso | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modo, setModo] = useState<'individual' | 'lote'>('individual');
  const [nomeReembolso, setNomeReembolso] = useState('');
  const [ibanReembolso, setIbanReembolso] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [linhas, setLinhas] = useState<ReembolsoLinhaForm[]>([emptyLinhaForm()]);
  const [saving, setSaving] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const meusReembolsos = useMemo(
    () => (colaboradorId == null ? [] : reembolsos.filter(r => r.solicitanteColaboradorId === colaboradorId)),
    [colaboradorId, reembolsos],
  );

  const filtered = meusReembolsos.filter(r => statusFilter === 'todos' || r.status === statusFilter);
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const linhasPorReembolso = useMemo(() => {
    const m = new Map<number, ReembolsoLinha[]>();
    for (const l of reembolsoLinhas) {
      if (!m.has(l.reembolsoId)) m.set(l.reembolsoId, []);
      m.get(l.reembolsoId)!.push(l);
    }
    return m;
  }, [reembolsoLinhas]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setModo('individual');
    setNomeReembolso('');
    setIbanReembolso('');
    setObservacoes('');
    setLinhas([emptyLinhaForm()]);
  }, []);

  const prepareCreate = useCallback(() => {
    if (colaboradorId == null) {
      navigate(LIST_PATH, { replace: true });
      return;
    }
    resetForm();
  }, [colaboradorId, navigate, resetForm]);

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
    resetModal: resetForm,
  });

  const openCreate = () => {
    if (colaboradorId == null) return;
    openCreateNavigateOrDialog();
  };

  const openEdit = (r: Reembolso) => {
    if (!colaboradorPodeEditarReembolso(r.status)) return;
    setEditingId(r.id);
    setModo(r.tipo === 'lote' ? 'lote' : 'individual');
    setNomeReembolso(r.nomeReembolso ?? '');
    setIbanReembolso(formatarIbanReembolso(r.ibanReembolso ?? ''));
    setObservacoes(r.observacoes ?? '');
    setLinhas(linhasFromDb(linhasPorReembolso.get(r.id) ?? []));
    setDialogOpen(true);
  };

  const validarLinhas = (): boolean => {
    if (linhas.length === 0) {
      toast.error('Adicione pelo menos uma despesa.');
      return false;
    }
    for (const [i, l] of linhas.entries()) {
      if (!l.nomeEntidade.trim()) {
        toast.error(`Linha ${i + 1}: indique o nome da entidade.`);
        return false;
      }
      if (!l.descricao.trim()) {
        toast.error(`Linha ${i + 1}: indique a descrição.`);
        return false;
      }
      if (l.montante <= 0) {
        toast.error(`Linha ${i + 1}: montante inválido.`);
        return false;
      }
      if (l.reciboAnexos.length === 0) {
        toast.error(`Linha ${i + 1}: anexe o recibo/comprovativo.`);
        return false;
      }
    }
    return true;
  };

  const guardar = async () => {
    if (colaboradorId == null) return;
    const erroPagamento = validarDadosPagamentoReembolso(nomeReembolso, ibanReembolso);
    if (erroPagamento) {
      toast.error(erroPagamento);
      return;
    }
    if (!validarLinhas()) return;
    const nomePag = nomeReembolso.trim();
    const ibanPag = normalizarIbanReembolso(ibanReembolso);
    const empresaId =
      typeof currentEmpresaId === 'number'
        ? currentEmpresaId
        : (colaboradoresTodos.find(c => c.id === colaboradorId)?.empresaId ?? 1);
    const montanteTotal = sumLinhasMontante(linhas);
    const tipo = tipoReembolsoFromLinhas(linhas.length);
    setSaving(true);
    try {
      if (editingId != null) {
        await updateReembolso(editingId, {
          tipo,
          montanteTotal,
          nomeReembolso: nomePag,
          ibanReembolso: ibanPag,
          observacoes: observacoes.trim() || undefined,
          status: 'Pendente',
          motivoCorrecao: undefined,
        });
        await replaceReembolsoLinhas(editingId, linhasToInput(linhas));
        toast.success('Reembolso actualizado e reenviado para análise.');
      } else {
        const num = nextReembolsoNum(reembolsos);
        await addReembolsoComLinhas(
          {
            num,
            empresaId,
            tipo,
            status: 'Pendente',
            solicitanteColaboradorId: colaboradorId,
            data: new Date().toISOString().slice(0, 10),
            montanteTotal,
            nomeReembolso: nomePag,
            ibanReembolso: ibanPag,
            observacoes: observacoes.trim() || undefined,
          },
          linhasToInput(linhas),
        );
        addNotification({
          tipo: 'info',
          titulo: 'Pedido de reembolso',
          mensagem: `${num} foi submetido para análise financeira.`,
          moduloOrigem: 'portal',
          destinatarioPerfil: ['Financeiro', 'Admin'],
          link: '/financas/reembolsos',
        });
        toast.success('Pedido de reembolso submetido.');
      }
      setDialogOpen(false);
      resetForm();
      if (isNovoRoute) {
        endMobileCreateFlow();
        navigate(LIST_PATH, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const uploadRecibo = async (index: number, file: File) => {
    try {
      const url = await uploadReciboReembolso(file, editingId ?? Date.now(), index);
      setLinhas(prev =>
        prev.map((l, i) => (i === index ? { ...l, reciboAnexos: [...l.reciboAnexos, url] } : l)),
      );
      toast.success('Recibo anexado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no upload');
    }
  };

  const formContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de pedido</Label>
        <Select
          value={modo}
          onValueChange={v => {
            const m = v as 'individual' | 'lote';
            setModo(m);
            if (m === 'individual') setLinhas(prev => [prev[0] ?? emptyLinhaForm()]);
            else if (linhas.length < 2) setLinhas(prev => [...prev, emptyLinhaForm()]);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Reembolso individual</SelectItem>
            <SelectItem value="lote">Reembolso em lote</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 rounded-lg border border-primary/20 bg-muted/30 p-4">
        <p className="text-sm font-medium">Dados para reembolso</p>
        <p className="text-xs text-muted-foreground">Conta onde deseja receber o valor aprovado.</p>
        <div className="space-y-2">
          <Label>Nome (titular)</Label>
          <Input
            value={nomeReembolso}
            onChange={e => setNomeReembolso(e.target.value)}
            placeholder="Nome completo do titular da conta"
          />
        </div>
        <div className="space-y-2">
          <Label>IBAN</Label>
          <Input
            value={ibanReembolso}
            onChange={e => setIbanReembolso(mascaraIbanReembolsoEmEdicao(e.target.value))}
            placeholder={IBAN_REEMBOLSO_PLACEHOLDER}
            className="font-mono text-sm tracking-wide"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={42}
          />
          <p className="text-xs text-muted-foreground">Formato: grupos de 4 caracteres (ex.: {IBAN_REEMBOLSO_PLACEHOLDER}).</p>
        </div>
      </div>

      {linhas.map((linha, index) => (
        <div key={linha.key} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{modo === 'lote' ? `Despesa ${index + 1}` : 'Despesa'}</span>
            {modo === 'lote' && linhas.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setLinhas(prev => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Nome da entidade</Label>
            <Input
              value={linha.nomeEntidade}
              onChange={e => setLinhas(prev => prev.map((l, i) => (i === index ? { ...l, nomeEntidade: e.target.value } : l)))}
              placeholder="Ex.: Restaurante XYZ"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={linha.descricao}
              onChange={e => setLinhas(prev => prev.map((l, i) => (i === index ? { ...l, descricao: e.target.value } : l)))}
              rows={2}
              placeholder="Motivo da despesa em nome da empresa"
            />
          </div>
          <div className="space-y-2">
            <Label>Montante (Kz)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={linha.montante || ''}
              onChange={e =>
                setLinhas(prev =>
                  prev.map((l, i) => (i === index ? { ...l, montante: Number(e.target.value) || 0 } : l)),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Anexo do recibo</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="file"
                accept=".pdf,image/*"
                className="max-w-xs"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void uploadRecibo(index, f);
                  e.target.value = '';
                }}
              />
              {linha.reciboAnexos.map((url, ri) => (
                <Button key={ri} type="button" variant="outline" size="sm" onClick={() => { setPdfPreviewUrl(url); setPdfPreviewOpen(true); }}>
                  <Paperclip className="h-3.5 w-3.5 mr-1" />
                  Recibo {ri + 1}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ))}

      {modo === 'lote' ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setLinhas(prev => [...prev, emptyLinhaForm()])}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar despesa
        </Button>
      ) : null}

      <div className="space-y-2">
        <Label>Observações (opcional)</Label>
        <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
      </div>

      <div className="text-sm font-medium text-right">
        Total: {formatKz(sumLinhasMontante(linhas))}
      </div>
    </div>
  );

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Pedido de Reembolso</h1>
        <p className="text-muted-foreground text-center py-12">
          Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Pedido de Reembolso</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Novo pedido
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Solicite o reembolso de despesas efectuadas em nome da empresa. Pode submeter um pedido individual ou em lote
        (várias despesas num único pedido).
      </p>

      <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusReembolso | 'todos')}>
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {REEMBOLSO_STATUS_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Nº</th>
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
                <td className="py-3 px-5 capitalize">{r.tipo}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.montanteTotal)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(r.data)}</td>
                <td className="py-3 px-5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-3 px-5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Ações
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setViewReembolso(r); setViewOpen(true); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!colaboradorPodeEditarReembolso(r.status)}
                        onSelect={() => openEdit(r)}
                      >
                        Corrigir / reenviar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
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
            { label: 'Tipo', value: r.tipo },
            { label: 'Montante', value: formatKz(r.montanteTotal) },
            { label: 'Data', value: formatDate(r.data) },
          ]}
          renderActions={r => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setViewReembolso(r); setViewOpen(true); }}>
                Ver
              </Button>
              {colaboradorPodeEditarReembolso(r.status) ? (
                <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                  Corrigir
                </Button>
              ) : null}
            </div>
          )}
        />
      </div>

      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={closeMobileCreate}
          moduleKicker="Portal"
          screenTitle={editingId != null ? 'Corrigir pedido' : 'Novo pedido de reembolso'}
          desktopContentClassName="max-w-lg max-h-[90vh] flex flex-col p-6"
          desktopHeader={mobileCreateDesktopHeader(
            editingId != null ? 'Corrigir pedido' : 'Novo pedido de reembolso',
            'Indique nome e IBAN para reembolso e preencha cada despesa com recibo.',
          )}
          formBody={<div className="overflow-y-auto min-h-0 py-2">{formContent}</div>}
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void guardar()} disabled={saving}>
                {saving ? 'A guardar…' : editingId != null ? 'Reenviar' : 'Submeter'}
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2 border-t border-border/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button variant="outline" className="flex-1" onClick={closeMobileCreate}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={() => void guardar()} disabled={saving}>
                {saving ? 'A guardar…' : editingId != null ? 'Reenviar' : 'Submeter'}
              </Button>
            </div>
          }
        />
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewReembolso?.num}</DialogTitle>
            <DialogDescription>Detalhes do pedido de reembolso</DialogDescription>
          </DialogHeader>
          {viewReembolso ? (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={viewReembolso.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono">{formatKz(viewReembolso.montanteTotal)}</span>
              </div>
              {viewReembolso.nomeReembolso ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Nome (reembolso)</span>
                  <span className="text-right">{viewReembolso.nomeReembolso}</span>
                </div>
              ) : null}
              {viewReembolso.ibanReembolso ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">IBAN</span>
                  <span className="font-mono text-right text-xs">{formatarIbanReembolso(viewReembolso.ibanReembolso)}</span>
                </div>
              ) : null}
              {viewReembolso.motivoCorrecao ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <p className="font-medium">Correcção solicitada</p>
                  <p>{viewReembolso.motivoCorrecao}</p>
                </div>
              ) : null}
              {viewReembolso.motivoRejeicao ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-900">
                  <p className="font-medium">Motivo da rejeição</p>
                  <p>{viewReembolso.motivoRejeicao}</p>
                </div>
              ) : null}
              <div className="space-y-3">
                {(linhasPorReembolso.get(viewReembolso.id) ?? []).map((l, i) => (
                  <div key={l.id} className="rounded-lg border p-3 space-y-1">
                    <p className="font-medium">
                      {viewReembolso.tipo === 'lote' ? `${i + 1}. ` : ''}
                      {l.nomeEntidade}
                    </p>
                    <p className="text-muted-foreground">{l.descricao}</p>
                    <p className="font-mono">{formatKz(l.montante)}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
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
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <PdfPreviewDialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen} url={pdfPreviewUrl} iframeTitle="Recibo" />
    </div>
  );
}
