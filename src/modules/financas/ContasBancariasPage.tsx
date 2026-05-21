import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { ContaBancariaCard } from '@/modules/financas/ContaBancariaCard';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import type { ContaBancaria } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LIST_PATH = '/financas/contas-bancarias';
const NOVO_PATH = '/financas/contas-bancarias/novo';

export default function ContasBancariasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bancos, contasBancarias, empresas, addContaBancaria, updateContaBancaria, deleteContaBancaria, refetch } =
    useData();
  const { currentEmpresaId } = useTenant();
  const canAccessFinancas = hasModuleAccess(user, 'financas');
  const showEmpresaOnCards = currentEmpresaId === 'consolidado';

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
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
  const pagination = useClientSidePagination({ items: filtered, pageSize: 12 });

  const bancoNome = (id: number) => bancos.find(b => b.id === id)?.nome ?? `#${id}`;
  const bancoCodigo = (id: number) => bancos.find(b => b.id === id)?.codigo;
  const empresaNome = (id: number) => empresas.find(e => e.id === id)?.nome ?? String(id);

  const refreshSaldos = useCallback(async () => {
    setRefreshingAll(true);
    try {
      await refetch();
      toast.success('Saldos actualizados.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao actualizar.');
    } finally {
      setRefreshingAll(false);
    }
  }, [refetch]);

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

  const totalSaldo = useMemo(
    () => filtered.reduce((s, c) => s + c.saldoActual, 0),
    [filtered],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Contas bancárias</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Visão por cartão de cada conta. O saldo reflecte movimentos de tesouraria e o saldo inicial definido ao criar a conta.
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar conta, banco..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {filtered.length > 0 ? (
          <p className="text-xs text-muted-foreground sm:text-right">
            {filtered.length} conta{filtered.length === 1 ? '' : 's'}
            {showEmpresaOnCards ? '' : ` · saldo total filtrado: ${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalSaldo)} Kz`}
          </p>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">Nenhuma conta neste contexto.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pagination.slice.map(c => (
            <ContaBancariaCard
              key={c.id}
              conta={c}
              bancoNome={bancoNome(c.bancoId)}
              bancoCodigo={bancoCodigo(c.bancoId)}
              empresaNome={empresaNome(c.empresaId)}
              showEmpresa={showEmpresaOnCards}
              canManage={canAccessFinancas}
              onRefresh={() => void refreshSaldos()}
              refreshing={refreshingAll}
              onEdit={() => openEdit(c)}
              onDelete={() => void remove(c)}
            />
          ))}
        </div>
      )}

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
                    O mesmo banco pode ter várias contas nesta empresa: escolha o banco e use um{' '}
                    <strong className="text-foreground">número de conta diferente</strong> em cada registo.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Número da conta</Label>
                <Input
                  value={form.numeroConta}
                  onChange={e => setForm(f => ({ ...f, numeroConta: e.target.value }))}
                  placeholder="IBAN ou número interno (único por banco e empresa)"
                />
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
                <Input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex.: Conta principal"
                />
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
