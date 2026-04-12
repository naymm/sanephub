import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useNotifications } from '@/context/NotificationContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Requisicao, StatusRequisicao } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatKz, formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Plus, Paperclip, Trash2 } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const STATUS_OPTIONS: { value: StatusRequisicao | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Em Análise', label: 'Em Análise' },
  { value: 'Aprovado', label: 'Aprovado' },
  { value: 'Rejeitado', label: 'Rejeitado' },
  { value: 'Enviado à Contabilidade', label: 'Enviado à Contabilidade' },
  { value: 'Pago', label: 'Pago' },
];

const LIST_PATH = '/portal/requisicoes';
const NOVO_PATH = '/portal/requisicoes/novo';

function nextNum(requisicoes: Requisicao[]): string {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  const nums = requisicoes.filter(r => r.num.startsWith(prefix)).map(r => parseInt(r.num.split('-')[2], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export default function PortalRequisicoesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const colaboradorId = useColaboradorId();
  const { requisicoes, addRequisicao, updateRequisicao, centrosCusto, departamentos, colaboradoresTodos, addPagamento } = useData();
  const { currentEmpresaId } = useTenant();
  const { addNotification } = useNotifications();
  const [statusFilter, setStatusFilter] = useState<StatusRequisicao | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewReq, setViewReq] = useState<Requisicao | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    fornecedor: '',
    descricao: '',
    valor: 0,
    departamento: '',
    centroCusto: 'CC-001',
    data: new Date().toISOString().slice(0, 10),
    tipoSolicitacao: 'Factura Proforma' as 'Factura Proforma' | 'Somente factura depois da compra',
    proformaAnexos: [] as string[],
  });

  const minhasRequisicoes = colaboradorId == null
    ? []
    : requisicoes.filter(r => r.requisitanteColaboradorId === colaboradorId);

  const filtered = minhasRequisicoes.filter(r => {
    const matchStatus = statusFilter === 'todos' || r.status === statusFilter;
    return matchStatus;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('num');
  const mobileComparators = useMemo(
    () => ({
      num: (a: Requisicao, b: Requisicao) => a.num.localeCompare(b.num, 'pt', { sensitivity: 'base' }),
      fornecedor: (a: Requisicao, b: Requisicao) => a.fornecedor.localeCompare(b.fornecedor, 'pt', { sensitivity: 'base' }),
      data: (a: Requisicao, b: Requisicao) => a.data.localeCompare(b.data),
      valor: (a: Requisicao, b: Requisicao) => a.valor - b.valor,
    }),
    [],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const prepareCreate = useCallback(() => {
    if (colaboradorId == null) {
      navigate(LIST_PATH, { replace: true });
      return;
    }
    const dept = departamentos.find(d => d.nome === user?.departamento)?.nome ?? departamentos[0]?.nome ?? '';
    setForm({
      fornecedor: '',
      descricao: '',
      valor: 0,
      departamento: dept,
      centroCusto: 'CC-001',
      data: new Date().toISOString().slice(0, 10),
      tipoSolicitacao: 'Factura Proforma',
      proformaAnexos: [],
    });
  }, [colaboradorId, departamentos, navigate, user?.departamento]);

  const resetModal = useCallback(() => {
    setForm({
      fornecedor: '',
      descricao: '',
      valor: 0,
      departamento: '',
      centroCusto: 'CC-001',
      data: new Date().toISOString().slice(0, 10),
      tipoSolicitacao: 'Factura Proforma',
      proformaAnexos: [],
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

  const resolvePublicUrlFromAny = async (value?: string | null): Promise<string | null> => {
    if (!value) return null;
    if (!isSupabaseConfigured() || !supabase) return value.startsWith('http') ? value : null;
    if (!value.startsWith('http')) return null;

    // Se o publicUrl foi guardado com "localhost", extraímos o path dentro do bucket
    // e re-resolvemos para a origem atual do Supabase.
    const m = value.match(/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return value;
    const bucket = m[1] as 'proformas' | 'comprovativos';
    const objectPath = m[2];
    if (bucket !== 'proformas' && bucket !== 'comprovativos') return value;
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return data?.publicUrl ?? value;
  };

  const openPdfPreview = (url?: string | null) => {
    void (async () => {
      const resolved = await resolvePublicUrlFromAny(url);
      if (!resolved) return;
      setPdfPreviewUrl(resolved);
      setPdfPreviewOpen(true);
    })();
  };

  const getFirstUrlValue = (urls?: string[]) => (urls ?? []).filter(u => !!u)[0] ?? null;
  const getLastUrlValue = (urls?: string[]) => {
    const xs = (urls ?? []).filter(u => !!u);
    return xs.length ? xs[xs.length - 1] : null;
  };

  const prazoParaFacturaFinalValido = (r: Requisicao) => {
    if (!r.comprovativoAnexadoEm) return false;
    const ts = new Date(r.comprovativoAnexadoEm).getTime();
    if (Number.isNaN(ts)) return false;
    const diffMs = Date.now() - ts;
    return diffMs >= 0 && diffMs <= 48 * 60 * 60 * 1000;
  };

  const podeAnexarFacturaFinal = (r: Requisicao) =>
    (r.comprovativoAnexos?.length ?? 0) > 0 &&
    (r.facturaFinalAnexos?.length ?? 0) === 0 &&
    prazoParaFacturaFinalValido(r);

  const openCreate = () => {
    if (colaboradorId == null) return;
    openCreateNavigateOrDialog();
  };

  const addProformaAnexo = (nome: string) => {
    if (!nome.trim()) return;
    setForm(f => ({
      ...f,
      proformaAnexos: [...f.proformaAnexos, nome.trim()],
    }));
  };

  const removeProformaAnexo = (index: number) => {
    setForm(f => ({
      ...f,
      proformaAnexos: f.proformaAnexos.filter((_, i) => i !== index),
    }));
  };

  const save = async () => {
    if (colaboradorId == null || !form.fornecedor.trim() || !form.descricao.trim() || form.valor <= 0 || !form.departamento.trim()) return;
    const temProforma = form.tipoSolicitacao === 'Factura Proforma';
    if (temProforma && form.proformaAnexos.length === 0) {
      toast.error('Seleccione e anexe pelo menos uma factura proforma em PDF.');
      return;
    }
    const empresaId = typeof currentEmpresaId === 'number' ? currentEmpresaId : (colaboradoresTodos.find(c => c.id === colaboradorId)?.empresaId ?? 1);
    const proformaAnexos = temProforma ? form.proformaAnexos : [];
    const newNum = nextNum(requisicoes);
    try {
      await addRequisicao({
        num: newNum,
        fornecedor: form.fornecedor.trim(),
        descricao: form.descricao.trim(),
        valor: form.valor,
        departamento: form.departamento,
        centroCusto: form.centroCusto,
        data: form.data,
        status: 'Pendente',
        proforma: temProforma,
        proformaAnexos,
        factura: false,
        facturaFinalAnexos: [],
        comprovante: false,
        comprovativoAnexos: [],
        enviadoContabilidade: false,
        requisitanteColaboradorId: colaboradorId,
        empresaId,
      });
      // Notificar a equipa de Finanças (privacidade: só perfis que têm acesso ao módulo)
      addNotification({
        tipo: 'info',
        titulo: 'Requisição enviada',
        mensagem: `${newNum} foi submetida para análise financeira.`,
        moduloOrigem: 'portal',
        destinatarioPerfil: ['Financeiro', 'Admin'],
        link: '/financas/requisicoes',
      });
      setDialogOpen(false);
      if (isNovoRoute) {
        endMobileCreateFlow();
        navigate(LIST_PATH, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao submeter');
    }
  };

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Requisição à Área Financeira</h1>
        <p className="text-muted-foreground text-center py-12">Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Requisição à Área Financeira</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova Requisição
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Requisições que submeteu à área financeira. Pode criar novas requisições para despesas do seu departamento.</p>

      <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusRequisicao | 'todos')}>
        <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nº</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fornecedor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(r => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{r.num}</td>
                <td className="py-3 px-5 font-medium">{r.fornecedor}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-48 truncate">{r.descricao}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.valor)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(r.data)}</td>
                <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                <td className="py-3 px-5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Ações
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setViewReq(r); setViewOpen(true); }}>
                        Ver
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={(r.proformaAnexos?.length ?? 0) === 0}
                        onSelect={() => {
                          const url = getFirstUrlValue(r.proformaAnexos);
                          if (!url) return;
                          openPdfPreview(url);
                        }}
                      >
                        Proforma
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={(r.comprovativoAnexos?.length ?? 0) === 0}
                        onSelect={() => {
                          const url = getFirstUrlValue(r.comprovativoAnexos);
                          if (!url) return;
                          openPdfPreview(url);
                        }}
                      >
                        Comprovativo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={(r.facturaFinalAnexos?.length ?? 0) === 0}
                        onSelect={() => {
                          const url = getLastUrlValue(r.facturaFinalAnexos);
                          if (!url) return;
                          openPdfPreview(url);
                        }}
                      >
                        Factura Final
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!podeAnexarFacturaFinal(r)}
                        onSelect={() => {
                          setViewReq(r);
                          setViewOpen(true);
                        }}
                      >
                        Anexar Factura Final
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
          items={sortedMobileRows}
          rowId={r => r.id}
          sortBar={{
            options: [
              { key: 'num', label: 'Nº' },
              { key: 'fornecedor', label: 'Fornecedor' },
              { key: 'valor', label: 'Valor' },
              { key: 'data', label: 'Data' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={r => ({
            title: r.num,
            trailing: <StatusBadge status={r.status} />,
          })}
          renderDetails={r => [
            { label: 'Fornecedor', value: r.fornecedor },
            { label: 'Descrição', value: r.descricao },
            { label: 'Valor', value: formatKz(r.valor) },
            { label: 'Data', value: formatDate(r.data) },
            { label: 'Status', value: <StatusBadge status={r.status} /> },
          ]}
          renderActions={r => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-11">
                  Ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => { setViewReq(r); setViewOpen(true); }}>
                  Ver
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={(r.proformaAnexos?.length ?? 0) === 0}
                  onSelect={() => {
                    const url = getFirstUrlValue(r.proformaAnexos);
                    if (!url) return;
                    openPdfPreview(url);
                  }}
                >
                  Proforma
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={(r.comprovativoAnexos?.length ?? 0) === 0}
                  onSelect={() => {
                    const url = getFirstUrlValue(r.comprovativoAnexos);
                    if (!url) return;
                    openPdfPreview(url);
                  }}
                >
                  Comprovativo
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={(r.facturaFinalAnexos?.length ?? 0) === 0}
                  onSelect={() => {
                    const url = getLastUrlValue(r.facturaFinalAnexos);
                    if (!url) return;
                    openPdfPreview(url);
                  }}
                >
                  Factura Final
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!podeAnexarFacturaFinal(r)}
                  onSelect={() => {
                    setViewReq(r);
                    setViewOpen(true);
                  }}
                >
                  Anexar Factura Final
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma requisição encontrada.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={closeMobileCreate}
          moduleKicker="Portal"
          screenTitle="Nova requisição à Área Financeira"
          desktopContentClassName="max-w-lg max-h-[90vh] flex flex-col p-6"
          desktopHeader={mobileCreateDesktopHeader(
            'Nova requisição à Área Financeira',
            'Preencha os dados. A requisição será analisada pela equipa financeira.',
          )}
          formBody={
            <div className="grid gap-4 py-2 overflow-y-auto min-h-0">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição da despesa" />
            </div>
            <div className="space-y-2">
              <Label>Valor (Kz)</Label>
              <Input type="number" min={0} value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={form.departamento || undefined} onValueChange={v => setForm(f => ({ ...f, departamento: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar departamento" /></SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {departamentos.map(d => (
                    <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de custo</Label>
              <Select value={form.centroCusto} onValueChange={v => setForm(f => ({ ...f, centroCusto: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {centrosCusto.map(cc => (
                    <SelectItem key={cc.id} value={cc.codigo}>{cc.codigo} — {cc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de factura</Label>
              <Select value={form.tipoSolicitacao} onValueChange={v => setForm(f => ({ ...f, tipoSolicitacao: v as typeof f.tipoSolicitacao }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  <SelectItem value="Factura Proforma">Factura Proforma</SelectItem>
                  <SelectItem value="Somente factura depois da compra">Somente factura depois da compra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 border-t border-border/80 pt-4">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Facturas proforma anexadas
              </Label>

              {(form.proformaAnexos ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(form.proformaAnexos ?? []).map((urlOuNome, i) => {
                    const displayName = urlOuNome.startsWith('http')
                      ? urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome
                      : urlOuNome;
                    return (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        {urlOuNome.startsWith('http') ? (
                          <a
                            href={urlOuNome}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-primary underline hover:no-underline"
                          >
                            {displayName}
                          </a>
                        ) : (
                          <span className="truncate">{displayName}</span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeProformaAnexo(i)}
                          aria-label="Remover anexo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {(form.tipoSolicitacao === 'Factura Proforma' || (form.proformaAnexos ?? []).length > 0) && (
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="cursor-pointer file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!isSupabaseConfigured() || !supabase) {
                      toast.error('Upload requer Supabase configurado.');
                      return;
                    }
                    try {
                      const ext = file.name.split('.').pop() || 'pdf';
                      const path = `requisicoes/proformas/portal-proforma-${Date.now()}.${ext}`;
                      const { data, error } = await supabase.storage.from('proformas').upload(path, file, { upsert: true });
                      if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar proforma');
                      const { data: pub } = supabase.storage.from('proformas').getPublicUrl(data.path);
                      addProformaAnexo(pub.publicUrl);
                      e.target.value = '';
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Não foi possível carregar a proforma.');
                    }
                  }}
                />
              )}
            </div>
          </div>
          }
          desktopFooter={
            <DialogFooter className="shrink-0 border-t border-border/80 pt-4 mt-2">
              <Button variant="outline" onClick={() => onDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void save()}
                disabled={
                  !form.fornecedor.trim() ||
                  !form.descricao.trim() ||
                  form.valor <= 0 ||
                  !form.departamento.trim() ||
                  (form.tipoSolicitacao === 'Factura Proforma' && form.proformaAnexos.length === 0)
                }
              >
                Submeter
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
                  !form.fornecedor.trim() ||
                  !form.descricao.trim() ||
                  form.valor <= 0 ||
                  !form.departamento.trim() ||
                  (form.tipoSolicitacao === 'Factura Proforma' && form.proformaAnexos.length === 0)
                }
                onClick={() => void save()}
              >
                Submeter
              </Button>
            </div>
          }
        />
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Requisição — {viewReq?.num}</DialogTitle>
            <DialogDescription>Detalhe da requisição</DialogDescription>
          </DialogHeader>
          {viewReq && (
            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <p><span className="text-muted-foreground">Fornecedor:</span> {viewReq.fornecedor}</p>
                <p><span className="text-muted-foreground">Descrição:</span> {viewReq.descricao}</p>
                <p><span className="text-muted-foreground">Valor:</span> {formatKz(viewReq.valor)}</p>
                <p><span className="text-muted-foreground">Departamento:</span> {viewReq.departamento}</p>
                <p><span className="text-muted-foreground">Centro de custo:</span> {viewReq.centroCusto}</p>
                <p><span className="text-muted-foreground">Data:</span> {formatDate(viewReq.data)}</p>
                <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewReq.status} /></p>
              </div>

              {(viewReq.proformaAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Factura(s) proforma anexada(s):</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(viewReq.proformaAnexos ?? []).map((urlOuNome, i) => (
                      <li key={i}>
                        {urlOuNome.startsWith('http') ? (
                          <button
                            type="button"
                            className="text-primary underline hover:no-underline"
                            onClick={() => openPdfPreview(urlOuNome)}
                          >
                            {urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome}
                          </button>
                        ) : (
                          urlOuNome
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(viewReq.comprovativoAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Comprovativo(s) de pagamento:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(viewReq.comprovativoAnexos ?? []).map((urlOuNome, i) => (
                      <li key={i}>
                        {urlOuNome.startsWith('http') ? (
                          <button
                            type="button"
                            className="text-primary underline hover:no-underline"
                            onClick={() => openPdfPreview(urlOuNome)}
                          >
                            {urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome}
                          </button>
                        ) : (
                          urlOuNome
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(viewReq.facturaFinalAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Factura final anexada:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(viewReq.facturaFinalAnexos ?? []).map((urlOuNome, i) => (
                      <li key={i}>
                        {urlOuNome.startsWith('http') ? (
                          <button
                            type="button"
                            className="text-primary underline hover:no-underline"
                            onClick={() => openPdfPreview(urlOuNome)}
                          >
                            {urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome}
                          </button>
                        ) : (
                          urlOuNome
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {viewReq.motivoRejeicao && (
                <p><span className="text-muted-foreground">Motivo rejeição:</span> {viewReq.motivoRejeicao}</p>
              )}

              {viewReq.comprovante && (viewReq.facturaFinalAnexos ?? []).length === 0 && (
                <div className="space-y-2 border-t border-border/80 pt-3">
                  <Label>Factura final (até 48h após comprovativo)</Label>
                  {!prazoParaFacturaFinalValido(viewReq) ? (
                    <p className="text-xs text-destructive">
                      O prazo de 48h para anexar a factura final expirou.
                    </p>
                  ) : (
                    <Input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!isSupabaseConfigured() || !supabase) {
                          toast.error('Upload requer Supabase configurado.');
                          return;
                        }
                        try {
                          const ext = file.name.split('.').pop() || 'pdf';
                          const path = `requisicoes/factura-final/req-${viewReq.id}-${Date.now()}.${ext}`;
                          const { data, error } = await supabase.storage.from('proformas').upload(path, file, { upsert: true });
                          if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar factura final');
                          const { data: pub } = supabase.storage.from('proformas').getPublicUrl(data.path);

                          const hoje = new Date().toISOString().slice(0, 10);
                          const updated = await updateRequisicao(viewReq.id, {
                            factura: true,
                            facturaFinalAnexos: [pub.publicUrl],
                            status: 'Pago',
                            comprovante: true,
                            dataPagamento: hoje,
                          });

                          const referenciaAuto = `PAG-${new Date().getFullYear()}-${String(viewReq.id).padStart(4, '0')}`;
                          await addPagamento({
                            requisicaoId: viewReq.id,
                            referencia: referenciaAuto,
                            beneficiario: viewReq.fornecedor,
                            valor: viewReq.valor,
                            dataPagamento: hoje,
                            metodoPagamento: 'Transferência',
                            status: 'Recebido',
                            registadoPor: user?.nome ?? 'Sistema',
                            registadoEm: hoje,
                          });

                          toast.success('Factura final anexada. Requisição concluída.');
                          // Notificar Contabilidade: agora existe um registo de Pagamento recebido
                          addNotification({
                            tipo: 'sucesso',
                            titulo: 'Pagamento recebido',
                            mensagem: `O pagamento associado à ${viewReq.num} foi registado.`,
                            moduloOrigem: 'portal',
                            destinatarioPerfil: ['Contabilidade', 'Financeiro', 'Admin'],
                            link: '/contabilidade/pagamentos',
                          });
                          setViewReq(updated);
                          setViewOpen(false);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Não foi possível anexar a factura final.');
                        } finally {
                          e.target.value = '';
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de pré-visualização de PDFs */}
      <Dialog
        open={pdfPreviewOpen}
        onOpenChange={open => {
          setPdfPreviewOpen(open);
          if (!open) setPdfPreviewUrl(null);
        }}
      >
        <DialogContent className="max-w-[90vw] w-full h-[95vh] p-0">
          {pdfPreviewUrl ? (
            <div className="w-full h-full">
              <iframe
                src={pdfPreviewUrl}
                title="Pré-visualização do documento"
                className="w-full h-full border-0 rounded-md"
              />
            </div>
          ) : (
            <DialogDescription>Gerando pré-visualização...</DialogDescription>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
