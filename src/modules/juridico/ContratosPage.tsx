import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Contrato, StatusContrato } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, formatKz, diasRestantes } from '@/utils/formatters';
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
import { Plus, Pencil, Trash2, Eye, FileText } from 'lucide-react';

const TIPOS_CONTRATO = [
  'Empréstimo',
  'Trabalho Tempo Indeterminado',
  'Trabalho Tempo Determinado',
  'Prestação de Serviços',
  'Fornecimento',
  'Compra e Venda',
  'Arrendamento',
  'Parceria',
  'Outro',
] as const;

const STATUS_OPCOES: StatusContrato[] = ['Activo', 'A Renovar', 'Em Negociação', 'Suspenso', 'Rescindido', 'Expirado'];

export default function ContratosPage() {
  const { contratos, addContrato, updateContrato, deleteContrato, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [form, setForm] = useState<Partial<Contrato>>({
    numero: '',
    tipo: 'Prestação de Serviços',
    parteA: '',
    parteB: '',
    objecto: '',
    valor: 0,
    moeda: 'Kz',
    dataAssinatura: '',
    dataInicio: '',
    dataFim: '',
    advogado: '',
    responsavelJuridico: '',
    alertarAntesDias: 90,
    status: 'Activo',
    historico: [],
  });

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? empresas.find(e => e.activo)?.id ?? 1 : currentEmpresaId;
  const canEdit = user?.perfil === 'Admin' || user?.perfil === 'Juridico';

  const filtered = contratos.filter(c => {
    const matchSearch =
      !search ||
      c.numero.toLowerCase().includes(search.toLowerCase()) ||
      c.parteB.toLowerCase().includes(search.toLowerCase()) ||
      c.objecto.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo;
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    const matchEmpresa = filterEmpresa === 'todos' || (c.empresaId != null && String(c.empresaId) === filterEmpresa);
    return matchSearch && matchTipo && matchStatus && matchEmpresa;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const getDiasClass = (dataFim: string) => {
    const d = diasRestantes(dataFim);
    if (d < 0) return 'text-muted-foreground';
    if (d < 30) return 'text-destructive font-bold';
    if (d < 90) return 'text-amber-600 font-semibold';
    return 'text-emerald-600';
  };

  const empresaNome = (id: number | undefined) => (id != null ? empresas.find(e => e.id === id)?.nome ?? String(id) : '—');

  const openCreate = () => {
    setEditing(null);
    const ano = new Date().getFullYear();
    const nextNum = Math.max(0, ...contratos.map(c => parseInt(c.numero.replace(/\D/g, ''), 10) || 0)) + 1;
    setForm({
      empresaId: typeof empresaIdForNew === 'number' ? empresaIdForNew : 1,
      numero: `CONT-${ano}-${String(nextNum).padStart(4, '0')}`,
      tipo: 'Prestação de Serviços',
      parteA: 'Grupo SANEP',
      parteB: '',
      objecto: '',
      valor: 0,
      moeda: 'Kz',
      dataAssinatura: '',
      dataInicio: '',
      dataFim: '',
      advogado: user?.nome ?? '',
      responsavelJuridico: user?.nome ?? '',
      alertarAntesDias: 90,
      status: 'Activo',
      historico: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (c: Contrato) => {
    setEditing(c);
    setForm({ ...c, historico: c.historico ?? [] });
    setDialogOpen(true);
  };

  const openDetail = (c: Contrato) => {
    setEditing(c);
    setDetailOpen(true);
  };

  const save = async () => {
    if (!form.numero?.trim() || !form.parteB?.trim() || !form.dataInicio || !form.dataFim) return;
    const historico = editing
      ? [...(form.historico ?? []), { data: new Date().toISOString().slice(0, 10), acao: 'Contrato actualizado', utilizador: user?.nome ?? 'Sistema' }]
      : [{ data: new Date().toISOString().slice(0, 10), acao: 'Contrato criado', utilizador: user?.nome ?? 'Sistema' }];
    const payload: Partial<Contrato> = {
      empresaId: form.empresaId,
      numero: form.numero.trim(),
      tipo: form.tipo ?? 'Outro',
      parteA: form.parteA?.trim() ?? '',
      parteB: form.parteB.trim(),
      objecto: form.objecto?.trim() ?? '',
      valor: Number(form.valor) || 0,
      moeda: form.moeda ?? 'Kz',
      dataAssinatura: form.dataAssinatura ?? form.dataInicio ?? '',
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      advogado: form.advogado?.trim() ?? '',
      responsavelJuridico: form.responsavelJuridico ?? form.advogado,
      ficheiroPdf: form.ficheiroPdf,
      alertarAntesDias: form.alertarAntesDias,
      status: form.status ?? 'Activo',
      historico,
    };
    try {
      if (editing) {
        await updateContrato(editing.id, payload);
      } else {
        await addContrato(payload);
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (c: Contrato) => {
    if (!window.confirm(`Remover contrato ${c.numero}?`)) return;
    try {
      await deleteContrato(c.id);
      setDetailOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registo, organização e acompanhamento de contratos. Controlo de prazos e alertas de vencimento.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo contrato
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Pesquisar nº, contraparte, objecto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56 h-9"
        />
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_CONTRATO.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPCOES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentEmpresaId === 'consolidado' && (
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {empresas.filter(e => e.activo).map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="table-container overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Nº</th>
              {currentEmpresaId === 'consolidado' && <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>}
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Contraparte</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Objecto</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Valor</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Início</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Fim</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Dias</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(c => {
              const d = diasRestantes(c.dataFim);
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{c.numero}</td>
                  {currentEmpresaId === 'consolidado' && (
                    <td className="p-3 text-muted-foreground">{empresaNome(c.empresaId)}</td>
                  )}
                  <td className="p-3">{c.tipo}</td>
                  <td className="p-3 font-medium">{c.parteB}</td>
                  <td className="p-3 text-muted-foreground max-w-48 truncate" title={c.objecto}>{c.objecto}</td>
                  <td className="p-3 font-mono text-xs">{formatKz(c.valor)}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.dataInicio)}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.dataFim)}</td>
                  <td className={cn('p-3', getDiasClass(c.dataFim))}>
                    {d < 0 ? 'Vencido' : `${d} dias`}
                  </td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(c)} title="Ver">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c)} title="Remover">
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {filtered.length === 0 && (
        <div className="text-center py-12 rounded-lg border border-dashed border-border/80">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum contrato encontrado.</p>
          {canEdit && <Button variant="outline" className="mt-3" onClick={openCreate}>Criar primeiro contrato</Button>}
        </div>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar contrato' : 'Novo contrato'}</DialogTitle>
            <DialogDescription>
              Dados do contrato. Associe à empresa e defina o responsável jurídico. Pode indicar dias para alerta de vencimento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {currentEmpresaId === 'consolidado' && (
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select
                  value={form.empresaId != null ? String(form.empresaId) : '1'}
                  onValueChange={v => setForm(f => ({ ...f, empresaId: Number(v) }))}
                >
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
                <Label>Nº contrato</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="CONT-2024-0001" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRATO.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Parte A (empresa)</Label>
                <Input value={form.parteA} onChange={e => setForm(f => ({ ...f, parteA: e.target.value }))} placeholder="Grupo SANEP" />
              </div>
              <div className="space-y-2">
                <Label>Parte B (contraparte)</Label>
                <Input value={form.parteB} onChange={e => setForm(f => ({ ...f, parteB: e.target.value }))} placeholder="Nome da contraparte" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Objecto do contrato</Label>
              <Textarea value={form.objecto} onChange={e => setForm(f => ({ ...f, objecto: e.target.value }))} rows={2} placeholder="Descrição do objecto" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={form.moeda} onValueChange={v => setForm(f => ({ ...f, moeda: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kz">Kz</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data assinatura</Label>
                <Input type="date" value={form.dataAssinatura || ''} onChange={e => setForm(f => ({ ...f, dataAssinatura: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data início</Label>
                <Input type="date" value={form.dataInicio || ''} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input type="date" value={form.dataFim || ''} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável jurídico / Advogado</Label>
                <Input value={form.advogado} onChange={e => setForm(f => ({ ...f, advogado: e.target.value, responsavelJuridico: f.responsavelJuridico || e.target.value }))} placeholder="Nome" />
              </div>
              <div className="space-y-2">
                <Label>Alertar vencimento (dias antes)</Label>
                <Input type="number" min={0} value={form.alertarAntesDias ?? ''} onChange={e => setForm(f => ({ ...f, alertarAntesDias: Number(e.target.value) || undefined }))} placeholder="90" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Documento PDF (nome do ficheiro)</Label>
                <Input value={form.ficheiroPdf || ''} onChange={e => setForm(f => ({ ...f, ficheiroPdf: e.target.value || undefined }))} placeholder="contrato_xxx.pdf" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusContrato }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.numero?.trim() || !form.parteB?.trim() || !form.dataInicio || !form.dataFim}>
              {editing ? 'Guardar' : 'Criar contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe do contrato {editing?.numero}</DialogTitle>
            <DialogDescription>Dados completos e histórico de alterações.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Empresa:</span> {empresaNome(editing.empresaId)}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {editing.tipo}</div>
                <div><span className="text-muted-foreground">Parte A:</span> {editing.parteA}</div>
                <div><span className="text-muted-foreground">Parte B:</span> {editing.parteB}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Objecto:</span> {editing.objecto}</div>
                <div><span className="text-muted-foreground">Valor:</span> {formatKz(editing.valor)} {editing.moeda}</div>
                <div><span className="text-muted-foreground">Responsável:</span> {editing.responsavelJuridico || editing.advogado}</div>
                <div><span className="text-muted-foreground">Início:</span> {formatDate(editing.dataInicio)}</div>
                <div><span className="text-muted-foreground">Fim:</span> {formatDate(editing.dataFim)}</div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={editing.status} /></div>
                {editing.ficheiroPdf && <div className="col-span-2"><span className="text-muted-foreground">Documento:</span> {editing.ficheiroPdf}</div>}
              </div>
              {editing.historico && editing.historico.length > 0 && (
                <div>
                  <Label className="mb-2 block">Histórico</Label>
                  <ul className="border rounded-md divide-y divide-border/80">
                    {[...editing.historico].reverse().map((h, i) => (
                      <li key={i} className="p-3 text-sm flex justify-between">
                        <span>{h.acao}</span>
                        <span className="text-muted-foreground">{formatDate(h.data)} — {h.utilizador}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
