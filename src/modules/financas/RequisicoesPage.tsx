import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import type { Requisicao, StatusRequisicao } from '@/types';
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
import { Search, Plus, Pencil, Eye, Check, X, Send, Banknote, Paperclip, Trash2 } from 'lucide-react';
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

const emptyRequisicao: Omit<Requisicao, 'id' | 'num'> = {
  empresaId: 1,
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
  const { requisicoes, addRequisicao, updateRequisicao, centrosCusto, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusRequisicao | 'todos'>('todos');
  const [centroFilter, setCentroFilter] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Requisicao | null>(null);
  const [viewReq, setViewReq] = useState<Requisicao | null>(null);
  const [form, setForm] = useState(emptyRequisicao);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReq, setRejectReq] = useState<Requisicao | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [novoAnexoNome, setNovoAnexoNome] = useState('');
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [reqParaPago, setReqParaPago] = useState<Requisicao | null>(null);
  const [facturaFinalAnexos, setFacturaFinalAnexos] = useState<string[]>([]);
  const [novoFacturaFinalNome, setNovoFacturaFinalNome] = useState('');

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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyRequisicao, data: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (r: Requisicao) => {
    setEditing(r);
    setForm({
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
    setDialogOpen(true);
  };

  const addProformaAnexo = (fileName: string) => {
    if (!fileName.trim()) return;
    setForm(f => ({
      ...f,
      proformaAnexos: [...(f.proformaAnexos ?? []), fileName.trim()],
      proforma: true,
    }));
  };

  const removeProformaAnexo = (index: number) => {
    setForm(f => {
      const next = (f.proformaAnexos ?? []).filter((_, i) => i !== index);
      return { ...f, proformaAnexos: next, proforma: next.length > 0 };
    });
  };

  const openPagoDialog = (r: Requisicao) => {
    setReqParaPago(r);
    setFacturaFinalAnexos(r.facturaFinalAnexos ?? []);
    setNovoFacturaFinalNome('');
    setPagoDialogOpen(true);
  };

  const addFacturaFinalAnexo = (nome: string) => {
    if (!nome.trim()) return;
    setFacturaFinalAnexos(prev => [...prev, nome.trim()]);
    setNovoFacturaFinalNome('');
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

  const confirmarPago = async () => {
    if (!reqParaPago || facturaFinalAnexos.length === 0) return;
    try {
      await updateRequisicao(reqParaPago.id, {
        status: 'Pago',
        factura: true,
        facturaFinalAnexos,
        dataPagamento: new Date().toISOString().slice(0, 10),
      });
      setPagoDialogOpen(false);
      setReqParaPago(null);
      setFacturaFinalAnexos([]);
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
              <th className="text-center py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Docs</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{r.num}</td>
                <td className="py-3 px-5 font-medium">{r.fornecedor}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-48 truncate">{r.descricao}</td>
                <td className="py-3 px-5 text-muted-foreground">{r.centroCusto}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.valor)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(r.data)}</td>
                <td className="py-3 px-5 text-center">
                  <span className="text-xs" title={[r.proformaAnexos?.length ? `Proforma: ${(r.proformaAnexos ?? []).join(', ')}` : null, (r.facturaFinalAnexos?.length ?? 0) > 0 ? `Factura final: ${(r.facturaFinalAnexos ?? []).join(', ')}` : null].filter(Boolean).join(' | ') || undefined}>
                    {r.proforma ? (r.proformaAnexos?.length ? `P (${r.proformaAnexos.length})` : 'P') : '—'} {(r.factura || (r.facturaFinalAnexos?.length ?? 0) > 0) ? ((r.facturaFinalAnexos?.length ?? 0) > 0 ? `F (${r.facturaFinalAnexos!.length})` : 'F') : '—'} {r.comprovante ? 'C' : '—'}
                  </span>
                </td>
                <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(r)}><Eye className="h-4 w-4" /></Button>
                    {(user?.perfil === 'Admin' || user?.perfil === 'Financeiro') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    )}
                    {r.status === 'Pendente' && (user?.perfil === 'Admin' || user?.perfil === 'Financeiro') && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => aprovar(r)} title="Aprovar"><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setRejectReq(r); setRejectOpen(true); }} title="Rejeitar"><X className="h-4 w-4" /></Button>
                      </>
                    )}
                    {r.status === 'Aprovado' && (user?.perfil === 'Admin' || user?.perfil === 'Financeiro') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => enviarContabilidade(r)}
                        title={temFacturaFinal(r) ? 'Enviar à Contabilidade' : 'Anexe a factura final para enviar à contabilidade'}
                        disabled={!temFacturaFinal(r)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {(r.status === 'Enviado à Contabilidade' || r.status === 'Aprovado') && (user?.perfil === 'Admin' || user?.perfil === 'Contabilidade' || user?.perfil === 'Financeiro') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPagoDialog(r)} title="Marcar como pago (anexar factura final)"><Banknote className="h-4 w-4" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma requisição encontrada.</p>
      )}

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
                <Input type="number" min={0} value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} />
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
            {editing && (
              <div className="space-y-2">
                <Label>Projecto (opcional)</Label>
                <Input value={form.projecto ?? ''} onChange={e => setForm(f => ({ ...f, projecto: e.target.value || undefined }))} />
              </div>
            )}
            {/* Anexar facturas proforma — visível em criar e editar */}
            <div className="space-y-2 border-t border-border/80 pt-4">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Facturas proforma anexadas
              </Label>
              <p className="text-xs text-muted-foreground">Adicione os ficheiros de proforma associados a esta requisição.</p>
              {(form.proformaAnexos ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(form.proformaAnexos ?? []).map((nome, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span className="truncate">{nome}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeProformaAnexo(i)} aria-label="Remover anexo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do ficheiro (ex: proforma_techsupply.pdf)"
                  value={novoAnexoNome}
                  onChange={e => setNovoAnexoNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProformaAnexo(novoAnexoNome); setNovoAnexoNome(''); } }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { addProformaAnexo(novoAnexoNome); setNovoAnexoNome(''); }}
                  disabled={!novoAnexoNome.trim()}
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
                    if (file) { addProformaAnexo(file.name); e.target.value = ''; }
                  }}
                />
                <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 py-2 text-xs text-muted-foreground pointer-events-none">
                  <Paperclip className="h-3.5 w-3.5" /> ou clique para seleccionar ficheiro (PDF, imagem, Word)
                </div>
              </div>
            </div>

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
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewReq?.num}</DialogTitle>
            <DialogDescription>Detalhe da requisição</DialogDescription>
          </DialogHeader>
          {viewReq && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Fornecedor:</span> {viewReq.fornecedor}</p>
              <p><span className="text-muted-foreground">Descrição:</span> {viewReq.descricao}</p>
              <p><span className="text-muted-foreground">Valor:</span> {formatKz(viewReq.valor)}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewReq.data)}</p>
              <p><span className="text-muted-foreground">Departamento:</span> {viewReq.departamento}</p>
              <p><span className="text-muted-foreground">Centro de Custo:</span> {viewReq.centroCusto}</p>
              <p><span className="text-muted-foreground">Documentos:</span> Proforma {viewReq.proforma ? 'Sim' : 'Não'} | Factura {viewReq.factura ? 'Sim' : 'Não'} | Comprovante {viewReq.comprovante ? 'Sim' : 'Não'}</p>
              {(viewReq.proformaAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Facturas proforma anexadas:</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {(viewReq.proformaAnexos ?? []).map((nome, i) => (
                      <li key={i}>{nome}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(viewReq.facturaFinalAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Factura final anexada:</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {(viewReq.facturaFinalAnexos ?? []).map((nome, i) => (
                      <li key={i}>{nome}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewReq.status} /></p>
              {viewReq.motivoRejeicao && <p><span className="text-muted-foreground">Motivo rejeição:</span> {viewReq.motivoRejeicao}</p>}
            </div>
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

      {/* Dialog Marcar como Pago — obriga a anexar factura final */}
      <Dialog open={pagoDialogOpen} onOpenChange={open => { if (!open) { setReqParaPago(null); setFacturaFinalAnexos([]); } setPagoDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
            <DialogDescription>Anexe pelo menos um ficheiro da factura final para confirmar o pagamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Factura final</Label>
            {facturaFinalAnexos.length > 0 && (
              <ul className="space-y-1.5">
                {facturaFinalAnexos.map((nome, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="truncate">{nome}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeFacturaFinalAnexo(i)} aria-label="Remover anexo">
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
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFacturaFinalAnexo(novoFacturaFinalNome); } }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => addFacturaFinalAnexo(novoFacturaFinalNome)} disabled={!novoFacturaFinalNome.trim()}>
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
                  if (file) { addFacturaFinalAnexo(file.name); e.target.value = ''; }
                }}
              />
              <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 py-2 text-xs text-muted-foreground pointer-events-none">
                <Paperclip className="h-3.5 w-3.5" /> ou clique para seleccionar ficheiro
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarPago} disabled={facturaFinalAnexos.length === 0}>
              Marcar como pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
