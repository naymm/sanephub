import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { inferBucketFromStoragePublicUrl, resolveComprovativoPublicUrl } from '@/utils/storageComprovativo';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { MovimentoTesouraria, CategoriaSaidaTesouraria, MetodoPagamentoTesouraria } from '@/types';
import { formatKz, formatDate } from '@/utils/formatters';
import { nextReferenciaTesouraria } from '@/utils/tesourariaReferencia';
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
import { Search, Pencil, Eye, ArrowDownCircle, ArrowUpCircle, Paperclip, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const METODOS: MetodoPagamentoTesouraria[] = ['Transferência', 'Cheque', 'Numerário', 'MB', 'Outro'];

const CATEGORIAS_SAIDA: { value: CategoriaSaidaTesouraria; label: string }[] = [
  { value: 'fornecedor', label: 'Pagamento a fornecedores' },
  { value: 'servicos', label: 'Pagamento de serviços' },
  { value: 'despesas_operacionais', label: 'Despesas operacionais' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'salarios', label: 'Salários' },
];

type FormState = Omit<MovimentoTesouraria, 'id' | 'referencia' | 'registadoEm'> & { id?: number; referencia?: string; registadoEm?: string };

const emptyForm = (empresaId: number, tipo: 'entrada' | 'saida'): FormState => ({
  empresaId,
  tipo,
  valor: 0,
  data: new Date().toISOString().slice(0, 10),
  metodoPagamento: 'Transferência',
  descricao: '',
  comprovativoAnexos: [],
  contaBancariaId: undefined,
});

export default function TesourariaPage() {
  const { user } = useAuth();
  const {
    movimentosTesouraria,
    addMovimentoTesouraria,
    updateMovimentoTesouraria,
    empresas,
    centrosCusto,
    projectos,
    bancos,
    contasBancarias,
  } = useData();
  const { currentEmpresaId } = useTenant();
  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;

  const [tipoFilter, setTipoFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<MovimentoTesouraria | null>(null);
  const [viewMov, setViewMov] = useState<MovimentoTesouraria | null>(null);
  const [formTipo, setFormTipo] = useState<'entrada' | 'saida'>('entrada');
  const [form, setForm] = useState<FormState>(() => emptyForm(empresaIdForNew, 'entrada'));
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const filtered = movimentosTesouraria.filter(m => {
    const matchTipo = tipoFilter === 'todos' || m.tipo === tipoFilter;
    let matchDate = true;
    if (dataInicio) matchDate = matchDate && m.data >= dataInicio;
    if (dataFim) matchDate = matchDate && m.data <= dataFim;
    const searchLower = search.toLowerCase();
    const contaTxt = m.contaBancariaId
      ? (() => {
          const c = contasBancarias.find(x => x.id === m.contaBancariaId);
          if (!c) return '';
          const bn = bancos.find(b => b.id === c.bancoId)?.nome ?? '';
          return `${bn} ${c.numeroConta}`.toLowerCase();
        })()
      : '';
    const matchSearch =
      !searchLower ||
      m.referencia.toLowerCase().includes(searchLower) ||
      m.descricao.toLowerCase().includes(searchLower) ||
      (m.origem ?? '').toLowerCase().includes(searchLower) ||
      (m.beneficiario ?? '').toLowerCase().includes(searchLower) ||
      contaTxt.includes(searchLower);
    return matchTipo && matchDate && matchSearch;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const openCreate = (tipo: 'entrada' | 'saida') => {
    setFormTipo(tipo);
    setForm(emptyForm(empresaIdForNew, tipo));
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (m: MovimentoTesouraria) => {
    setFormTipo(m.tipo);
    setEditing(m);
    setForm({
      ...m,
      comprovativoAnexos: m.comprovativoAnexos ?? [],
    });
    setDialogOpen(true);
  };

  const openView = (m: MovimentoTesouraria) => {
    setViewMov(m);
    setViewOpen(true);
  };

  const removeAnexo = (index: number) => {
    setForm(f => ({
      ...f,
      comprovativoAnexos: (f.comprovativoAnexos ?? []).filter((_, i) => i !== index),
    }));
  };

  const uploadComprovativoTesourariaFile = async (file: File, tipoMov: 'entrada' | 'saida') => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Upload de comprovativo requer Supabase configurado.');
      return;
    }
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const movKey = editing?.id ?? `new-${Date.now()}`;
      const prefix = tipoMov === 'entrada' ? 'entrada' : 'saida';
      const path = `tesouraria/comprovativos/${prefix}-${movKey}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('comprovativos').upload(path, file, { upsert: true });
      if (error || !data?.path) throw new Error(error?.message || 'Falha ao carregar comprovativo');
      const { data: pub } = supabase.storage.from('comprovativos').getPublicUrl(data.path);
      setForm(f => ({
        ...f,
        comprovativoAnexos: [...(f.comprovativoAnexos ?? []), pub.publicUrl],
      }));
      toast.success('Comprovativo anexado com sucesso.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar o comprovativo.');
    }
  };

  const save = async () => {
    if (!form.descricao.trim() || form.valor <= 0) return;
    try {
      if (editing) {
        await updateMovimentoTesouraria(editing.id, {
          tipo: form.tipo,
          valor: form.valor,
          data: form.data,
          metodoPagamento: form.metodoPagamento,
          descricao: form.descricao,
          comprovativoAnexos: form.comprovativoAnexos,
          origem: form.origem,
          beneficiario: form.beneficiario,
          categoriaSaida: form.categoriaSaida,
          centroCustoId: form.centroCustoId,
          projectoId: form.projectoId,
          contaBancariaId: form.contaBancariaId,
        });
      } else {
        const referencia = nextReferenciaTesouraria(movimentosTesouraria, form.empresaId, form.tipo);
        const registadoEm = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await addMovimentoTesouraria({
          ...form,
          referencia,
          registadoPor: user?.nome,
          registadoEm,
        });
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const totalEntradas = filtered.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0);
  const totalSaidas = filtered.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0);
  const saldoFiltrado = totalEntradas - totalSaidas;

  const empresaNome = (id: number) => empresas.find(e => e.id === id)?.nome ?? String(id);
  const centroNome = (id?: number) => (id ? centrosCusto.find(c => c.id === id)?.nome : null) ?? '—';
  const projectoNome = (id?: number) => (id ? projectos.find(p => p.id === id)?.nome : null) ?? '—';
  const categoriaLabel = (v?: CategoriaSaidaTesouraria) => (v ? CATEGORIAS_SAIDA.find(c => c.value === v)?.label : '—');
  const contaLabel = (contaId?: number) => {
    if (!contaId) return '—';
    const c = contasBancarias.find(x => x.id === contaId);
    if (!c) return '—';
    const bn = bancos.find(b => b.id === c.bancoId)?.nome ?? '?';
    return `${bn} · ${c.numeroConta}`;
  };

  const contasForEmpresa = (empresaId: number) =>
    contasBancarias.filter(c => c.empresaId === empresaId).sort((a, b) => a.numeroConta.localeCompare(b.numeroConta));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Tesouraria</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCreate('entrada')} className="text-green-600 border-green-600/50 hover:bg-green-600/10">
            <ArrowDownCircle className="h-4 w-4 mr-2" /> Entrada
          </Button>
          <Button variant="outline" onClick={() => openCreate('saida')} className="text-red-600 border-red-600/50 hover:bg-red-600/10">
            <ArrowUpCircle className="h-4 w-4 mr-2" /> Saída
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total entradas (filtro)</p>
          <p className="text-xl font-semibold text-green-600 mt-1">{formatKz(totalEntradas)}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total saídas (filtro)</p>
          <p className="text-xl font-semibold text-red-600 mt-1">{formatKz(totalSaidas)}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo (filtro)</p>
          <p className={`text-xl font-semibold mt-1 ${saldoFiltrado >= 0 ? 'text-foreground' : 'text-red-600'}`}>{formatKz(saldoFiltrado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por ref., origem, beneficiário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as typeof tipoFilter)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px] h-9" placeholder="Data de" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px] h-9" placeholder="Data até" />
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ref.</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Origem / Beneficiário</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Método</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Conta</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(m => (
              <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{m.referencia}</td>
                <td className="py-3 px-5">
                  <span className={m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}>
                    {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                </td>
                <td className="py-3 px-5 text-muted-foreground">{empresaNome(m.empresaId)}</td>
                <td className="py-3 px-5">
                  {m.tipo === 'entrada' ? (m.origem ?? '—') : (m.beneficiario ?? categoriaLabel(m.categoriaSaida))}
                </td>
                <td className={`py-3 px-5 text-right font-mono ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                  {m.tipo === 'entrada' ? '+' : '-'}{formatKz(m.valor)}
                </td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(m.data)}</td>
                <td className="py-3 px-5 text-muted-foreground">{m.metodoPagamento}</td>
                <td className="py-3 px-5 text-muted-foreground text-xs max-w-[200px] truncate" title={contaLabel(m.contaBancariaId)}>
                  {contaLabel(m.contaBancariaId)}
                </td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(m)}><Eye className="h-4 w-4" /></Button>
                    {(user?.perfil === 'Admin' || user?.perfil === 'Financeiro' || user?.perfil === 'Contabilidade') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum movimento encontrado.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar movimento' : formTipo === 'entrada' ? 'Registar entrada' : 'Registar saída'}</DialogTitle>
            <DialogDescription>
              {formTipo === 'entrada' ? 'Registe o recebimento e associe à empresa e origem.' : 'Registe o pagamento e classifique por categoria.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={String(form.empresaId)}
                onValueChange={v => {
                  const nextEmp = Number(v);
                  setForm(f => ({
                    ...f,
                    empresaId: nextEmp,
                    contaBancariaId: undefined,
                  }));
                }}
                disabled={!!editing}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {empresas.filter(e => e.activo).map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label>Método de pagamento</Label>
              <Select value={form.metodoPagamento} onValueChange={v => setForm(f => ({ ...f, metodoPagamento: v as MetodoPagamentoTesouraria }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta bancária (opcional)</Label>
              <Select
                value={form.contaBancariaId ? String(form.contaBancariaId) : 'nenhum'}
                onValueChange={v =>
                  setForm(f => ({
                    ...f,
                    contaBancariaId: v === 'nenhum' ? undefined : Number(v),
                  }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Sem conta seleccionada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">— Não associar</SelectItem>
                  {contasForEmpresa(form.empresaId).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {(bancos.find(b => b.id === c.bancoId)?.nome ?? 'Banco')} · {c.numeroConta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se seleccionar uma conta, o saldo em <strong className="text-foreground">Contas bancárias</strong> reflecte este movimento (entrada aumenta, saída diminui), em sincronia com a base de dados.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do movimento" />
            </div>
            {formTipo === 'entrada' && (
              <div className="space-y-2">
                <Label>Cliente / Origem</Label>
                <Input value={form.origem ?? ''} onChange={e => setForm(f => ({ ...f, origem: e.target.value || undefined }))} placeholder="Cliente ou origem do recebimento" />
              </div>
            )}
            {formTipo === 'saida' && (
              <>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.categoriaSaida ?? ''} onValueChange={v => setForm(f => ({ ...f, categoriaSaida: (v || undefined) as CategoriaSaidaTesouraria | undefined }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_SAIDA.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Beneficiário</Label>
                  <Input value={form.beneficiario ?? ''} onChange={e => setForm(f => ({ ...f, beneficiario: e.target.value || undefined }))} placeholder="Fornecedor, serviço, etc." />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Centro de custo</Label>
                <Select value={form.centroCustoId ? String(form.centroCustoId) : 'nenhum'} onValueChange={v => setForm(f => ({ ...f, centroCustoId: v === 'nenhum' ? undefined : Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">—</SelectItem>
                    {centrosCusto.map(cc => (
                      <SelectItem key={cc.id} value={String(cc.id)}>{cc.codigo} — {cc.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Projecto</Label>
                <Select value={form.projectoId ? String(form.projectoId) : 'nenhum'} onValueChange={v => setForm(f => ({ ...f, projectoId: v === 'nenhum' ? undefined : Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">—</SelectItem>
                    {projectos.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.codigo} — {p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                {formTipo === 'saida' ? 'Comprovativo de pagamento e conclusão' : 'Comprovativo de recebimento'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {formTipo === 'saida'
                  ? 'Igual às requisições: anexe PDF; o ficheiro fica no armazenamento Supabase (bucket comprovativos).'
                  : 'Anexe PDF (recibo, transferência, etc.); o ficheiro fica no mesmo bucket comprovativos, como nas saídas.'}
              </p>
              {(form.comprovativoAnexos ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(form.comprovativoAnexos ?? []).map((urlOuNome, i) => {
                    const displayName = urlOuNome.startsWith('http')
                      ? urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome
                      : urlOuNome;
                    return (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        {urlOuNome.startsWith('http') ? (
                          <button
                            type="button"
                            className="truncate text-left text-primary underline hover:no-underline"
                            onClick={() => {
                              void (async () => {
                                if (!supabase) return;
                                const bucket = inferBucketFromStoragePublicUrl(urlOuNome);
                                const resolved = await resolveComprovativoPublicUrl(supabase, bucket, urlOuNome);
                                if (resolved) {
                                  setPdfPreviewUrl(resolved);
                                  setPdfPreviewOpen(true);
                                } else {
                                  toast.error('Não foi possível pré-visualizar o documento.');
                                }
                              })();
                            }}
                          >
                            {displayName}
                          </button>
                        ) : (
                          <span className="truncate">{displayName}</span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeAnexo(i)}
                          aria-label="Remover anexo"
                        >
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
                    void uploadComprovativoTesourariaFile(file, formTipo);
                    e.target.value = '';
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes ?? ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value || undefined }))} rows={2} className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.descricao.trim() || form.valor <= 0}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ver */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">{viewMov?.referencia}</DialogTitle>
            <DialogDescription>Detalhe do movimento de tesouraria.</DialogDescription>
          </DialogHeader>
          {viewMov && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Tipo:</span> <span className={viewMov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}>{viewMov.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></p>
              <p><span className="text-muted-foreground">Empresa:</span> {empresaNome(viewMov.empresaId)}</p>
              <p><span className="text-muted-foreground">Valor:</span> <span className={viewMov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}>{viewMov.tipo === 'entrada' ? '+' : '-'}{formatKz(viewMov.valor)}</span></p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewMov.data)}</p>
              <p><span className="text-muted-foreground">Método:</span> {viewMov.metodoPagamento}</p>
              <p><span className="text-muted-foreground">Conta bancária:</span> {contaLabel(viewMov.contaBancariaId)}</p>
              <p><span className="text-muted-foreground">Descrição:</span> {viewMov.descricao}</p>
              {viewMov.tipo === 'entrada' && viewMov.origem && <p><span className="text-muted-foreground">Origem:</span> {viewMov.origem}</p>}
              {viewMov.tipo === 'saida' && (viewMov.categoriaSaida || viewMov.beneficiario) && (
                <p><span className="text-muted-foreground">Categoria / Beneficiário:</span> {categoriaLabel(viewMov.categoriaSaida)} {viewMov.beneficiario && `— ${viewMov.beneficiario}`}</p>
              )}
              <p><span className="text-muted-foreground">Centro de custo:</span> {centroNome(viewMov.centroCustoId)}</p>
              <p><span className="text-muted-foreground">Projecto:</span> {projectoNome(viewMov.projectoId)}</p>
              {(viewMov.comprovativoAnexos?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Comprovativos:</p>
                  <ul className="space-y-1 pl-1">
                    {(viewMov.comprovativoAnexos ?? []).map((urlOuNome, i) => {
                      const displayName = urlOuNome.startsWith('http')
                        ? urlOuNome.split('/').pop()?.split('?')[0] || urlOuNome
                        : urlOuNome;
                      return (
                        <li key={i}>
                          {urlOuNome.startsWith('http') ? (
                            <button
                              type="button"
                              className="text-primary underline hover:no-underline text-sm"
                              onClick={() => {
                                void (async () => {
                                  if (!supabase) return;
                                  const bucket = inferBucketFromStoragePublicUrl(urlOuNome);
                                  const resolved = await resolveComprovativoPublicUrl(supabase, bucket, urlOuNome);
                                  if (resolved) {
                                    setPdfPreviewUrl(resolved);
                                    setViewOpen(false);
                                    setTimeout(() => setPdfPreviewOpen(true), 0);
                                  } else {
                                    toast.error('Não foi possível pré-visualizar o documento.');
                                  }
                                })();
                              }}
                            >
                              {displayName}
                            </button>
                          ) : (
                            <span className="text-sm">{displayName}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {viewMov.registadoPor && <p><span className="text-muted-foreground">Registado por:</span> {viewMov.registadoPor}</p>}
              {viewMov.observacoes && <p><span className="text-muted-foreground">Observações:</span> {viewMov.observacoes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pdfPreviewOpen}
        onOpenChange={open => {
          setPdfPreviewOpen(open);
          if (!open) setPdfPreviewUrl(null);
        }}
      >
        <DialogContent className="max-w-[90vw] w-full h-[95vh] p-0">
          {pdfPreviewUrl ? (
            <iframe src={pdfPreviewUrl} title="Pré-visualização do comprovativo" className="w-full h-full min-h-[80vh] border-0 rounded-md" />
          ) : (
            <DialogDescription className="p-4">A carregar pré-visualização…</DialogDescription>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
