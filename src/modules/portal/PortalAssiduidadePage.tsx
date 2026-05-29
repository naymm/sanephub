import { useMemo, useState } from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';
import type { AtrasoAssiduidade } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type EstadoFiltro = 'todos' | 'justificado' | 'pendente';

export default function PortalAssiduidadePage() {
  const colaboradorId = useColaboradorId();
  const { assiduidadeAtrasos } = useData();

  const [estadoFilter, setEstadoFilter] = useState<EstadoFiltro>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<AtrasoAssiduidade | null>(null);

  const meusAtrasos = useMemo(() => {
    if (colaboradorId == null) return [];
    return [...assiduidadeAtrasos]
      .filter(a => a.colaboradorId === colaboradorId)
      .sort((a, b) => String(b.dataRef).localeCompare(String(a.dataRef)));
  }, [assiduidadeAtrasos, colaboradorId]);

  const mesActual = new Date().toISOString().slice(0, 7);

  const resumo = useMemo(() => {
    const noMes = meusAtrasos.filter(a => String(a.dataRef).slice(0, 7) === mesActual);
    const justificados = meusAtrasos.filter(a => a.justificado);
    return {
      total: meusAtrasos.length,
      noMes: noMes.length,
      justificados: justificados.length,
      pendentes: meusAtrasos.length - justificados.length,
      minutosMes: noMes.reduce((s, a) => s + (a.minutosAtraso ?? 0), 0),
    };
  }, [meusAtrasos, mesActual]);

  const filtered = useMemo(() => {
    return meusAtrasos.filter(a => {
      const dia = String(a.dataRef).slice(0, 10);
      const matchEstado =
        estadoFilter === 'todos' ||
        (estadoFilter === 'justificado' && a.justificado) ||
        (estadoFilter === 'pendente' && !a.justificado);
      let matchDate = true;
      if (dataInicio) matchDate = matchDate && dia >= dataInicio;
      if (dataFim) matchDate = matchDate && dia <= dataFim;
      return matchEstado && matchDate;
    });
  }, [meusAtrasos, estadoFilter, dataInicio, dataFim]);

  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('data');
  const mobileComparators = useMemo(
    () => ({
      data: (a: AtrasoAssiduidade, b: AtrasoAssiduidade) =>
        String(b.dataRef).localeCompare(String(a.dataRef)),
      minutos: (a: AtrasoAssiduidade, b: AtrasoAssiduidade) => b.minutosAtraso - a.minutosAtraso,
    }),
    [],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Assiduidade</h1>
        <p className="text-muted-foreground text-center py-12">
          Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Assiduidade (atrasos)</h1>
        <p className="text-sm text-muted-foreground max-w-3xl mt-2">
          Consulta dos atrasos registados pelos Recursos Humanos ou pelo sistema (marcações de ponto).
          Não é possível registar ou justificar atrasos neste portal — contacte os RH se necessário.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de registos</CardDescription>
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
            <CardDescription>Justificados</CardDescription>
            <CardTitle className="text-2xl">{resumo.justificados}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Minutos (mês actual)</CardDescription>
            <CardTitle className="text-2xl">{resumo.minutosMes}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={estadoFilter} onValueChange={v => setEstadoFilter(v as EstadoFiltro)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="justificado">Justificados</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
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
        {(dataInicio || dataFim || estadoFilter !== 'todos') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDataInicio('');
              setDataFim('');
              setEstadoFilter('todos');
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
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Minutos
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Estado
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
            {pagination.slice.map(a => (
              <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{formatDate(a.dataRef)}</td>
                <td className="py-3 px-5 text-right tabular-nums">{a.minutosAtraso}</td>
                <td className="py-3 px-5">
                  {a.justificado ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-normal"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Justificado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      Pendente
                    </Badge>
                  )}
                </td>
                <td className="py-3 px-5 text-muted-foreground">{a.registadoPor}</td>
                <td className="py-3 px-5 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setViewItem(a);
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
          rowId={a => a.id}
          sortBar={{
            options: [
              { key: 'data', label: 'Data' },
              { key: 'minutos', label: 'Minutos' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={a => ({
            title: formatDate(a.dataRef),
            trailing: (
              <span className={cn('text-xs tabular-nums', a.justificado && 'text-emerald-600 dark:text-emerald-400')}>
                {a.minutosAtraso} min
              </span>
            ),
          })}
          renderDetails={a => [
            {
              label: 'Estado',
              value: a.justificado ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" /> Justificado
                </span>
              ) : (
                'Pendente'
              ),
            },
            { label: 'Registado por', value: a.registadoPor },
          ]}
          renderActions={a => (
            <Button
              type="button"
              className="min-h-11 w-full gap-2"
              onClick={() => {
                setViewItem(a);
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
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum atraso registado.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhe do atraso</DialogTitle>
            <DialogDescription>Registo de assiduidade (consulta)</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Data:</span> {formatDate(viewItem.dataRef)}
              </p>
              <p>
                <span className="text-muted-foreground">Minutos de atraso:</span>{' '}
                <span className="tabular-nums font-medium">{viewItem.minutosAtraso}</span>
              </p>
              <p className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Estado:</span>
                {viewItem.justificado ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-500/40 bg-emerald-500/10 font-normal"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Justificado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal">
                    Pendente
                  </Badge>
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Registado por:</span> {viewItem.registadoPor}
              </p>
              {viewItem.justificado ? (
                <>
                  <p>
                    <span className="text-muted-foreground">Justificação:</span>{' '}
                    {viewItem.justificacao?.trim() || '—'}
                  </p>
                  {viewItem.justificadoEm ? (
                    <p>
                      <span className="text-muted-foreground">Justificado em:</span>{' '}
                      {formatDate(viewItem.justificadoEm.slice(0, 10))}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
