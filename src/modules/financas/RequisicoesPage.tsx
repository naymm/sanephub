import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { useTenant } from '@/context/TenantContext';
import { hasModuleAccess, useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Requisicao, StatusRequisicao, Pagamento } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatKz, formatDate } from '@/utils/formatters';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Search, Plus, Pencil, Eye, Check, X, Send, Banknote, Paperclip, Trash2, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const STATUS_OPTIONS: { value: StatusRequisicao | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Em Análise', label: 'Em Análise' },
  { value: 'Aprovado', label: 'Aprovado' },
  { value: 'Rejeitado', label: 'Rejeitado' },
  { value: 'Enviado à Contabilidade', label: 'Enviado à Contabilidade' },
  { value: 'Pago', label: 'Pago' },
];

const emptyRequisicao: Omit<Requisicao, 'id' | 'num' | 'empresaId'> = {
  fornecedor: '',
  descricao: '',
  valor: 0,
  departamento: 'Administrativo',
  centroCusto: 'CC-001',
  data: new Date().toISOString().slice(0, 10),
  status: 'Pendente',
  proforma: false,
  proformaAnexos: [],
  factura: false,
  facturaFinalAnexos: [],
  comprovante: false,
  enviadoContabilidade: false,
};

function nextNum(requisicoes: Requisicao[]): string {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  const nums = requisicoes.filter(r => r.num.startsWith(prefix)).map(r => parseInt(r.num.split('-')[2], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export default function RequisicoesPage() {
  const { user } = useAuth();
  const { requisicoes, addRequisicao, updateRequisicao, centrosCusto, empresas, departamentos, addPagamento, colaboradoresTodos } = useData();
  const { currentEmpresaId } = useTenant();
  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;
  const canAccessFinancas = hasModuleAccess(user, 'financas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusRequisicao | 'todos'>('todos');
  const [centroFilter, setCentroFilter] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Requisicao | null>(null);
  const [viewReq, setViewReq] = useState<Requisicao | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [viewInlinePdfUrl, setViewInlinePdfUrl] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Requisicao, 'id' | 'num'>>(() => ({
    ...emptyRequisicao,
    empresaId: typeof empresaIdForNew === 'number' ? empresaIdForNew : 1,
  }));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReq, setRejectReq] = useState<Requisicao | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [valorInput, setValorInput] = useState('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [reqParaPago, setReqParaPago] = useState<Requisicao | null>(null);
  const [facturaFinalAnexos, setFacturaFinalAnexos] = useState<string[]>([]);
  const [comprovativoDialogFromApprove, setComprovativoDialogFromApprove] = useState(false);
  const [novoFacturaFinalNome, setNovoFacturaFinalNome] = useState('');

  const resolvePublicUrl = async (bucket: 'proformas' | 'comprovativos', value: string): Promise<string | null> => {
    if (!value) return null;
    if (value.startsWith('http')) return value;
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(value);
    return data?.publicUrl ?? null;
  };

  const getFirstTruthy = (arr?: string[]) => (arr ?? []).find(v => !!v) ?? null;
  const getLastTruthy = (arr?: string[]) => {
    const xs = (arr ?? []).filter(v => !!v);
    return xs.length ? xs[xs.length - 1] : null;
  };

  const filtered = requisicoes.filter(r => {
    const matchSearch =
      r.num.toLowerCase().includes(search.toLowerCase()) ||
      r.fornecedor.toLowerCase().includes(search.toLowerCase()) ||
      r.descricao.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || r.status === statusFilter;
    const matchCentro = centroFilter === 'todos' || r.centroCusto === centroFilter;
    let matchDate = true;
    if (dataInicio) matchDate = matchDate && r.data >= dataInicio;
    if (dataFim) matchDate = matchDate && r.data <= dataFim;
    return matchSearch && matchStatus && matchCentro && matchDate;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyRequisicao,
      empresaId: typeof empresaIdForNew === 'number' ? empresaIdForNew : 1,
      data: new Date().toISOString().slice(0, 10),
    });
    setValorInput('');
    setDialogOpen(true);
  };

  const openEdit = (r: Requisicao) => {
    setEditing(r);
    setForm({
      empresaId: r.empresaId,
      fornecedor: r.fornecedor,
      nifFornecedor: r.nifFornecedor,
      descricao: r.descricao,
      quantidade: r.quantidade,
      valorUnitario: r.valorUnitario,
      valor: r.valor,
      departamento: r.departamento,
      centroCusto: r.centroCusto,
      projecto: r.projecto,
      data: r.data,
      status: r.status,
      proforma: r.proforma,
      proformaAnexos: r.proformaAnexos ?? [],
      factura: r.factura,
      facturaFinalAnexos: r.facturaFinalAnexos ?? [],
      comprovante: r.comprovante,
      enviadoContabilidade: r.enviadoContabilidade,
      motivoRejeicao: r.motivoRejeicao,
      aprovadoPor: r.aprovadoPor,
      dataPagamento: r.dataPagamento,
      observacoes: r.observacoes,
    });
    setValorInput(r.valor ? String(r.valor) : '');
    setDialogOpen(true);
  };

  const addProformaAnexo = (url: string) => {
    if (!url.trim()) return;
    setForm(f => ({
      ...f,
      proformaAnexos: [...(f.proformaAnexos ?? []), url.trim()],
      proforma: true,
    }));
  };

  const removeProformaAnexo = (index: number) => {
    setForm(f => {
      const next = (f.proformaAnexos ?? []).filter((_, i) => i !== index);
      return { ...f, proformaAnexos: next, proforma: next.length > 0 };
    });
  };

  const uploadProformaFile = async (file: File) => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Upload de proforma requer Supabase configurado.');
      return;
    }
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const baseId = editing?.id ?? Date.now();
      const path = `requisicoes/proformas/req-${baseId}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('proformas').upload(path, file, { upsert: true });
      if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar proforma');
      const { data: pub } = supabase.storage.from('proformas').getPublicUrl(data.path);
      addProformaAnexo(pub.publicUrl);
      toast.success('Proforma anexada com sucesso.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar a proforma.');
    }
  };

  const openPagoDialog = (r: Requisicao) => {
    setReqParaPago(r);
    // Neste fluxo, o diálogo é para anexar o comprovativo.
    // Guardamos os URLs em comprovativoAnexos (no estado reutilizamos facturaFinalAnexos para evitar refactor grande).
    setFacturaFinalAnexos(r.comprovativoAnexos ?? []);
    setNovoFacturaFinalNome('');
    setPagoDialogOpen(true);
  };

  const uploadComprovativoFile = async (file: File) => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Upload de comprovativo requer Supabase configurado.');
      return;
    }
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const reqId = reqParaPago?.id ?? Date.now();
      const path = `requisicoes/comprovativos/req-${reqId}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('comprovativos').upload(path, file, { upsert: true });
      if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar comprovativo');
      const { data: pub } = supabase.storage.from('comprovativos').getPublicUrl(data.path);
      setFacturaFinalAnexos(prev => [...prev, pub.publicUrl]);
      toast.success('Comprovativo anexado com sucesso.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar o comprovativo.');
    }
  };

  const removeFacturaFinalAnexo = (index: number) => {
    setFacturaFinalAnexos(prev => prev.filter((_, i) => i !== index));
  };

  const addFacturaFinalAnexoForm = (fileName: string) => {
    if (!fileName.trim()) return;
    setForm(f => ({
      ...f,
      facturaFinalAnexos: [...(f.facturaFinalAnexos ?? []), fileName.trim()],
    }));
  };

  const removeFacturaFinalAnexoForm = (index: number) => {
    setForm(f => ({
      ...f,
      facturaFinalAnexos: (f.facturaFinalAnexos ?? []).filter((_, i) => i !== index),
    }));
  };

  const guardarComprovativo = async () => {
    if (!reqParaPago || facturaFinalAnexos.length === 0) return;
    try {
      await updateRequisicao(reqParaPago.id, {
        comprovante: true,
        comprovativoAnexos: facturaFinalAnexos,
        comprovativoAnexadoEm: new Date().toISOString(),
      });
      toast.success('Comprovativo guardado.');
      setPagoDialogOpen(false);
      setReqParaPago(null);
      setFacturaFinalAnexos([]);
      setComprovativoDialogFromApprove(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar comprovativo');
    }
  };

  const confirmarPago = async () => {
    if (!reqParaPago || facturaFinalAnexos.length === 0) return;
    try {
      const hoje = new Date().toISOString().slice(0, 10);

      // 1) Actualizar requisição para Pago (mantendo a lógica de factura/comprovante)
      await updateRequisicao(reqParaPago.id, {
        status: 'Pago',
        factura: true,
        facturaFinalAnexos,
        comprovante: true,
        dataPagamento: hoje,
      });

      // 2) Criar automaticamente um registo em Pagamentos (Pagamentos Recebidos)
      const referenciaAuto = `PAG-${new Date().getFullYear()}-${String(reqParaPago.id).padStart(4, '0')}`;
      await addPagamento({
        requisicaoId: reqParaPago.id,
        referencia: referenciaAuto,
        beneficiario: reqParaPago.fornecedor,
        valor: reqParaPago.valor,
        dataPagamento: hoje,
        metodoPagamento: 'Transferência' as Pagamento['metodoPagamento'],
        status: 'Recebido',
        registadoPor: user?.nome ?? '',
        registadoEm: hoje,
      });
      setPagoDialogOpen(false);
      setReqParaPago(null);
      setFacturaFinalAnexos([]);
      setComprovativoDialogFromApprove(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registar pagamento');
    }
  };

  const openView = (r: Requisicao) => {
    setViewReq(r);
    setViewOpen(true);
  };

  const save = async () => {
    if (!form.fornecedor.trim() || !form.descricao.trim() || form.valor <= 0) return;
    try {
      if (editing) {
        await updateRequisicao(editing.id, form);
      } else {
        await addRequisicao({ ...form, empresaId: empresaIdForNew, num: nextNum(requisicoes) });
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const aprovar = async (r: Requisicao) => {
    try {
      await updateRequisicao(r.id, { status: 'Aprovado', aprovadoPor: user?.nome });
      setComprovativoDialogFromApprove(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aprovar');
    }
  };

  const rejeitar = async () => {
    if (!rejectReq) return;
    try {
      await updateRequisicao(rejectReq.id, { status: 'Rejeitado', motivoRejeicao: motivoRejeicao.trim() || undefined });
      setRejectOpen(false);
      setRejectReq(null);
      setMotivoRejeicao('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao rejeitar');
    }
  };

  const enviarContabilidade = async (r: Requisicao) => {
    try {
      await updateRequisicao(r.id, { status: 'Enviado à Contabilidade', enviadoContabilidade: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar');
    }
  };

  const temFacturaFinal = (r: Requisicao) => (r.facturaFinalAnexos?.length ?? 0) >= 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Requisições</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova Requisição
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusRequisicao | 'todos')}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={centroFilter} onValueChange={setCentroFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Centro de Custo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {centrosCusto.map(cc => (
              <SelectItem key={cc.id} value={cc.codigo}>{cc.codigo} — {cc.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px] h-9" placeholder="De" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px] h-9" placeholder="Até" />
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nº</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fornecedor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Centro Custo</th>
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
                <td className="py-3 px-5 text-muted-foreground">{r.centroCusto}</td>
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
                      <DropdownMenuItem onSelect={() => openView(r)}>
                        Ver
                      </DropdownMenuItem>
                      {(user?.perfil === 'Admin' || user?.perfil === 'Financeiro') && (
                        <DropdownMenuItem onSelect={() => openEdit(r)}>
                          Editar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={!(r.status === 'Pendente' && (user?.perfil === 'Admin' || user?.perfil === 'Financeiro'))}
                        onSelect={() => aprovar(r)}
                      >
                        Aceitar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!(r.status === 'Pendente' && (user?.perfil === 'Admin' || user?.perfil === 'Financeiro'))}
                        onSelect={() => {
                          setRejectReq(r);
                          setRejectOpen(true);
                        }}
                      >
                        Rejeitar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canAccessFinancas || (getFirstTruthy(r.proformaAnexos) == null)}
                        onSelect={() => {
                          const candidate = getFirstTruthy(r.proformaAnexos);
                          if (!candidate) {
                            toast.error('Nenhuma factura proforma em PDF anexada para pré-visualizar.');
                            return;
                          }
                          void (async () => {
                            try {
                              const url = await resolvePublicUrl('proformas', candidate);
                              if (!url) {
                                toast.error('Não foi possível resolver a pré-visualização da proforma.');
                                return;
                              }
                              setPdfPreviewUrl(url);
                              setPdfPreviewOpen(true);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Erro ao pré-visualizar proforma');
                            }
                          })();
                        }}
                      >
                        Proforma
                      </DropdownMenuItem>
                      {(user?.perfil === 'Admin' || user?.perfil === 'Financeiro') && r.status === 'Aprovado' && (
                        <DropdownMenuItem
                          onSelect={() => openPagoDialog(r)}
                          disabled={(r.comprovativoAnexos?.length ?? 0) > 0}
                        >
                          Fazer pagamento
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={
                          !canAccessFinancas ||
                          (getFirstTruthy(r.comprovativoAnexos) == null && getFirstTruthy(r.facturaFinalAnexos) == null)
                        }
                        onSelect={() => {
                          const candidate = getFirstTruthy(r.comprovativoAnexos) ?? getFirstTruthy(r.facturaFinalAnexos);
                          if (!candidate) {
                            toast.error('Nenhum comprovativo em PDF anexado para pré-visualizar.');
                            return;
                          }
                          void (async () => {
                            try {
                              const url = await resolvePublicUrl('comprovativos', candidate);
                              if (!url) {
                                toast.error('Não foi possível resolver a pré-visualização do comprovativo.');
                                return;
                              }
                              setPdfPreviewUrl(url);
                              setPdfPreviewOpen(true);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Erro ao pré-visualizar comprovativo');
                            }
                          })();
                        }}
                      >
                        Comprovativo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={getLastTruthy(r.facturaFinalAnexos) == null}
                        onSelect={() => {
                          const candidate = getLastTruthy(r.facturaFinalAnexos);
                          if (!candidate) {
                            toast.error('Nenhuma factura final em PDF anexada para pré-visualizar.');
                            return;
                          }
                          void (async () => {
                            try {
                              const url = await resolvePublicUrl('proformas', candidate);
                              if (!url) {
                                toast.error('Não foi possível resolver a pré-visualização da factura final.');
                                return;
                              }
                              setPdfPreviewUrl(url);
                              setPdfPreviewOpen(true);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Erro ao pré-visualizar factura final');
                            }
                          })();
                        }}
                      >
                        Factura Final
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma requisição encontrada.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar requisição' : 'Nova requisição'}</DialogTitle>
            <DialogDescription>Preencha os dados da requisição de despesa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
              </div>
              <div className="space-y-2">
                <Label>NIF Fornecedor</Label>
                <Input value={form.nifFornecedor ?? ''} onChange={e => setForm(f => ({ ...f, nifFornecedor: e.target.value || undefined }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição da despesa" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (Kz)</Label>
                <Input
                  inputMode="decimal"
                  value={valorInput}
                  onChange={e => {
                    // Permitir apenas dígitos e vírgula no input visível
                    const raw = e.target.value.replace(/[^\d,]/g, '');
                    setValorInput(raw);
                    // Converter para número usando ponto como separador decimal
                    const normalized = raw.replace(',', '.');
                    const num = normalized ? Number(normalized) : 0;
                    setForm(f => ({ ...f, valor: Number.isNaN(num) ? 0 : num }));
                  }}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Popover open={deptOpen} onOpenChange={setDeptOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={deptOpen}
                      className="w-full justify-between font-normal"
                    >
                      {form.departamento || 'Seleccionar departamento'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar departamento..." />
                      <CommandList>
                        <CommandEmpty>Nenhum departamento encontrado.</CommandEmpty>
                        <CommandGroup>
                          {departamentos.map(d => (
                            <CommandItem
                              key={d.id}
                              value={d.nome}
                              onSelect={() => {
                                setForm(f => ({ ...f, departamento: d.nome }));
                                setDeptOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  form.departamento === d.nome ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {d.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Select value={form.centroCusto} onValueChange={v => setForm(f => ({ ...f, centroCusto: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {centrosCusto.map(cc => (
                      <SelectItem key={cc.id} value={cc.codigo}>{cc.codigo} — {cc.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Anexar facturas proforma — visível em criar e editar; colocado aqui para aparecer sem scroll em Nova requisição */}
            <div className="space-y-2 border-t border-border/80 pt-4">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Facturas proforma anexadas
              </Label>
              {(form.proformaAnexos ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(form.proformaAnexos ?? []).map((urlOuNome, i) => {
                    const displayName = urlOuNome.startsWith('http') ? urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome : urlOuNome;
                    return (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        {urlOuNome.startsWith('http') ? (
                          <a href={urlOuNome} target="_blank" rel="noopener noreferrer" className="truncate text-primary underline hover:no-underline">{displayName}</a>
                        ) : (
                          <span className="truncate">{displayName}</span>
                        )}
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeProformaAnexo(i)} aria-label="Remover anexo">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Input
                type="file"
                accept=".pdf,application/pdf"
                className="cursor-pointer file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    uploadProformaFile(file);
                    e.target.value = '';
                  }
                }}
              />
            </div>

            {editing && (
              <div className="space-y-2">
                <Label>Projecto (opcional)</Label>
                <Input value={form.projecto ?? ''} onChange={e => setForm(f => ({ ...f, projecto: e.target.value || undefined }))} />
              </div>
            )}

            {/* Factura final — apenas em edição e quando Aprovado ou Pago */}
            {editing && (form.status === 'Aprovado' || form.status === 'Pago') && (
              <div className="space-y-2 border-t border-border/80 pt-4">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Factura final anexada
                </Label>
                <p className="text-xs text-muted-foreground">Obrigatório para enviar à Contabilidade e marcar como pago.</p>
                {(form.facturaFinalAnexos ?? []).length > 0 && (
                  <ul className="space-y-1.5">
                    {(form.facturaFinalAnexos ?? []).map((nome, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        <span className="truncate">{nome}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeFacturaFinalAnexoForm(i)} aria-label="Remover anexo">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do ficheiro (ex: factura_final.pdf)"
                    value={novoFacturaFinalNome}
                    onChange={e => setNovoFacturaFinalNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFacturaFinalAnexoForm(novoFacturaFinalNome); setNovoFacturaFinalNome(''); } }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { addFacturaFinalAnexoForm(novoFacturaFinalNome); setNovoFacturaFinalNome(''); }}
                    disabled={!novoFacturaFinalNome.trim()}
                  >
                    Adicionar
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-8"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { addFacturaFinalAnexoForm(file.name); e.target.value = ''; }
                    }}
                  />
                  <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 py-2 text-xs text-muted-foreground pointer-events-none">
                    <Paperclip className="h-3.5 w-3.5" /> ou clique para seleccionar ficheiro
                  </div>
                </div>
              </div>
            )}

            {editing && (
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox checked={form.proforma} onCheckedChange={c => setForm(f => ({ ...f, proforma: !!c }))} />
                  <span className="text-sm">Proforma recebida</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={form.factura} onCheckedChange={c => setForm(f => ({ ...f, factura: !!c }))} />
                  <span className="text-sm">Factura</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={form.comprovante} onCheckedChange={c => setForm(f => ({ ...f, comprovante: !!c }))} />
                  <span className="text-sm">Comprovante</span>
                </label>
              </div>
            )}
            {editing && (
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes ?? ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value || undefined }))} rows={2} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.fornecedor.trim() || !form.descricao.trim() || form.valor <= 0}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ver */}
      <Dialog
        open={viewOpen}
        onOpenChange={open => {
          setViewOpen(open);
          if (!open) {
            setViewInlinePdfUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewReq?.num}</DialogTitle>
            <DialogDescription>Detalhe da requisição</DialogDescription>
          </DialogHeader>
          {viewReq && (
            viewInlinePdfUrl ? (
              <div className="w-full h-[70vh]">
                <iframe
                  src={viewInlinePdfUrl}
                  title="Pré-visualização do PDF"
                  className="w-full h-full border-0 rounded-md"
                />
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="outline" onClick={() => setViewInlinePdfUrl(null)}>
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Fornecedor:</span> {viewReq.fornecedor}</p>
              <p><span className="text-muted-foreground">Descrição:</span> {viewReq.descricao}</p>
              <p><span className="text-muted-foreground">Valor:</span> {formatKz(viewReq.valor)}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewReq.data)}</p>
              <p><span className="text-muted-foreground">Departamento:</span> {viewReq.departamento}</p>
              <p><span className="text-muted-foreground">Centro de Custo:</span> {viewReq.centroCusto}</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Documentos:</span>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-md border',
                    viewReq.proforma
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  Proforma {viewReq.proforma ? 'Sim' : 'Não'}
                </span>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-md border',
                    viewReq.factura
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  Factura {viewReq.factura ? 'Sim' : 'Não'}
                </span>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-md border',
                    viewReq.comprovante
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  Comprovante {viewReq.comprovante ? 'Sim' : 'Não'}
                </span>
              </p>
              {(viewReq.proformaAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Facturas proforma anexadas:</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {(viewReq.proformaAnexos ?? []).map((urlOuNome, i) => {
                      const displayName = urlOuNome.startsWith('http') ? urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome : urlOuNome;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            className="text-primary underline hover:no-underline"
                            onClick={() => {
                              void (async () => {
                                const resolved = await resolvePublicUrl('proformas', urlOuNome);
                                if (resolved) setViewInlinePdfUrl(resolved);
                                else toast.error('Não foi possível pré-visualizar a proforma.');
                              })();
                            }}
                          >
                            {displayName}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {(viewReq.comprovativoAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Comprovativo(s) anexado(s):</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {(viewReq.comprovativoAnexos ?? []).map((urlOuNome, i) => {
                      const displayName = urlOuNome.startsWith('http') ? urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome : urlOuNome;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            className="text-primary underline hover:no-underline"
                            onClick={() => {
                              void (async () => {
                                const resolved = await resolvePublicUrl('comprovativos', urlOuNome);
                                if (resolved) setViewInlinePdfUrl(resolved);
                                else toast.error('Não foi possível pré-visualizar o comprovativo.');
                              })();
                            }}
                          >
                            {displayName}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {(viewReq.facturaFinalAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Factura final anexada:</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {(viewReq.facturaFinalAnexos ?? []).map((urlOuNome, i) => {
                      const displayName = urlOuNome.startsWith('http') ? urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome : urlOuNome;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            className="text-primary underline hover:no-underline"
                            onClick={() => {
                              void (async () => {
                                const resolved = await resolvePublicUrl('proformas', urlOuNome);
                                if (resolved) setViewInlinePdfUrl(resolved);
                                else toast.error('Não foi possível pré-visualizar a factura final.');
                              })();
                            }}
                          >
                            {displayName}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <p>
                <span className="text-muted-foreground">Requisitante:</span>{' '}
                {colaboradoresTodos.find(c => c.id === viewReq.requisitanteColaboradorId)?.nome ?? '—'}
              </p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewReq.status} /></p>
              {viewReq.motivoRejeicao && <p><span className="text-muted-foreground">Motivo rejeição:</span> {viewReq.motivoRejeicao}</p>}
            </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Rejeitar com motivo */}
      <Dialog open={rejectOpen} onOpenChange={open => { if (!open) { setRejectReq(null); setMotivoRejeicao(''); } setRejectOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar requisição</DialogTitle>
            <DialogDescription>Indique o motivo da rejeição (opcional).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} placeholder="Motivo da rejeição..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={rejeitar}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Marcar como Pago / Anexar factura final / Comprovativo */}
      <Dialog open={pagoDialogOpen} onOpenChange={open => { if (!open) { setReqParaPago(null); setFacturaFinalAnexos([]); setComprovativoDialogFromApprove(false); } setPagoDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reqParaPago?.status === 'Pago'
                ? 'Anexar factura final'
                : comprovativoDialogFromApprove || reqParaPago?.status === 'Aprovado'
                ? 'Comprovativo de pagamento e conclusão'
                : 'Marcar como pago'}
            </DialogTitle>
            <DialogDescription>
              {reqParaPago?.status === 'Pago'
                ? 'Anexe a factura final desta requisição já paga.'
                : comprovativoDialogFromApprove || reqParaPago?.status === 'Aprovado'
                ? 'Anexe o comprovativo de pagamento e conclusão. Pode guardar agora e marcar como pago mais tarde.'
                : 'Anexe pelo menos um ficheiro da factura final para confirmar o pagamento.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              {reqParaPago?.status === 'Pago'
                ? 'Factura final'
                : comprovativoDialogFromApprove || reqParaPago?.status === 'Aprovado'
                ? 'Comprovativo de pagamento e conclusão'
                : 'Factura final / comprovativo'}
            </Label>
            {facturaFinalAnexos.length > 0 && (
              <ul className="space-y-1.5">
                {facturaFinalAnexos.map((urlOuNome, i) => {
                  const displayName = urlOuNome.startsWith('http') ? urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome : urlOuNome;
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      {urlOuNome.startsWith('http') ? (
                        <button
                          type="button"
                          className="truncate text-primary underline hover:no-underline"
                          onClick={() => {
                            setPdfPreviewUrl(urlOuNome);
                            setPagoDialogOpen(false);
                            setTimeout(() => setPdfPreviewOpen(true), 0);
                          }}
                        >
                          {displayName}
                        </button>
                      ) : (
                        <span className="truncate">{displayName}</span>
                      )}
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeFacturaFinalAnexo(i)} aria-label="Remover anexo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Input
              type="file"
              accept=".pdf,application/pdf"
              className="cursor-pointer file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadComprovativoFile(file);
                  e.target.value = '';
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoDialogOpen(false)}>Cancelar</Button>
            {(comprovativoDialogFromApprove || reqParaPago?.status === 'Aprovado') && (
              <Button variant="secondary" onClick={guardarComprovativo} disabled={facturaFinalAnexos.length === 0}>
                Processar pagamento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de pré-visualização de PDFs (proforma, factura, comprovativo) */}
      <Dialog
        open={pdfPreviewOpen}
        onOpenChange={open => {
          setPdfPreviewOpen(open);
          if (!open) {
            setPdfPreviewUrl(null);
          }
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
