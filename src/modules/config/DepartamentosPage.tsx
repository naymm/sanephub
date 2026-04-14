import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import type { Departamento } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const LIST_PATH = '/configuracoes/departamentos';
const NOVO_PATH = '/configuracoes/departamentos/novo';

export default function DepartamentosPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { departamentos, addDepartamento, updateDepartamento, deleteDepartamento } = useData();
  const isMobileViewport = useIsMobileViewport();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Departamento | null>(null);
  const [form, setForm] = useState({ nome: '' });

  const prepareCreate = useCallback(() => {
    setEditing(null);
    setForm({ nome: '' });
  }, []);
  const resetModal = useCallback(() => {
    setEditing(null);
    setForm({ nome: '' });
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

  const filtered = departamentos.filter(d =>
    d.nome.toLowerCase().includes(search.toLowerCase())
  );
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('nome');
  const mobileComparators = useMemo(
    () => ({ nome: (a: Departamento, b: Departamento) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }) }),
    [],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const openCreate = () => openCreateNavigateOrDialog();

  const openEdit = (d: Departamento) => {
    setEditing(d);
    setForm({ nome: d.nome });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) return;
    const nome = form.nome.trim();
    try {
      if (editing) await updateDepartamento(editing.id, { nome });
      else await addDepartamento({ nome });
      setDialogOpen(false);
      setEditing(null);
      if (isNovoRoute) {
        endMobileCreateFlow();
        navigate(LIST_PATH, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (d: Departamento) => {
    if (!window.confirm(`Remover departamento "${d.nome}"?`)) return;
    try {
      await deleteDepartamento(d.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const formBody = (
    <div className="grid gap-4 py-2">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input
          value={form.nome}
          onChange={e => setForm({ nome: e.target.value })}
          placeholder="ex: Tecnologia"
        />
      </div>
    </div>
  );

  const title = editing ? 'Editar departamento' : 'Novo departamento';
  const showMobileForm = showMobileCreate || (isMobileViewport && dialogOpen);

  if (currentUser?.perfil !== 'Admin') {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Departamentos</h1>
        <p className="text-muted-foreground">Acesso reservado ao Administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Departamentos</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo departamento
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Cadastre os departamentos da organização. Eles serão usados nas requisições à área financeira e noutros módulos.
      </p>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(d => (
              <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{d.nome}</td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d)} title="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={d => d.id}
          sortBar={{
            options: [{ key: 'nome', label: 'Nome' }],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={d => ({ title: d.nome })}
          renderDetails={d => [{ label: 'Nome', value: d.nome }]}
          renderActions={d => (
            <>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openEdit(d)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(d)}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum departamento encontrado.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileForm}
          onCloseMobile={() => onDialogOpenChange(false)}
          moduleKicker="Configurações"
          screenTitle={title}
          desktopContentClassName="max-w-sm max-h-[90vh] overflow-y-auto"
          desktopHeader={mobileCreateDesktopHeader(title, 'Indique o nome do departamento.')}
          formBody={formBody}
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!form.nome.trim()}>
                {editing ? 'Guardar' : 'Criar'}
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 rounded-xl"
                onClick={() => onDialogOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="button" className="min-h-11 flex-1 rounded-xl" disabled={!form.nome.trim()} onClick={() => void save()}>
                {editing ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          }
        />
      </Dialog>
    </div>
  );
}
