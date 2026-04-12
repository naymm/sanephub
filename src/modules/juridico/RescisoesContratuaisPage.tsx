import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import type { RescisaoContrato, TipoRescisao } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const LIST_PATH = '/juridico/rescisoes';
const NOVO_PATH = '/juridico/rescisoes/novo';

const TIPOS_RESCISAO: TipoRescisao[] = ['Resolução', 'Revogação', 'Caducidade'];

export default function RescisoesContratuaisPage() {
  const navigate = useNavigate();
  const { rescissoesContrato, addRescisaoContrato, contratos, empresas } = useData();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<RescisaoContrato> & { contratoId?: number }>({
    tipo: 'Resolução',
    motivoDetalhado: '',
    dataRescisao: new Date().toISOString().slice(0, 10),
    documentoPdf: '',
  });

  const canEdit = user?.perfil === 'Admin';
  const pagination = useClientSidePagination({ items: rescissoesContrato, pageSize: 25 });

  const prepareCreate = useCallback(() => {
    const activos = contratos.filter(c => c.status !== 'Rescindido' && c.status !== 'Expirado');
    const primeiroContrato = activos[0];
    setForm({
      contratoId: primeiroContrato?.id,
      empresaId: primeiroContrato?.empresaId ?? 1,
      tipo: 'Resolução',
      motivoDetalhado: '',
      dataRescisao: new Date().toISOString().slice(0, 10),
      documentoPdf: '',
    });
  }, [contratos]);

  const resetModal = useCallback(() => {
    const activos = contratos.filter(c => c.status !== 'Rescindido' && c.status !== 'Expirado');
    const primeiroContrato = activos[0];
    setForm({
      contratoId: primeiroContrato?.id,
      empresaId: primeiroContrato?.empresaId ?? 1,
      tipo: 'Resolução',
      motivoDetalhado: '',
      dataRescisao: new Date().toISOString().slice(0, 10),
      documentoPdf: '',
    });
  }, [contratos]);

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

  const getContrato = (id: number) => contratos.find(c => c.id === id);
  const getEmpresaNome = (empresaId: number) =>
    empresas.find(e => e.id === empresaId)?.nome ?? `Empresa ${empresaId}`;

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('dataRescisao');
  const mobileComparators = useMemo(
    () => ({
      dataRescisao: (a: RescisaoContrato, b: RescisaoContrato) => a.dataRescisao.localeCompare(b.dataRescisao),
      tipo: (a: RescisaoContrato, b: RescisaoContrato) => a.tipo.localeCompare(b.tipo, 'pt', { sensitivity: 'base' }),
      contrato: (a: RescisaoContrato, b: RescisaoContrato) => {
        const na = contratos.find(c => c.id === a.contratoId)?.numero ?? '';
        const nb = contratos.find(c => c.id === b.contratoId)?.numero ?? '';
        return na.localeCompare(nb, 'pt', { sensitivity: 'base' });
      },
      empresa: (a: RescisaoContrato, b: RescisaoContrato) =>
        getEmpresaNome(a.empresaId).localeCompare(getEmpresaNome(b.empresaId), 'pt', { sensitivity: 'base' }),
    }),
    [contratos, empresas],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const contratosActivos = contratos.filter(c => c.status !== 'Rescindido' && c.status !== 'Expirado');

  const openCreate = () => openCreateNavigateOrDialog();

  const onContratoChange = (contratoIdStr: string) => {
    const cid = Number(contratoIdStr);
    const c = contratos.find(x => x.id === cid);
    setForm(f => ({ ...f, contratoId: cid, empresaId: c?.empresaId ?? f.empresaId }));
  };

  const save = async () => {
    if (!form.contratoId || !form.motivoDetalhado?.trim() || !form.dataRescisao || !form.empresaId) return;
    const payload: Partial<RescisaoContrato> = {
      contratoId: form.contratoId,
      empresaId: form.empresaId,
      tipo: form.tipo ?? 'Resolução',
      motivoDetalhado: form.motivoDetalhado.trim(),
      dataRescisao: form.dataRescisao,
      documentoPdf: form.documentoPdf?.trim() || undefined,
      criadoPor: user?.nome ?? 'Sistema',
      criadoEm: new Date().toISOString(),
    };
    try {
      await addRescisaoContrato(payload);
      setDialogOpen(false);
      if (isNovoRoute) {
        endMobileCreateFlow();
        navigate(LIST_PATH, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Rescisões Contratuais</h1>
          <p className="text-sm text-muted-foreground">
            Registo estruturado de resoluções, revogações e caducidades de contratos do grupo.
          </p>
        </div>
        {canEdit && contratosActivos.length > 0 && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Registar rescisão
          </Button>
        )}
      </div>

      <div className="hidden md:block table-container overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Contrato</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo de rescisão</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Data de rescisão</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Motivo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Documento</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Registado</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(r => {
              const contrato = getContrato(r.contratoId);
              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">{contrato?.numero ?? `Contrato #${r.contratoId}`}</span>
                      {contrato && (
                        <span className="text-xs text-muted-foreground truncate max-w-[260px]" title={contrato.objecto}>
                          {contrato.objecto}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{getEmpresaNome(r.empresaId)}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                      {r.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(r.dataRescisao)}</td>
                  <td className="p-3 text-muted-foreground max-w-[320px] truncate" title={r.motivoDetalhado}>
                    {r.motivoDetalhado}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {r.documentoPdf ? (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {r.documentoPdf}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {r.criadoPor} — {formatDate(r.criadoEm.slice(0, 10))}
                  </td>
                </tr>
              );
            })}
            {rescissoesContrato.length === 0 && (
              <tr>
                <td className="p-4 text-center text-muted-foreground text-sm" colSpan={7}>
                  Nenhuma rescisão contratual registada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={r => r.id}
          sortBar={{
            options: [
              { key: 'contrato', label: 'Contrato' },
              { key: 'empresa', label: 'Empresa' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'dataRescisao', label: 'Data' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={r => {
            const contrato = getContrato(r.contratoId);
            return {
              title: contrato?.numero ?? `Contrato #${r.contratoId}`,
              trailing: (
                <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                  {r.tipo}
                </span>
              ),
            };
          }}
          renderDetails={r => {
            const contrato = getContrato(r.contratoId);
            return [
              {
                label: 'Contrato',
                value: (
                  <span>
                    <span className="font-mono text-xs">{contrato?.numero ?? `Contrato #${r.contratoId}`}</span>
                    {contrato ? (
                      <span className="block text-xs text-muted-foreground mt-1">{contrato.objecto}</span>
                    ) : null}
                  </span>
                ),
              },
              { label: 'Empresa', value: getEmpresaNome(r.empresaId) },
              { label: 'Tipo de rescisão', value: r.tipo },
              { label: 'Data de rescisão', value: formatDate(r.dataRescisao) },
              { label: 'Motivo', value: r.motivoDetalhado },
              {
                label: 'Documento',
                value: r.documentoPdf ? (
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {r.documentoPdf}
                  </span>
                ) : (
                  '—'
                ),
              },
              { label: 'Registado', value: `${r.criadoPor} — ${formatDate(r.criadoEm.slice(0, 10))}` },
            ];
          }}
        />
      </div>

      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileCreate}
          onCloseMobile={closeMobileCreate}
          moduleKicker="Jurídico"
          screenTitle="Registar rescisão contratual"
          desktopContentClassName="max-w-lg"
          desktopHeader={mobileCreateDesktopHeader(
            'Registar rescisão contratual',
            'Associa a rescisão a um contrato e regista tipo, data e motivo. Opcionalmente indica o nome do ficheiro PDF do documento.',
          )}
          formBody={
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={form.contratoId != null ? String(form.contratoId) : ''} onValueChange={onContratoChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar contrato" /></SelectTrigger>
                <SelectContent>
                  {contratosActivos.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.numero} — {c.objecto.slice(0, 50)}{c.objecto.length > 50 ? '…' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de rescisão</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoRescisao }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_RESCISAO.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de rescisão</Label>
                <Input type="date" value={form.dataRescisao || ''} onChange={e => setForm(f => ({ ...f, dataRescisao: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo (detalhado)</Label>
              <Textarea value={form.motivoDetalhado} onChange={e => setForm(f => ({ ...f, motivoDetalhado: e.target.value }))} rows={4} placeholder="Descreva o motivo da rescisão..." required />
            </div>
            <div className="space-y-2">
              <Label>Documento PDF (nome do ficheiro)</Label>
              <Input value={form.documentoPdf} onChange={e => setForm(f => ({ ...f, documentoPdf: e.target.value }))} placeholder="Ex.: rescisao_CONT-2024-0012.pdf" />
            </div>
          </div>
          }
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => void save()}
                disabled={!form.contratoId || !form.motivoDetalhado?.trim() || !form.dataRescisao}
              >
                Registar rescisão
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={closeMobileCreate}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1 rounded-xl"
                disabled={!form.contratoId || !form.motivoDetalhado?.trim() || !form.dataRescisao}
                onClick={() => void save()}
              >
                Registar rescisão
              </Button>
            </div>
          }
        />
      </Dialog>
    </div>
  );
}
