import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';
import type { Falta, TipoFalta } from '@/types';
import { formatDate } from '@/utils/formatters';
import { formatarDuracaoHorasMinutos, SEGUNDOS_ATRASO_POR_FALTA } from '@/lib/pontoHorario';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  chaveAtrasoMes,
  numeroFaltaAtrasoNoMes,
  textoAtrasoFaltaCelula,
} from '@/modules/portal/portalFaltasUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TIPO_OPTIONS: TipoFalta[] = ['Justificada', 'Injustificada', 'Atestado Médico', 'Licença', 'Por atrasos'];

function badgeTipoClass(tipo: TipoFalta): string {
  switch (tipo) {
    case 'Justificada':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
    case 'Atestado Médico':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200';
    case 'Licença':
      return 'border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200';
    case 'Por atrasos':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100';
    default:
      return 'border-destructive/40 bg-destructive/10 text-destructive';
  }
}

export default function PortalFaltasPage() {
  const colaboradorId = useColaboradorId();
  const { faltas } = useData();

  const [tipoFilter, setTipoFilter] = useState<TipoFalta | 'todos'>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Falta | null>(null);
  const [totaisAtrasoMes, setTotaisAtrasoMes] = useState<Map<string, number>>(() => new Map());

  const minhasFaltas = useMemo(
    () => (colaboradorId == null ? [] : faltas.filter(f => f.colaboradorId === colaboradorId)),
    [faltas, colaboradorId],
  );

  const mesActual = new Date().toISOString().slice(0, 7);

  const resumo = useMemo(() => {
    const noMes = minhasFaltas.filter(f => f.data.startsWith(mesActual));
    return {
      total: minhasFaltas.length,
      noMes: noMes.length,
      porAtrasos: minhasFaltas.filter(f => f.tipo === 'Por atrasos').length,
      justificadas: minhasFaltas.filter(f => f.tipo === 'Justificada' || f.tipo === 'Atestado Médico').length,
    };
  }, [minhasFaltas, mesActual]);

  const filtered = useMemo(() => {
    return minhasFaltas.filter(f => {
      const matchTipo = tipoFilter === 'todos' || f.tipo === tipoFilter;
      let matchDate = true;
      if (dataInicio) matchDate = matchDate && f.data >= dataInicio;
      if (dataFim) matchDate = matchDate && f.data <= dataFim;
      return matchTipo && matchDate;
    });
  }, [minhasFaltas, tipoFilter, dataInicio, dataFim]);

  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('data');
  const mobileComparators = useMemo(
    () => ({
      data: (a: Falta, b: Falta) => b.data.localeCompare(a.data),
      tipo: (a: Falta, b: Falta) => a.tipo.localeCompare(b.tipo, 'pt', { sensitivity: 'base' }),
    }),
    [],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const paresAtrasoConsulta = useMemo(() => {
    const meses = new Set<string>();
    for (const f of minhasFaltas) {
      if (f.tipo !== 'Por atrasos' || !f.referenciaMesAtrasos) continue;
      meses.add(f.referenciaMesAtrasos.trim());
    }
    return { colaboradorId, meses: [...meses] };
  }, [minhasFaltas, colaboradorId]);

  useEffect(() => {
    if (
      !isSupabaseConfigured() ||
      !supabase ||
      colaboradorId == null ||
      paresAtrasoConsulta.meses.length === 0
    ) {
      setTotaisAtrasoMes(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('colaborador_mes_atraso')
        .select('colaborador_id, mes_ano, total_segundos_atraso')
        .eq('colaborador_id', colaboradorId)
        .in('mes_ano', paresAtrasoConsulta.meses);
      if (cancelled) return;
      if (error) {
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
  }, [paresAtrasoConsulta, colaboradorId]);

  const viewAtrasoTotalSeg =
    viewItem?.tipo === 'Por atrasos' && viewItem.referenciaMesAtrasos
      ? totaisAtrasoMes.get(chaveAtrasoMes(viewItem.colaboradorId, viewItem.referenciaMesAtrasos.trim()))
      : undefined;
  const viewAtrasoOrdem = viewItem ? numeroFaltaAtrasoNoMes(viewItem, minhasFaltas) : null;

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">As Minhas Faltas</h1>
        <p className="text-muted-foreground text-center py-12">
          Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">As Minhas Faltas</h1>
        <p className="text-sm text-muted-foreground max-w-3xl mt-2">
          Consulta das faltas registadas pelos Recursos Humanos ou geradas automaticamente por atrasos
          acumulados. Não é possível criar ou alterar registos neste portal — contacte os RH para
          justificações ou correcções.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{resumo.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Este mês</CardDescription>
            <CardTitle className="text-2xl">{resumo.noMes}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Por atrasos</CardDescription>
            <CardTitle className="text-2xl">{resumo.porAtrasos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Justificadas / atestado</CardDescription>
            <CardTitle className="text-2xl">{resumo.justificadas}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as TipoFalta | 'todos')}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPO_OPTIONS.map(t => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dataInicio}
          onChange={e => setDataInicio(e.target.value)}
          className="w-[150px] h-9"
          aria-label="Data de"
        />
        <Input
          type="date"
          value={dataFim}
          onChange={e => setDataFim(e.target.value)}
          className="w-[150px] h-9"
          aria-label="Data até"
        />
        {(dataInicio || dataFim || tipoFilter !== 'todos') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDataInicio('');
              setDataFim('');
              setTipoFilter('todos');
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Data
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tipo
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Atraso (mês)
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Motivo
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Registado por
              </th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Acções
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(f => (
              <tr key={f.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{formatDate(f.data)}</td>
                <td className="py-3 px-5">
                  <Badge variant="outline" className={cn('font-normal', badgeTipoClass(f.tipo))}>
                    {f.tipo}
                  </Badge>
                </td>
                <td className="py-3 px-5 text-muted-foreground text-xs whitespace-nowrap">
                  {textoAtrasoFaltaCelula(f, totaisAtrasoMes)}
                </td>
                <td className="py-3 px-5 text-muted-foreground max-w-[200px] truncate">
                  {f.motivo?.trim() || '—'}
                </td>
                <td className="py-3 px-5 text-muted-foreground">{f.registadoPor}</td>
                <td className="py-3 px-5 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setViewItem(f);
                      setViewOpen(true);
                    }}
                    aria-label="Ver detalhe"
                  >
                    <Eye className="h-4 w-4" />
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
          rowId={f => f.id}
          sortBar={{
            options: [
              { key: 'data', label: 'Data' },
              { key: 'tipo', label: 'Tipo' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={f => ({
            title: formatDate(f.data),
            trailing: (
              <Badge variant="outline" className={cn('shrink-0 font-normal', badgeTipoClass(f.tipo))}>
                {f.tipo}
              </Badge>
            ),
          })}
          renderDetails={f => [
            { label: 'Motivo', value: f.motivo?.trim() || '—' },
            { label: 'Atraso', value: textoAtrasoFaltaCelula(f, totaisAtrasoMes) },
            { label: 'Registado por', value: f.registadoPor },
          ]}
          renderActions={f => (
            <Button
              type="button"
              className="min-h-11 w-full gap-2"
              onClick={() => {
                setViewItem(f);
                setViewOpen(true);
              }}
            >
              <Eye className="h-4 w-4 shrink-0" />
              Ver detalhe
            </Button>
          )}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma falta registada.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhe da falta</DialogTitle>
            <DialogDescription>Registo de assiduidade (consulta)</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Data:</span> {formatDate(viewItem.data)}
              </p>
              <p className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Tipo:</span>
                <Badge variant="outline" className={cn('font-normal', badgeTipoClass(viewItem.tipo))}>
                  {viewItem.tipo}
                </Badge>
              </p>
              <p>
                <span className="text-muted-foreground">Motivo:</span> {viewItem.motivo?.trim() || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Registado por:</span> {viewItem.registadoPor}
              </p>
              {viewItem.tipo === 'Por atrasos' ? (
                <>
                  <p>
                    <span className="text-muted-foreground">Atraso no mês:</span>{' '}
                    {viewItem.referenciaMesAtrasos ? (
                      viewAtrasoTotalSeg != null
                        ? `${formatarDuracaoHorasMinutos(viewAtrasoTotalSeg)} acumulados (tolerância 15 min na entrada).`
                        : 'Total do mês indisponível.'
                    ) : (
                      '—'
                    )}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Esta falta:</span> ultrapassa mais um limiar de{' '}
                    {formatarDuracaoHorasMinutos(SEGUNDOS_ATRASO_POR_FALTA)} de atraso no mês.
                    {viewAtrasoOrdem != null
                      ? ` (${viewAtrasoOrdem}.ª falta «Por atrasos» nesse mês.)`
                      : null}
                  </p>
                </>
              ) : null}
              {viewItem.referenciaMesAtrasos ? (
                <p>
                  <span className="text-muted-foreground">Mês de referência:</span>{' '}
                  {viewItem.referenciaMesAtrasos}
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
