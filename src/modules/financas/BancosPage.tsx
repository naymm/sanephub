import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Banco } from '@/types';
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
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function BancosPage() {
  const { user } = useAuth();
  const { bancos, addBanco, updateBanco, deleteBanco } = useData();
  const isAdmin = user?.perfil === 'Admin';

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Banco | null>(null);
  const [form, setForm] = useState({ nome: '', codigo: '', activo: true });

  const filtered = bancos.filter(
    b =>
      b.nome.toLowerCase().includes(search.toLowerCase()) ||
      (b.codigo ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const pagination = useClientSidePagination({ items: filtered, pageSize: 20 });

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: '', codigo: '', activo: true });
    setDialogOpen(true);
  };

  const openEdit = (b: Banco) => {
    setEditing(b);
    setForm({ nome: b.nome, codigo: b.codigo ?? '', activo: b.activo });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) {
      toast.error('Indique o nome do banco.');
      return;
    }
    try {
      const payload = {
        nome: form.nome.trim(),
        codigo: form.codigo.trim() || undefined,
        activo: form.activo,
      };
      if (editing) await updateBanco(editing.id, payload);
      else await addBanco(payload);
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? 'Banco actualizado.' : 'Banco registado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (b: Banco) => {
    if (!confirm(`Remover o banco «${b.nome}»? Só é possível se não existirem contas associadas.`)) return;
    try {
      await deleteBanco(b.id);
      toast.success('Banco removido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="page-header">Bancos</h1>
        <p className="text-sm text-muted-foreground">Apenas administradores podem gerir o catálogo de bancos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Bancos</h1>
          <p className="text-sm text-muted-foreground mt-1">Catálogo global de bancos (apenas Admin).</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo banco
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Nome</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Código</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Estado</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(b => (
              <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-3 px-4 font-medium">{b.nome}</td>
                <td className="py-3 px-4 text-muted-foreground">{b.codigo ?? '—'}</td>
                <td className="py-3 px-4">{b.activo ? <span className="text-green-600">Activo</span> : <span className="text-muted-foreground">Inactivo</span>}</td>
                <td className="py-3 px-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(b)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum banco encontrado.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar banco' : 'Novo banco'}</DialogTitle>
            <DialogDescription>Nome único no sistema; código opcional (ex. SWIFT abreviado).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Banco BFA" />
            </div>
            <div className="space-y-2">
              <Label>Código (opcional)</Label>
              <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex.: BFA" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="activo" checked={form.activo} onCheckedChange={v => setForm(f => ({ ...f, activo: v === true }))} />
              <Label htmlFor="activo" className="font-normal cursor-pointer">Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
