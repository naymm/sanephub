import { useState, useEffect } from 'react';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { formatKz } from '@/utils/formatters';
import {
  calcularEbitda,
  totalCMV,
  totalGastosPessoal,
  totalServicosExternos,
  totalVendas,
} from '@/utils/planeamentoCalculos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TrendingUp, Building2, AlertTriangle, Scale } from 'lucide-react';
import type { RelatorioMensalPlaneamento } from '@/types';

function mesAnoLabel(mesAno: string): string {
  const [y, m] = mesAno.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

/** Mês civil referência em Africa/Luanda (YYYY-MM). */
function mesAnoEmLuanda(ref: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(ref);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  return `${year}-${month}`;
}

function mesAnoAnterior(mesAno: string): string {
  const [y, m] = mesAno.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Custos totais da demonstração para resultado líquido (pessoal com INSS e IRT). */
function custosResultadoLiquidoPorRelatorio(r: RelatorioMensalPlaneamento): number {
  return totalCMV(r) + totalGastosPessoal(r.gastosPessoal) + totalServicosExternos(r);
}

function totaisGrupo(relatorios: RelatorioMensalPlaneamento[]) {
  let receita = 0;
  let custos = 0;
  let ebitda = 0;
  for (const r of relatorios) {
    receita += totalVendas(r);
    custos += custosResultadoLiquidoPorRelatorio(r);
    ebitda += calcularEbitda(r);
  }
  const resultadoLiquido = receita - custos;
  const margemLiquida = receita > 0 ? resultadoLiquido / receita : 0;
  return { receita, custos, ebitda, resultadoLiquido, margemLiquida };
}

function formatDeltaPct(atual: number, base: number, invertGood: boolean): { text: string; className: string } | null {
  if (base === 0) return atual === 0 ? { text: '0%', className: 'text-muted-foreground' } : null;
  const pct = ((atual - base) / Math.abs(base)) * 100;
  const rounded = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  const improved = invertGood ? pct < 0 : pct > 0;
  const worse = invertGood ? pct > 0 : pct < 0;
  const className = improved
    ? 'text-green-700 dark:text-green-400'
    : worse
      ? 'text-red-700 dark:text-red-400'
      : 'text-muted-foreground';
  return { text: rounded, className };
}

function DeltaLinhaMoeda({
  mesCompLabel,
  valorComp,
  valorRef,
  invertGood,
}: {
  mesCompLabel: string;
  valorComp: number;
  valorRef: number;
  invertGood: boolean;
}) {
  const delta = valorRef - valorComp;
  const pctFmt = formatDeltaPct(valorRef, valorComp, invertGood);
  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground shrink-0">{mesCompLabel}</span>
        <span className="font-mono text-right">{formatKz(valorComp)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted-foreground">Variação</span>
        <span className="font-mono">{formatKz(delta)}</span>
        {pctFmt && <span className={`font-medium ${pctFmt.className}`}>({pctFmt.text})</span>}
      </div>
    </div>
  );
}

function DeltaLinhaMargem({ mesCompLabel, valorComp, valorRef }: { mesCompLabel: string; valorComp: number; valorRef: number }) {
  const deltaPp = (valorRef - valorComp) * 100;
  const pctFmt = formatDeltaPct(valorRef, valorComp, false);
  const pos = deltaPp > 0;
  const neg = deltaPp < 0;
  const cls = pos ? 'text-green-700 dark:text-green-400' : neg ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground';
  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground shrink-0">{mesCompLabel}</span>
        <span className="font-mono text-right">{(valorComp * 100).toFixed(1)}%</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted-foreground">Variação</span>
        <span className={`font-mono font-medium ${cls}`}>
          {(deltaPp >= 0 ? '+' : '')}
          {deltaPp.toFixed(1)} p.p.
        </span>
        {pctFmt && <span className={`font-medium ${pctFmt.className}`}>({pctFmt.text})</span>}
      </div>
    </div>
  );
}

const MES_AUTO = '__auto__';
const MES_COMP_NENHUM = '__comp_nenhum__';

export default function PlaneamentoDashboardPage() {
  const { relatoriosPlaneamento, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [mesFiltro, setMesFiltro] = useState<string>(MES_AUTO);
  const [mesComparacao, setMesComparacao] = useState<string>(MES_COMP_NENHUM);

  const isConsolidado = currentEmpresaId === 'consolidado';
  const empresaNome = (id: number) => empresas.find(e => e.id === id)?.nome ?? String(id);

  const submetidos = relatoriosPlaneamento.filter(r => r.status !== 'Rascunho');
  const mesActualLuanda = mesAnoEmLuanda();
  const mesesComDados = Array.from(new Set(submetidos.map(r => r.mesAno))).sort().reverse();

  const relatoriosMesActual = submetidos.filter(r => r.mesAno === mesActualLuanda);
  const usarMesAnterior =
    relatoriosMesActual.length === 0 ? mesAnoAnterior(mesActualLuanda) : null;
  const autoRelatoriosRef =
    relatoriosMesActual.length > 0
      ? relatoriosMesActual
      : usarMesAnterior != null
        ? submetidos.filter(r => r.mesAno === usarMesAnterior)
        : [];
  const autoMesReferencia =
    autoRelatoriosRef.length === 0
      ? null
      : relatoriosMesActual.length > 0
        ? mesActualLuanda
        : usarMesAnterior!;

  const escolhaManual = mesFiltro !== MES_AUTO;
  const relatoriosRef = escolhaManual
    ? submetidos.filter(r => r.mesAno === mesFiltro)
    : autoRelatoriosRef;
  const mesReferenciaKpi = escolhaManual
    ? relatoriosRef.length > 0
      ? mesFiltro
      : null
    : autoMesReferencia;
  const dadosMesAnterior =
    !escolhaManual && mesReferenciaKpi != null && mesReferenciaKpi !== mesActualLuanda;

  const kpis = mesReferenciaKpi ? totaisGrupo(relatoriosRef) : null;

  useEffect(() => {
    if (mesReferenciaKpi != null && mesComparacao !== MES_COMP_NENHUM && mesComparacao === mesReferenciaKpi) {
      setMesComparacao(MES_COMP_NENHUM);
    }
  }, [mesReferenciaKpi, mesComparacao]);

  const mesCompEfectivo =
    mesReferenciaKpi != null &&
    mesComparacao !== MES_COMP_NENHUM &&
    mesComparacao !== mesReferenciaKpi
      ? mesComparacao
      : null;
  const relatoriosComp = mesCompEfectivo ? submetidos.filter(r => r.mesAno === mesCompEfectivo) : [];
  const kpisComp = mesCompEfectivo && relatoriosComp.length > 0 ? totaisGrupo(relatoriosComp) : null;
  const semDadosMesComp = Boolean(mesCompEfectivo && relatoriosComp.length === 0);

  const comMargemNegativa = relatoriosRef.filter(r => (r.margemEbitda ?? 0) < 0);
  const porEbitda = [...relatoriosRef].sort((a, b) => (b.ebitda ?? 0) - (a.ebitda ?? 0));

  if (!isConsolidado) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Dashboard Planeamento</h1>
        <p className="text-muted-foreground text-sm">Seleccione a visão consolidada (Grupo) para ver o dashboard de planeamento estratégico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Dashboard Planeamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Indicadores de desempenho financeiro, crescimento e evolução das unidades de negócio.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end shrink-0">
          <div className="space-y-1.5">
            <Label htmlFor="dash-mes-planeamento" className="text-xs text-muted-foreground">
              Mês de referência
            </Label>
            <Select value={mesFiltro} onValueChange={setMesFiltro}>
              <SelectTrigger id="dash-mes-planeamento" className="w-[min(100%,280px)] h-9">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MES_AUTO}>Automático (mês em Luanda → anterior se vazio)</SelectItem>
                {mesesComDados.map(m => (
                  <SelectItem key={m} value={m}>
                    {mesAnoLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mesReferenciaKpi && (
            <div className="space-y-1.5">
              <Label htmlFor="dash-mes-comp-planeamento" className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Scale className="h-3 w-3 opacity-70" />
                Comparar com
              </Label>
              <Select value={mesComparacao} onValueChange={setMesComparacao}>
                <SelectTrigger id="dash-mes-comp-planeamento" className="w-[min(100%,280px)] h-9">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MES_COMP_NENHUM}>Não comparar</SelectItem>
                  {mesesComDados
                    .filter(m => m !== mesReferenciaKpi)
                    .map(m => (
                      <SelectItem key={m} value={m}>
                        {mesAnoLabel(m)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {semDadosMesComp && mesCompEfectivo && (
        <p className="text-sm rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-amber-900 dark:text-amber-100/90">
          Não há relatórios submetidos em <span className="font-medium">{mesAnoLabel(mesCompEfectivo)}</span> para
          consolidar a comparação. Escolha outro mês ou aguarde submissões.
        </p>
      )}

      {mesReferenciaKpi && kpis && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Volume de negócio (Receita)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(kpis.receita)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mesAnoLabel(mesReferenciaKpi)}
                  {dadosMesAnterior && (
                    <span className="block text-amber-700/90 dark:text-amber-400/90">
                      Sem dados em {mesAnoLabel(mesActualLuanda)} — mês anterior
                    </span>
                  )}
                </p>
                {kpisComp && mesCompEfectivo && (
                  <DeltaLinhaMoeda
                    mesCompLabel={mesAnoLabel(mesCompEfectivo)}
                    valorComp={kpisComp.receita}
                    valorRef={kpis.receita}
                    invertGood={false}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custos totais</CardTitle>
                <CardDescription className="text-xs leading-snug">
                 
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(kpis.custos)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(mesReferenciaKpi)}</p>
                {kpisComp && mesCompEfectivo && (
                  <DeltaLinhaMoeda
                    mesCompLabel={mesAnoLabel(mesCompEfectivo)}
                    valorComp={kpisComp.custos}
                    valorRef={kpis.custos}
                    invertGood
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">EBITDA</CardTitle>
                <CardDescription className="text-xs leading-snug">
                  
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(kpis.ebitda)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(mesReferenciaKpi)}</p>
                {kpisComp && mesCompEfectivo && (
                  <DeltaLinhaMoeda
                    mesCompLabel={mesAnoLabel(mesCompEfectivo)}
                    valorComp={kpisComp.ebitda}
                    valorRef={kpis.ebitda}
                    invertGood={false}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resultado líquido</CardTitle>
                <CardDescription className="text-xs leading-snug">
                 
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(kpis.resultadoLiquido)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(mesReferenciaKpi)}</p>
                {kpisComp && mesCompEfectivo && (
                  <DeltaLinhaMoeda
                    mesCompLabel={mesAnoLabel(mesCompEfectivo)}
                    valorComp={kpisComp.resultadoLiquido}
                    valorRef={kpis.resultadoLiquido}
                    invertGood={false}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Margem líquida</CardTitle>
                <CardDescription className="text-xs leading-snug">
                  
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{(kpis.margemLiquida * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(mesReferenciaKpi)}</p>
                {kpisComp && mesCompEfectivo && (
                  <DeltaLinhaMargem
                    mesCompLabel={mesAnoLabel(mesCompEfectivo)}
                    valorComp={kpisComp.margemLiquida}
                    valorRef={kpis.margemLiquida}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {comMargemNegativa.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Empresas com margem EBITDA negativa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {comMargemNegativa.map(r => (
                    <li key={r.id} className="flex justify-between text-sm">
                      <span>{empresaNome(r.empresaId)}</span>
                      <span className="font-mono text-amber-700 dark:text-amber-400">{(r.margemEbitda ?? 0) * 100}%</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Maior EBITDA — {mesAnoLabel(mesReferenciaKpi)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {porEbitda.length > 0 ? (
                <ol className="space-y-2">
                  {porEbitda.slice(0, 5).map((r, i) => (
                    <li key={r.id} className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground w-6">{i + 1}.</span>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {empresaNome(r.empresaId)}
                      </span>
                      <span className="font-mono font-medium">{formatKz(r.ebitda ?? 0)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum relatório no período.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!mesReferenciaKpi && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {escolhaManual ? (
              <>
                Nenhum relatório submetido para{' '}
                <span className="font-medium text-foreground">{mesAnoLabel(mesFiltro)}</span>.
              </>
            ) : (
              <>
                Nenhum relatório submetido. As unidades de negócio podem submeter relatórios mensais em Planeamento →
                Relatórios Mensais.
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
