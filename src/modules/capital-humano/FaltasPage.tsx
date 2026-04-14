import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatarDuracaoHorasMinutos, SEGUNDOS_ATRASO_POR_FALTA } from '@/lib/pontoHorario';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import { useAuth } from '@/context/AuthContext';
import type { Falta, TipoFalta } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Pencil, Eye, Trash2 } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const TIPO_OPTIONS: TipoFalta[] = ['Justificada', 'Injustificada', 'Atestado Médico', 'Licença', 'Por atrasos'];
/** «Por atrasos» é criada pelo sistema; não entra no select de registo manual. */
const TIPO_OPTIONS_MANUAL: TipoFalta[] = ['Justificada', 'Injustificada', 'Atestado Médico', 'Licença'];

function chaveAtrasoMes(colaboradorId: number, mesAno: string): string {
  return `${colaboradorId}|${mesAno}`;
}

/** Texto curto para grelha: total acumulado no mês e limiar de cada falta automática (8 h). */
function textoAtrasoFaltaCelula(f: Falta, totaisMes: Map<string, number>): string {
  if (f.tipo !== 'Por atrasos') return '—';
  const mes = f.referenciaMesAtrasos?.trim();
  const limiar = formatarDuracaoHorasMinutos(SEGUNDOS_ATRASO_POR_FALTA);
  if (!mes) return `1×${limiar} por falta`;
  const total = totaisMes.get(chaveAtrasoMes(f.colaboradorId, mes));
  if (total != null) {
    return `${formatarDuracaoHorasMinutos(total)} acum. · +${limiar}/falta`;
  }
  return `+${limiar}/falta · ${mes}`;
}

function numeroFaltaAtrasoNoMes(f: Falta, todas: Falta[]): number | null {
  if (f.tipo !== 'Por atrasos' || !f.referenciaMesAtrasos) return null;
  const ordem = todas
    .filter(
      x =>
        x.tipo === 'Por atrasos' &&
        x.referenciaMesAtrasos === f.referenciaMesAtrasos &&
        x.colaboradorId === f.colaboradorId,
    )
    .sort((a, b) => a.id - b.id);
  const i = ordem.findIndex(x => x.id === f.id);
  return i >= 0 ? i + 1 : null;
}

const LIST_PATH = '/capital-humano/faltas';
const NOVO_PATH = '/capital-humano/faltas/novo';

