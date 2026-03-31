import { useState } from 'react';
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
import { TrendingUp, Building2, AlertTriangle } from 'lucide-react';
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

const MES_AUTO = '__auto__';

export default function PlaneamentoDashboardPage() {
  const { relatoriosPlaneamento, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [mesFiltro, setMesFiltro] = useState<string>(MES_AUTO);

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
        <div className="space-y-1.5 shrink-0">
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
      </div>

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
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custos totais</CardTitle>
                <CardDescription className="text-xs leading-snug">
                  CMV + gasto com pessoal (inclui INSS e IRT) + serviços externos — base do resultado líquido.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(kpis.custos)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(mesReferenciaKpi)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">EBITDA</CardTitle>
                <CardDescription className="text-xs leading-snug">
                  Volume de negócio − CMV − gasto com pessoal (sem INSS e IRT) − fornecimento de serviços externos. Fora da
                  base: impostos sobre o lucro (ex.: IRC), juros e depreciação.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(kpis.ebitda)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(mesReferenciaKpi)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resultado líquido</CardTitle>
                <CardDescription className="text-xs leading-snug">
                  Volume de negócio menos custos totais; no pessoal inclui INSS e IRT (no EBITDA esses valores não entram).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(kpis.resultadoLiquido)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(mesReferenciaKpi)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Margem líquida</CardTitle>
                <CardDescription className="text-xs leading-snug">
                  Resultado líquido sobre o volume de negócio (receita).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{(kpis.margemLiquida * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Receita consolidada</p>
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
