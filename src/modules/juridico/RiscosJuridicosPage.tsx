import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import type { RiscoJuridico } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
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
import { Plus, Pencil, Trash2, Eye, ShieldAlert } from 'lucide-react';

const PROBABILIDADE: RiscoJuridico['probabilidade'][] = ['Baixa', 'Média', 'Alta'];
const IMPACTO: RiscoJuridico['impacto'][] = ['Baixo', 'Médio', 'Alto'];
const NIVEL: RiscoJuridico['nivelRisco'][] = ['Baixo', 'Médio', 'Alto', 'Crítico'];
const STATUS_OPCOES: RiscoJuridico['status'][] = ['Identificado', 'Em monitorização', 'Mitigado', 'Materializado', 'Encerrado'];

export default function RiscosJuridicosPage() {
  const { riscos, setRiscos, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<RiscoJuridico | null>(null);
  const [form, setForm] = useState<Partial<RiscoJuridico>>({});

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? empresas.find(e => e.activo)?.id ?? 1 : currentEmpresaId;
  const canEdit = user?.perfil === 'Admin' || user?.perfil === 'Juridico';

  const filtered = riscos.filter(r => {
    const matchSearch =
      !search ||
      r.codigo.toLowerCase().includes(search.toLowerCase()) ||
      r.titulo.toLowerCase().includes(search.toLowerCase()) ||
      r.categoria.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'todos' || r.status === filterStatus;
    const matchEmpresa = filterEmpresa === 'todos' || (r.empresaId != null && String(r.empresaId) === filterEmpresa);
    return matchSearch && matchStatus && matchEmpresa;
  });

  const empresaNome = (id: number | undefined) => (id != null ? empresas.find(e => e.id === id)?.nome ?? String(id) : '—');

  const openCreate = () => {
    setEditing(null);
    const nextId = Math.max(0, ...riscos.map(r => r.id)) + 1;
    const nextNum = Math.max(0, ...riscos.map(r => parseInt(r.codigo.replace(/\D/g, ''), 10) || 0)) + 1;
    setForm({
      empresaId: typeof empresaIdForNew === 'number' ? empresaIdForNew : 1,
      codigo: `RISCO-J-${String(nextNum).padStart(4, '0')}`,
      titulo: '',
      descricao: '',
      categoria: '',
      probabilidade: 'Média',
      impacto: 'Médio',
      nivelRisco: 'Médio',
      planoAccao: '',
      responsavel: user?.nome ?? '',
      status: 'Identificado',
      dataIdentificacao: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const openEdit = (r: RiscoJuridico) => {
    setEditing(r);
    setForm({ ...r });
    setDialogOpen(true);
  };

  const openDetail = (r: RiscoJuridico) => {
    setEditing(r);
    setDetailOpen(true);
  };

  const save = () => {
    if (!form.codigo?.trim() || !form.titulo?.trim()) return;
    const payload: RiscoJuridico = {
      id: editing?.id ?? Math.max(0, ...riscos.map(r => r.id)) + 1,
      empresaId: form.empresaId,
      codigo: form.codigo.trim(),
      titulo: form.titulo.trim(),
      descricao: form.descricao?.trim() ?? '',
      categoria: form.categoria?.trim() ?? '',
      probabilidade: form.probabilidade ?? 'Média',
      impacto: form.impacto ?? 'Médio',
      nivelRisco: form.nivelRisco ?? 'Médio',
      planoAccao: form.planoAccao?.trim() ?? '',
      responsavel: form.responsavel?.trim() ?? '',
      status: form.status ?? 'Identificado',
      dataIdentificacao: form.dataIdentificacao,
      observacoes: form.observacoes,
    };
    if (editing) {
      setRiscos(prev => prev.map(r => (r.id === editing.id ? payload : r)));
    } else {
      setRiscos(prev => [...prev, payload]);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const remove = (r: RiscoJuridico) => {
    if (!window.confirm(`Remover risco ${r.codigo}?`)) return;
    setRiscos(prev => prev.filter(x => x.id !== r.id));
    setDetailOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Riscos Jurídicos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identificação, avaliação e plano de acção para riscos jurídicos.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo risco
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Pesquisar código, título, categoria..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 h-9" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
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

      <div className="table-container overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Código</th>
              {currentEmpresaId === 'consolidado' && <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>}
              <th className="text-left p-3 font-medium text-muted-foreground">Título</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Categoria</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Prob.</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Impacto</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Nível</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Data ident.</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="p-3 font-mono text-xs">{r.codigo}</td>
                {currentEmpresaId === 'consolidado' && <td className="p-3 text-muted-foreground">{empresaNome(r.empresaId)}</td>}
                <td className="p-3 font-medium max-w-48 truncate" title={r.titulo}>{r.titulo}</td>
                <td className="p-3 text-muted-foreground">{r.categoria}</td>
                <td className="p-3">{r.probabilidade}</td>
                <td className="p-3">{r.impacto}</td>
                <td className="p-3"><StatusBadge status={r.nivelRisco} /></td>
                <td className="p-3 text-muted-foreground">{r.responsavel}</td>
                <td className="p-3 text-muted-foreground">{r.dataIdentificacao ? formatDate(r.dataIdentificacao) : '—'}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(r)} title="Ver"><Eye className="h-4 w-4" /></Button>
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r)} title="Remover"><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 rounded-lg border border-dashed border-border/80">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum risco jurídico encontrado.</p>
          {canEdit && <Button variant="outline" className="mt-3" onClick={openCreate}>Registar risco</Button>}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar risco jurídico' : 'Novo risco jurídico'}</DialogTitle>
            <DialogDescription>Identificação e avaliação do risco.</DialogDescription>
          </DialogHeader>
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
                <Label>Código</Label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="RISCO-J-0001" />
              </div>
              <div className="space-y-2">
                <Label>Data identificação</Label>
                <Input type="date" value={form.dataIdentificacao || ''} onChange={e => setForm(f => ({ ...f, dataIdentificacao: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Atraso na renovação de licenças" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Contratual, Laboral, Fiscal..." />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Probabilidade</Label>
                <Select value={form.probabilidade} onValueChange={v => setForm(f => ({ ...f, probabilidade: v as RiscoJuridico['probabilidade'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROBABILIDADE.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Impacto</Label>
                <Select value={form.impacto} onValueChange={v => setForm(f => ({ ...f, impacto: v as RiscoJuridico['impacto'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPACTO.map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nível de risco</Label>
                <Select value={form.nivelRisco} onValueChange={v => setForm(f => ({ ...f, nivelRisco: v as RiscoJuridico['nivelRisco'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVEL.map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} placeholder="Descrição do risco" />
            </div>
            <div className="space-y-2">
              <Label>Plano de acção</Label>
              <Textarea value={form.planoAccao} onChange={e => setForm(f => ({ ...f, planoAccao: e.target.value }))} rows={2} placeholder="Medidas de mitigação" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as RiscoJuridico['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPCOES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.codigo?.trim() || !form.titulo?.trim()}>
              {editing ? 'Guardar' : 'Registar risco'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe — {editing?.codigo}</DialogTitle>
            <DialogDescription>Risco jurídico identificado.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Empresa:</span> {empresaNome(editing.empresaId)}</div>
                <div><span className="text-muted-foreground">Data identificação:</span> {editing.dataIdentificacao ? formatDate(editing.dataIdentificacao) : '—'}</div>
                <div><span className="text-muted-foreground">Categoria:</span> {editing.categoria}</div>
                <div><span className="text-muted-foreground">Responsável:</span> {editing.responsavel}</div>
                <div><span className="text-muted-foreground">Probabilidade:</span> {editing.probabilidade}</div>
                <div><span className="text-muted-foreground">Impacto:</span> {editing.impacto}</div>
                <div><span className="text-muted-foreground">Nível:</span> <StatusBadge status={editing.nivelRisco} /></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={editing.status} /></div>
              </div>
              <div><span className="text-muted-foreground">Descrição:</span><p className="mt-1">{editing.descricao}</p></div>
              <div><span className="text-muted-foreground">Plano de acção:</span><p className="mt-1">{editing.planoAccao}</p></div>
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