export default function FaltasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { faltas, addFalta, updateFalta, deleteFalta, colaboradores } = useData();
  const isMobileViewport = useIsMobileViewport();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoFalta | 'todos'>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Falta | null>(null);
  const [viewItem, setViewItem] = useState<Falta | null>(null);
  const [form, setForm] = useState<Omit<Falta, 'id'>>({
    colaboradorId: 0,
    data: new Date().toISOString().slice(0, 10),
    tipo: 'Justificada',
    motivo: '',
    registadoPor: user?.nome ?? '',
  });
  const [totaisAtrasoMes, setTotaisAtrasoMes] = useState<Map<string, number>>(() => new Map());

  const prepareCreate = useCallback(() => {
    setEditing(null);
    setForm({
      colaboradorId: colaboradores[0]?.id ?? 0,
      data: new Date().toISOString().slice(0, 10),
      tipo: 'Justificada',
      motivo: '',
      registadoPor: user?.nome ?? '',
    });
  }, [colaboradores, user?.nome]);

  const resetModal = useCallback(() => {
    setEditing(null);
    setForm({
      colaboradorId: colaboradores[0]?.id ?? 0,
      data: new Date().toISOString().slice(0, 10),
      tipo: 'Justificada',
      motivo: '',
      registadoPor: user?.nome ?? '',
    });
  }, [colaboradores, user?.nome]);

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
  const showMobileForm = showMobileCreate || (isMobileViewport && dialogOpen);

  const paresAtrasoConsulta = useMemo(() => {
    const colIds = new Set<number>();
    const meses = new Set<string>();
    for (const f of faltas) {
      if (f.tipo !== 'Por atrasos' || !f.referenciaMesAtrasos) continue;
      colIds.add(f.colaboradorId);
      meses.add(f.referenciaMesAtrasos.trim());
    }
    return { colIds: [...colIds], meses: [...meses] };
  }, [faltas]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || paresAtrasoConsulta.colIds.length === 0) {
      setTotaisAtrasoMes(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('colaborador_mes_atraso')
        .select('colaborador_id, mes_ano, total_segundos_atraso')
        .in('colaborador_id', paresAtrasoConsulta.colIds)
        .in('mes_ano', paresAtrasoConsulta.meses);
      if (cancelled) return;
      if (error) {
        console.warn('[colaborador_mes_atraso]', error.message);
        setTotaisAtrasoMes(new Map());
        return;
      }
      const m = new Map<string, number>();
      for (const row of data ?? []) {
        const r = row as {
          colaborador_id: number | string;
          mes_ano: string;
          total_segundos_atraso: number | string;
        };
        const cid = Number(r.colaborador_id);
        const sec = Number(r.total_segundos_atraso);
        if (Number.isFinite(cid) && r.mes_ano && Number.isFinite(sec)) {
          m.set(chaveAtrasoMes(cid, r.mes_ano.trim()), sec);
        }
      }
      setTotaisAtrasoMes(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [paresAtrasoConsulta]);

  const getColabName = (id: number) => colaboradores.find(c => c.id === id)?.nome ?? 'N/A';

  const filtered = faltas.filter(f => {
    const matchSearch = getColabName(f.colaboradorId).toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || f.tipo === tipoFilter;
    let matchDate = true;
    if (dataInicio) matchDate = matchDate && f.data >= dataInicio;
    if (dataFim) matchDate = matchDate && f.data <= dataFim;
    return matchSearch && matchTipo && matchDate;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('colab');
  const mobileComparators = useMemo(
    () => ({
      colab: (a: Falta, b: Falta) =>
        getColabName(a.colaboradorId).localeCompare(getColabName(b.colaboradorId), 'pt', { sensitivity: 'base' }),
      data: (a: Falta, b: Falta) => a.data.localeCompare(b.data),
    }),
    [colaboradores],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const viewAtrasoTotalSeg =
    viewItem?.tipo === 'Por atrasos' && viewItem.referenciaMesAtrasos
      ? totaisAtrasoMes.get(
          chaveAtrasoMes(viewItem.colaboradorId, viewItem.referenciaMesAtrasos.trim()),
        )
      : undefined;
  const viewAtrasoOrdem = viewItem ? numeroFaltaAtrasoNoMes(viewItem, faltas) : null;

  const openCreate = () => openCreateNavigateOrDialog();

  const openEdit = (f: Falta) => {
    setEditing(f);
    setForm({
      colaboradorId: f.colaboradorId,
      data: f.data,
      tipo: f.tipo,
      motivo: f.motivo,
      registadoPor: f.registadoPor,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.colaboradorId || !form.data) return;
    try {
      if (editing) await updateFalta(editing.id, form);
      else await addFalta(form);
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

  const remove = async (f: Falta) => {
    if (!window.confirm('Remover este registo de falta?')) return;
    try {
      await deleteFalta(f.id);
      toast.success('Registo de falta removido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Faltas & Efectividade</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Registar Falta
        </Button>
      </div>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Atrasos após o horário de entrada + 15 min são acumulados por mês (exceto colaboradores com isenção de horário).
        Cada 8 h de atraso acumulado gera uma falta do tipo «Por atrasos», registada pelo sistema com base nas marcações de
        ponto.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as TipoFalta | 'todos')}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {TIPO_OPTIONS.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px] h-9" placeholder="De" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px] h-9" placeholder="Até" />
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Atraso
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Motivo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Registado por</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(f => (
              <tr key={f.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{getColabName(f.colaboradorId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(f.data)}</td>
                <td className="py-3 px-5">{f.tipo}</td>
                <td className="py-3 px-5 text-muted-foreground whitespace-nowrap max-w-[200px] text-xs sm:text-sm">
                  {textoAtrasoFaltaCelula(f, totaisAtrasoMes)}
                </td>
                <td className="py-3 px-5 text-muted-foreground max-w-48 truncate">{f.motivo || '—'}</td>
                <td className="py-3 px-5 text-muted-foreground">{f.registadoPor}</td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewItem(f); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(f)}>×</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={f => f.id}
          sortBar={{
            options: [
              { key: 'colab', label: 'Colaborador' },
              { key: 'data', label: 'Data' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={f => ({
            title: getColabName(f.colaboradorId),
            trailing: <span className="max-w-[40%] truncate text-xs text-muted-foreground">{f.tipo}</span>,
          })}
          renderDetails={f => [
            { label: 'Data', value: formatDate(f.data) },
            { label: 'Tipo', value: f.tipo },
            { label: 'Atraso', value: textoAtrasoFaltaCelula(f, totaisAtrasoMes) },
            { label: 'Motivo', value: f.motivo?.trim() ? f.motivo : '—' },
            { label: 'Registado por', value: f.registadoPor },
          ]}
          renderActions={f => (
            <>
              <Button type="button" className="min-h-11 flex-1 gap-2" onClick={() => { setViewItem(f); setViewOpen(true); }}>
                <Eye className="h-4 w-4 shrink-0" />
                Ver
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openEdit(f)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(f)}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        />
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma falta encontrada.</p>}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileForm}
          onCloseMobile={() => onDialogOpenChange(false)}
          moduleKicker="Capital Humano"
          screenTitle={editing ? 'Editar falta' : 'Registar falta'}
          desktopContentClassName="max-w-lg max-h-[90vh] overflow-y-auto"
          desktopHeader={mobileCreateDesktopHeader(editing ? 'Editar falta' : 'Registar falta', 'Dados da falta.')}
          formBody={
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={form.colaboradorId ? String(form.colaboradorId) : ''} onValueChange={v => setForm(f => ({ ...f, colaboradorId: Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome} — {c.departamento}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoFalta }))}
                    disabled={editing?.tipo === 'Por atrasos'}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(editing?.tipo === 'Por atrasos' ? (['Por atrasos'] as TipoFalta[]) : TIPO_OPTIONS_MANUAL).map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Opcional para injustificada" />
              </div>
              <div className="space-y-2">
                <Label>Registado por</Label>
                <Input value={form.registadoPor} onChange={e => setForm(f => ({ ...f, registadoPor: e.target.value }))} />
              </div>
            </div>
          }
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void save()} disabled={!form.colaboradorId || !form.data}>
                Guardar
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
              <Button
                type="button"
                className="min-h-11 flex-1 rounded-xl"
                disabled={!form.colaboradorId || !form.data}
                onClick={() => void save()}
              >
                Guardar
              </Button>
            </div>
          }
        />
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Falta — {viewItem && getColabName(viewItem.colaboradorId)}</DialogTitle>
            <DialogDescription>Detalhe</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)}</p>
              <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
              <p><span className="text-muted-foreground">Motivo:</span> {viewItem.motivo || '—'}</p>
              <p><span className="text-muted-foreground">Registado por:</span> {viewItem.registadoPor}</p>
              {viewItem.tipo === 'Por atrasos' ? (
                <>
                  <p>
                    <span className="text-muted-foreground">Atraso no mês:</span>{' '}
                    {viewItem.referenciaMesAtrasos ? (
                      viewAtrasoTotalSeg != null
                        ? `${formatarDuracaoHorasMinutos(viewAtrasoTotalSeg)} acumulados (após tolerância de 15 min, calendário Luanda).`
                        : 'Total do mês indisponível (sem registo em colaborador_mes_atraso ou sem permissão).'
                    ) : (
                      '—'
                    )}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Esta falta:</span>{' '}
                    corresponde a ultrapassar mais um limiar de{' '}
                    {formatarDuracaoHorasMinutos(SEGUNDOS_ATRASO_POR_FALTA)} de atraso acumulado no mês.
                    {viewAtrasoOrdem != null
                      ? ` (${viewAtrasoOrdem}.ª falta «Por atrasos» desse mês e colaborador.)`
                      : null}
                  </p>
                </>
              ) : null}
              {viewItem.referenciaMesAtrasos ? (
                <p><span className="text-muted-foreground">Mês de referência (atrasos):</span> {viewItem.referenciaMesAtrasos}</p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
