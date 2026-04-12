import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import type { ContaBancaria } from '@/types';
import { formatKz } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const LIST_PATH = '/financas/contas-bancarias';
const NOVO_PATH = '/financas/contas-bancarias/novo';

export default function ContasBancariasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bancos, contasBancarias, empresas, addContaBancaria, updateContaBancaria, deleteContaBancaria } = useData();
  const { currentEmpresaId } = useTenant();
  const canAccessFinancas = hasModuleAccess(user, 'financas');

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
  const [form, setForm] = useState({
    empresaId: empresaIdForNew,
    bancoId: 0,
    numeroConta: '',
    saldoActual: 0,
    descricao: '',
  });

  const bancosActivos = bancos.filter(b => b.activo).sort((a, b) => a.nome.localeCompare(b.nome));

  const prepareCreate = useCallback(() => {
    setEditing(null);
    const firstBanco = bancosActivos[0]?.id ?? 0;
    setForm({
      empresaId: empresaIdForNew,
      bancoId: firstBanco,
      numeroConta: '',
      saldoActual: 0,
      descricao: '',
    });
  }, [empresaIdForNew, bancosActivos]);

  const resetModal = useCallback(() => {
    setEditing(null);
    const firstBanco = bancosActivos[0]?.id ?? 0;
    setForm({
      empresaId: empresaIdForNew,
      bancoId: firstBanco,
      numeroConta: '',
      saldoActual: 0,
      descricao: '',
    });
  }, [empresaIdForNew, bancosActivos]);

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

  const filtered = contasBancarias.filter(c => {
    const bancoNome = bancos.find(b => b.id === c.bancoId)?.nome ?? '';
    const q = search.toLowerCase();
    return (
      !q ||
      c.numeroConta.toLowerCase().includes(q) ||
      bancoNome.toLowerCase().includes(q) ||
      (c.descricao ?? '').toLowerCase().includes(q)
    );
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 20 });

  const bancoNome = (id: number) => bancos.find(b => b.id === id)?.nome ?? `#${id}`;
  const empresaNome = (id: number) => empresas.find(e => e.id === id)?.nome ?? String(id);

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('empresa');
  const mobileComparators = useMemo(
    () => ({
      empresa: (a: ContaBancaria, b: ContaBancaria) =>
        empresaNome(a.empresaId).localeCompare(empresaNome(b.empresaId), 'pt', { sensitivity: 'base' }),
      banco: (a: ContaBancaria, b: ContaBancaria) =>
        bancoNome(a.bancoId).localeCompare(bancoNome(b.bancoId), 'pt', { sensitivity: 'base' }),
      conta: (a: ContaBancaria, b: ContaBancaria) => a.numeroConta.localeCompare(b.numeroConta, 'pt', { sensitivity: 'base' }),
      saldo: (a: ContaBancaria, b: ContaBancaria) => a.saldoActual - b.saldoActual,
    }),
    [bancos, empresas],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const openCreate = () => openCreateNavigateOrDialog();

  const openEdit = (c: ContaBancaria) => {
    setEditing(c);
    setForm({
      empresaId: c.empresaId,
      bancoId: c.bancoId,
      numeroConta: c.numeroConta,
      saldoActual: c.saldoActual,
      descricao: c.descricao ?? '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.numeroConta.trim()) {
      toast.error('Indique o número da conta.');
      return;
    }
    if (!form.bancoId) {
      toast.error('Seleccione um banco.');
      return;
    }
    try {
      const payload = {
        empresaId: form.empresaId,
        bancoId: form.bancoId,
        numeroConta: form.numeroConta.trim(),
        saldoActual: form.saldoActual,
        descricao: form.descricao.trim() || undefined,
      };
      if (editing) await updateContaBancaria(editing.id, payload);
      else await addContaBancaria(payload);
      setDialogOpen(false);
      setEditing(null);
      if (isNovoRoute) {
        endMobileCreateFlow();
        navigate(LIST_PATH, { replace: true });
      }
      toast.success(editing ? 'Conta actualizada.' : 'Conta criada.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate key|unique constraint|23505/i.test(msg)) {
        toast.error('Já existe nesta empresa uma conta neste banco com esse número. O mesmo banco pode ter várias contas — use um número de conta diferente.');
      } else {
        toast.error(msg || 'Erro ao guardar');
      }
    }
  };

  const remove = async (c: ContaBancaria) => {
    if (!confirm(`Remover a conta «${bancoNome(c.bancoId)} — ${c.numeroConta}»?`)) return;
    try {
      await deleteContaBancaria(c.id);
      toast.success('Conta removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Contas bancárias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Por empresa: o mesmo banco pode ter <strong className="text-foreground font-medium">várias contas</strong> (cada uma com número distinto). O <strong className="text-foreground">saldo actual</strong> actualiza-se com os movimentos de tesouraria em que essa conta está seleccionada (e com o saldo inicial ao criar a conta). Quem tem acesso a Finanças pode gerir contas.
          </p>
        </div>
        {canAccessFinancas && (
          <Button onClick={openCreate} disabled={bancosActivos.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Nova conta
          </Button>
        )}
      </div>

      {bancosActivos.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          Não há bancos activos no catálogo. Um administrador deve registar bancos em Finanças → Bancos.
        </p>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar conta, banco..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Empresa</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Banco</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">N.º conta</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Saldo actual</th>
              {/* <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Acções</th> */}
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-3 px-4">{empresaNome(c.empresaId)}</td>
                <td className="py-3 px-4">{bancoNome(c.bancoId)}</td>
                <td className="py-3 px-4 font-mono text-xs">{c.numeroConta}</td>
                <td className="py-3 px-4 text-right font-mono">{formatKz(c.saldoActual)}</td>
                {/* <td className="py-3 px-4 text-right">
                  {canAccessFinancas && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={c => c.id}
          sortBar={{
            options: [
              { key: 'empresa', label: 'Empresa' },
              { key: 'banco', label: 'Banco' },
              { key: 'conta', label: 'N.º conta' },
              { key: 'saldo', label: 'Saldo' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={c => ({
            title: `${bancoNome(c.bancoId)} · ${c.numeroConta}`,
            trailing: <span className="text-xs font-mono text-muted-foreground">{formatKz(c.saldoActual)}</span>,
          })}
          renderDetails={c => [
            { label: 'Empresa', value: empresaNome(c.empresaId) },
            { label: 'Banco', value: bancoNome(c.bancoId) },
            { label: 'N.º conta', value: <span className="font-mono text-xs">{c.numeroConta}</span> },
            { label: 'Saldo actual', value: formatKz(c.saldoActual) },
          ]}
        />
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma conta neste contexto.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={closeMobileCreate}
          moduleKicker="Finanças"
          screenTitle={editing ? 'Editar conta' : 'Nova conta bancária'}
          desktopContentClassName="max-w-md max-h-[90vh] overflow-y-auto"
          desktopHeader={mobileCreateDesktopHeader(
            editing ? 'Editar conta' : 'Nova conta bancária',
            editing
              ? 'O saldo pode ser ajustado manualmente; movimentos de tesouraria com esta conta actualizam o saldo.'
              : 'Se o saldo inicial for maior que zero, é criada automaticamente uma entrada na tesouraria com o mesmo valor, associada a esta conta.',
          )}
          formBody={
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select
                  value={String(form.empresaId)}
                  onValueChange={v => setForm(f => ({ ...f, empresaId: Number(v) }))}
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
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select
                  value={form.bancoId ? String(form.bancoId) : ''}
                  onValueChange={v => setForm(f => ({ ...f, bancoId: Number(v) }))}
                  disabled={!!editing}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar banco" /></SelectTrigger>
                  <SelectContent>
                    {bancosActivos.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!editing && (
                  <p className="text-xs text-muted-foreground">
                    O mesmo banco pode ter várias contas nesta empresa: escolha o banco e use um <strong className="text-foreground">número de conta diferente</strong> em cada registo.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Número da conta</Label>
                <Input value={form.numeroConta} onChange={e => setForm(f => ({ ...f, numeroConta: e.target.value }))} placeholder="IBAN ou número interno (único por banco e empresa)" />
              </div>
              <div className="space-y-2">
                <Label>Saldo actual (Kz)</Label>
                <Input
                  type="number"
                  value={form.saldoActual}
                  onChange={e => setForm(f => ({ ...f, saldoActual: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Conta principal" />
              </div>
            </div>
          }
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void save()} disabled={!canAccessFinancas}>
                Guardar
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={closeMobileCreate}>
                Cancelar
              </Button>
              <Button type="button" className="min-h-11 flex-1 rounded-xl" onClick={() => void save()} disabled={!canAccessFinancas}>
                Guardar
              </Button>
            </div>
          }
        />
      </Dialog>
    </div>
  );
}
