import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import type { Reuniao } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
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
import { Search, Plus, Pencil, Eye, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const TIPO_OPTIONS: Reuniao['tipo'][] = ['Ordinária', 'Extraordinária', 'Informal', 'Comissão'];
const STATUS_OPTIONS: Reuniao['status'][] = ['Agendada', 'Realizada', 'Cancelada', 'Adiada'];

const emptyForm: Omit<Reuniao, 'id'> = {
  titulo: '',
  data: new Date().toISOString().slice(0, 10),
  hora: '09:00',
  local: '',
  tipo: 'Ordinária',
  pauta: '',
  participantes: [],
  status: 'Agendada',
};

export default function ReunioesPage() {
  const { reunioes, addReuniao, updateReuniao, deleteReuniao, colaboradores } = useData();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<Reuniao['tipo'] | 'todos'>('todos');
  const [statusFilter, setStatusFilter] = useState<Reuniao['status'] | 'todos'>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Reuniao | null>(null);
  const [viewItem, setViewItem] = useState<Reuniao | null>(null);
  const [form, setForm] = useState<Omit<Reuniao, 'id'>>(emptyForm);

  const getParticipantesNomes = (ids: number[]) =>
    ids.map(id => colaboradores.find(c => c.id === id)?.nome).filter(Boolean).join(', ') || '—';

  const filtered = reunioes.filter(r => {
    const matchSearch =
      r.titulo.toLowerCase().includes(search.toLowerCase()) ||
      r.local.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || r.tipo === tipoFilter;
    const matchStatus = statusFilter === 'todos' || r.status === statusFilter;
    let matchDate = true;
    if (dataInicio) matchDate = matchDate && r.data >= dataInicio;
    if (dataFim) matchDate = matchDate && r.data <= dataFim;
    return matchSearch && matchTipo && matchStatus && matchDate;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, data: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (r: Reuniao) => {
    setEditing(r);
    setForm({
      titulo: r.titulo,
      data: r.data,
      hora: r.hora,
      local: r.local,
      tipo: r.tipo,
      pauta: r.pauta,
      participantes: [...r.participantes],
      status: r.status,
    });
    setDialogOpen(true);
  };

  const toggleParticipante = (colabId: number) => {
    setForm(f => ({
      ...f,
      participantes: f.participantes.includes(colabId)
        ? f.participantes.filter(id => id !== colabId)
        : [...f.participantes, colabId],
    }));
  };

  const save = async () => {
    if (!form.titulo.trim() || !form.data || !form.local.trim()) return;
    try {
      if (editing) await updateReuniao(editing.id, form);
      else await addReuniao(form);
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (r: Reuniao) => {
    if (!window.confirm(`Remover reunião "${r.titulo}"?`)) return;
    try {
      await deleteReuniao(r.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Reuniões</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova reunião
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar título ou local..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as Reuniao['tipo'] | 'todos')}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPO_OPTIONS.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as Reuniao['status'] | 'todos')}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px] h-9" placeholder="Data de" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px] h-9" placeholder="Data até" />
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Título</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data / Hora</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Local</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Participantes</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{r.titulo}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(r.data)} {r.hora}</td>
                <td className="py-3 px-5 text-muted-foreground">{r.local}</td>
                <td className="py-3 px-5">{r.tipo}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-40 truncate" title={getParticipantesNomes(r.participantes)}>{r.participantes.length} part.</td>
                <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(r); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma reunião encontrada.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar reunião' : 'Nova reunião'}</DialogTitle>
            <DialogDescription>Dados da reunião.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de Direcção Q4" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} placeholder="Sala de conferências..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as Reuniao['tipo'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Reuniao['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pauta</Label>
              <Textarea value={form.pauta} onChange={e => setForm(f => ({ ...f, pauta: e.target.value }))} placeholder="Pontos da ordem de trabalhos..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Participantes</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {colaboradores.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.participantes.includes(c.id)}
                      onCheckedChange={() => toggleParticipante(c.id)}
                    />
                    <span className="text-sm">{c.nome} — {c.departamento}</span>
                  </label>
                ))}
                {colaboradores.length === 0 && <p className="text-sm text-muted-foreground">Nenhum colaborador disponível.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.titulo.trim() || !form.data || !form.local.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewItem?.titulo}</DialogTitle>
            <DialogDescription>Detalhe da reunião</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)} às {viewItem.hora}</p>
              <p><span className="text-muted-foreground">Local:</span> {viewItem.local}</p>
              <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
              <p><span className="text-muted-foreground">Participantes:</span> {getParticipantesNomes(viewItem.participantes)}</p>
              <div>
                <p className="text-muted-foreground mb-1">Pauta:</p>
                <pre className="whitespace-pre-wrap rounded bg-muted/50 p-3 text-xs">{viewItem.pauta || '—'}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
