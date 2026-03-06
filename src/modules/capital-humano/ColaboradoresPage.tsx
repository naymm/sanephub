import { useState } from 'react';
import { useData } from '@/context/DataContext';
import type { Colaborador, StatusColaborador, TipoContrato, Genero } from '@/types';
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
import { Search, Plus, Pencil, Eye } from 'lucide-react';

const STATUS_OPTIONS: StatusColaborador[] = ['Activo', 'Inactivo', 'Suspenso', 'Em férias'];
const TIPO_CONTRATO_OPTIONS: TipoContrato[] = ['Efectivo', 'Prazo Certo', 'Prestação', 'Estágio'];
const GENERO_OPTIONS: Genero[] = ['M', 'F', 'Outro'];

const emptyForm: Omit<Colaborador, 'id'> = {
  nome: '',
  dataNascimento: '',
  genero: 'M',
  estadoCivil: '',
  bi: '',
  nif: '',
  niss: '',
  nacionalidade: '',
  endereco: '',
  cargo: '',
  departamento: '',
  dataAdmissao: '',
  tipoContrato: 'Efectivo',
  salarioBase: 0,
  iban: '',
  emailCorporativo: '',
  telefonePrincipal: '',
  status: 'Activo',
};

export default function ColaboradoresPage() {
  const { colaboradores, setColaboradores } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusColaborador | 'todos'>('todos');
  const [deptFilter, setDeptFilter] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [viewItem, setViewItem] = useState<Colaborador | null>(null);
  const [form, setForm] = useState<Omit<Colaborador, 'id'>>(emptyForm);

  const departamentos = Array.from(new Set(colaboradores.map(c => c.departamento))).sort();

  const filtered = colaboradores.filter(c => {
    const matchSearch =
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.cargo.toLowerCase().includes(search.toLowerCase()) ||
      c.departamento.toLowerCase().includes(search.toLowerCase()) ||
      c.emailCorporativo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
    const matchDept = deptFilter === 'todos' || c.departamento === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  const openCreate = () => {
    setEditing(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...emptyForm, dataAdmissao: today });
    setDialogOpen(true);
  };

  const openEdit = (c: Colaborador) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      dataNascimento: c.dataNascimento,
      genero: c.genero,
      estadoCivil: c.estadoCivil,
      bi: c.bi,
      nif: c.nif,
      niss: c.niss,
      nacionalidade: c.nacionalidade,
      endereco: c.endereco,
      cargo: c.cargo,
      departamento: c.departamento,
      dataAdmissao: c.dataAdmissao,
      tipoContrato: c.tipoContrato,
      dataFimContrato: c.dataFimContrato,
      salarioBase: c.salarioBase,
      iban: c.iban,
      emailCorporativo: c.emailCorporativo,
      emailPessoal: c.emailPessoal,
      telefonePrincipal: c.telefonePrincipal,
      telefoneAlternativo: c.telefoneAlternativo,
      contactoEmergenciaNome: c.contactoEmergenciaNome,
      contactoEmergenciaTelefone: c.contactoEmergenciaTelefone,
      status: c.status,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.nome.trim() || !form.emailCorporativo.trim()) return;
    if (editing) {
      setColaboradores(prev => prev.map(c => (c.id === editing.id ? { ...editing, ...form } : c)));
    } else {
      const newId = Math.max(0, ...colaboradores.map(c => c.id)) + 1;
      setColaboradores(prev => [...prev, { id: newId, ...form }]);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Colaboradores</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo Colaborador
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusColaborador | 'todos')}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {departamentos.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cargo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Departamento</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Admissão</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contrato</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Salário Base</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{c.nome}</td>
                <td className="py-3 px-5 text-muted-foreground">{c.cargo}</td>
                <td className="py-3 px-5 text-muted-foreground">{c.departamento}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(c.dataAdmissao)}</td>
                <td className="py-3 px-5"><StatusBadge status={c.tipoContrato} variant="neutral" /></td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(c.salarioBase)}</td>
                <td className="py-3 px-5"><StatusBadge status={c.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(c); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum colaborador encontrado.</p>}

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle>
            <DialogDescription>Dados do colaborador.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data nascimento</Label>
                <Input type="date" value={form.dataNascimento} onChange={e => setForm(f => ({ ...f, dataNascimento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Género</Label>
                <Select value={form.genero} onValueChange={v => setForm(f => ({ ...f, genero: v as Genero }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENERO_OPTIONS.map(g => (
                      <SelectItem key={g} value={g}>{g === 'M' ? 'Masculino' : g === 'F' ? 'Feminino' : 'Outro'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado civil</Label>
                <Input value={form.estadoCivil} onChange={e => setForm(f => ({ ...f, estadoCivil: e.target.value }))} placeholder="ex: Solteiro" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>BI</Label>
                <Input value={form.bi} onChange={e => setForm(f => ({ ...f, bi: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>NIF</Label>
                <Input value={form.nif} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>NISS</Label>
                <Input value={form.niss} onChange={e => setForm(f => ({ ...f, niss: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nacionalidade</Label>
                <Input value={form.nacionalidade} onChange={e => setForm(f => ({ ...f, nacionalidade: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
              </div>
            </div>
            <hr className="border-border/80" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data admissão</Label>
                <Input type="date" value={form.dataAdmissao} onChange={e => setForm(f => ({ ...f, dataAdmissao: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tipo contrato</Label>
                <Select value={form.tipoContrato} onValueChange={v => setForm(f => ({ ...f, tipoContrato: v as TipoContrato }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_CONTRATO_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.tipoContrato !== 'Efectivo' && (
              <div className="space-y-2">
                <Label>Data fim contrato</Label>
                <Input type="date" value={form.dataFimContrato ?? ''} onChange={e => setForm(f => ({ ...f, dataFimContrato: e.target.value || undefined }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Salário base (Kz)</Label>
                <Input type="number" min={0} value={form.salarioBase || ''} onChange={e => setForm(f => ({ ...f, salarioBase: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} />
              </div>
            </div>
            <hr className="border-border/80" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email corporativo</Label>
                <Input type="email" value={form.emailCorporativo} onChange={e => setForm(f => ({ ...f, emailCorporativo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email pessoal (opcional)</Label>
                <Input type="email" value={form.emailPessoal ?? ''} onChange={e => setForm(f => ({ ...f, emailPessoal: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone principal</Label>
                <Input value={form.telefonePrincipal} onChange={e => setForm(f => ({ ...f, telefonePrincipal: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefone alternativo (opcional)</Label>
                <Input value={form.telefoneAlternativo ?? ''} onChange={e => setForm(f => ({ ...f, telefoneAlternativo: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contacto emergência - Nome</Label>
                <Input value={form.contactoEmergenciaNome ?? ''} onChange={e => setForm(f => ({ ...f, contactoEmergenciaNome: e.target.value || undefined }))} />
              </div>
              <div className="space-y-2">
                <Label>Contacto emergência - Telefone</Label>
                <Input value={form.contactoEmergenciaTelefone ?? ''} onChange={e => setForm(f => ({ ...f, contactoEmergenciaTelefone: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusColaborador }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.nome.trim() || !form.emailCorporativo.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewItem?.nome}</DialogTitle>
            <DialogDescription>Ficha do colaborador</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Cargo:</span> {viewItem.cargo} · {viewItem.departamento}</p>
              <p><span className="text-muted-foreground">Admissão:</span> {formatDate(viewItem.dataAdmissao)} · {viewItem.tipoContrato}</p>
              <p><span className="text-muted-foreground">Salário base:</span> {formatKz(viewItem.salarioBase)}</p>
              <p><span className="text-muted-foreground">Email:</span> {viewItem.emailCorporativo}</p>
              <p><span className="text-muted-foreground">Telefone:</span> {viewItem.telefonePrincipal}</p>
              <p><span className="text-muted-foreground">BI/NIF:</span> {viewItem.bi} / {viewItem.nif}</p>
              <p><span className="text-muted-foreground">Endereço:</span> {viewItem.endereco}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
