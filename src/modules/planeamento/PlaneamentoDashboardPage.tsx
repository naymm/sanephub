import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { formatKz } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Building2, AlertTriangle } from 'lucide-react';

function mesAnoLabel(mesAno: string): string {
  const [y, m] = mesAno.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export default function PlaneamentoDashboardPage() {
  const { relatoriosPlaneamento, empresas } = useData();
  const { currentEmpresaId } = useTenant();

  const isConsolidado = currentEmpresaId === 'consolidado';
  const empresaNome = (id: number) => empresas.find(e => e.id === id)?.nome ?? String(id);

  const submetidos = relatoriosPlaneamento.filter(r => r.status !== 'Rascunho');
  const ultimoMes = Array.from(new Set(submetidos.map(r => r.mesAno))).sort().reverse()[0];
  const relatoriosUltimoMes = submetidos.filter(r => r.mesAno === ultimoMes);

  const comMargemNegativa = relatoriosUltimoMes.filter(r => (r.margemEbitda ?? 0) < 0);
  const porEbitda = [...relatoriosUltimoMes].sort((a, b) => (b.ebitda ?? 0) - (a.ebitda ?? 0));
  const totalReceitas = relatoriosUltimoMes.reduce((s, r) => {
    return s + r.vendasProdutos.reduce((a, l) => a + l.quantidade * l.precoUnitario, 0) + r.vendasServicos.reduce((a, l) => a + l.quantidade * l.precoUnitario, 0);
  }, 0);
  const totalCustos = relatoriosUltimoMes.reduce((s, r) => {
    const cmv = r.custoMercadoriasVendidas.reduce((a, l) => a + l.quantidade * l.precoUnitario, 0);
    const gastos = r.gastosPessoal.reduce((a, l) => a + l.total, 0);
    const serv = r.fornecimentoServicosExternos.reduce((a, l) => a + l.quantidade * l.precoUnitario, 0);
    return s + cmv + gastos + serv;
  }, 0);

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
      <div>
        <h1 className="page-header">Dashboard Planeamento</h1>
        <p className="text-sm text-muted-foreground mt-1">Indicadores de desempenho financeiro, crescimento e evolução das unidades de negócio.</p>
      </div>

      {ultimoMes && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receitas (último mês)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(totalReceitas)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(ultimoMes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custos (último mês)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatKz(totalCustos)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesAnoLabel(ultimoMes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Relatórios submetidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{relatoriosUltimoMes.length}</p>
                <p className="text-xs text-muted-foreground mt-1">de {empresas.filter(e => e.activo).length} empresas activas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Margens negativas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{comMargemNegativa.length}</p>
                <p className="text-xs text-muted-foreground mt-1">empresas a acompanhar</p>
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
                Maior EBITDA — {mesAnoLabel(ultimoMes)}
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

      {!ultimoMes && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum relatório submetido. As unidades de negócio podem submeter relatórios mensais em Planeamento → Relatórios Mensais.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
