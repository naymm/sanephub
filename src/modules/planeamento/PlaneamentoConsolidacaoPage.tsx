import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { useTenant } from '@/context/TenantContext';
import { formatKz } from '@/utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function mesAnoLabel(mesAno: string): string {
  const [y, m] = mesAno.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export default function PlaneamentoConsolidacaoPage() {
  const { relatoriosPlaneamento, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [mesAnoFilter, setMesAnoFilter] = useState('');

  const isConsolidado = currentEmpresaId === 'consolidado';
  const mesesDisponiveis = Array.from(new Set(relatoriosPlaneamento.map(r => r.mesAno))).sort().reverse();
  const mesSelecionado = mesAnoFilter || mesesDisponiveis[0];
  const relatoriosMes = relatoriosPlaneamento.filter(r => r.mesAno === mesSelecionado);
  const pagination = useClientSidePagination({ items: relatoriosMes, pageSize: 25 });

  const empresaNome = (id: number) => empresas.find(e => e.id === id)?.nome ?? String(id);

  const totalVendasConsolidado = relatoriosMes.reduce((s, r) => {
    const v = r.vendasProdutos.reduce((a, l) => a + l.quantidade * l.precoUnitario, 0) + r.vendasServicos.reduce((a, l) => a + l.quantidade * l.precoUnitario, 0);
    return s + v;
  }, 0);
  const totalEbitdaConsolidado = relatoriosMes.reduce((s, r) => s + (r.ebitda ?? 0), 0);

  if (!isConsolidado) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Consolidação</h1>
        <p className="text-muted-foreground text-sm">Seleccione a visão consolidada (Grupo) no selector de empresa para ver a consolidação de todas as unidades de negócio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Consolidação do Grupo</h1>
        <p className="text-sm text-muted-foreground mt-1">Consolidação automática das informações mensais das empresas para o Conselho de Administração.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Mês/Ano:</span>
        <Select value={mesSelecionado || 'vazio'} onValueChange={v => v !== 'vazio' && setMesAnoFilter(v)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Seleccionar mês" />
          </SelectTrigger>
          <SelectContent>
            {mesesDisponiveis.length === 0 ? <SelectItem value="vazio">Nenhum dado</SelectItem> : null}
            {mesesDisponiveis.map(m => (
              <SelectItem key={m} value={m}>{mesAnoLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {relatoriosMes.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Total vendas (consolidado) — {mesAnoLabel(mesSelecionado)}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{formatKz(totalVendasConsolidado)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">EBITDA consolidado — {mesAnoLabel(mesSelecionado)}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{formatKz(totalEbitdaConsolidado)}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Vendas e margens por empresa</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/80">
                      <th className="text-left py-3 px-5 font-medium">Empresa</th>
                      <th className="text-right py-3 px-5 font-medium">Vendas</th>
                      <th className="text-right py-3 px-5 font-medium">EBITDA</th>
                      <th className="text-right py-3 px-5 font-medium">Margem Bruta</th>
                      <th className="text-right py-3 px-5 font-medium">Margem EBITDA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.slice.map(r => {
                      const vendas = r.vendasProdutos.reduce((a, l) => a + l.quantidade * l.precoUnitario, 0) + r.vendasServicos.reduce((a, l) => a + l.quantidade * l.precoUnitario, 0);
                      return (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-3 px-5 font-medium">{empresaNome(r.empresaId)}</td>
                          <td className="py-3 px-5 text-right font-mono">{formatKz(vendas)}</td>
                          <td className="py-3 px-5 text-right font-mono">{r.ebitda != null ? formatKz(r.ebitda) : '—'}</td>
                          <td className="py-3 px-5 text-right">{(r.margemBruta != null ? r.margemBruta * 100 : 0).toFixed(1)}%</td>
                          <td className="py-3 px-5 text-right">{(r.margemEbitda != null ? r.margemEbitda * 100 : 0).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <DataTablePagination {...pagination.paginationProps} />
            </CardContent>
          </Card>
        </>
      )}

      {mesesDisponiveis.length > 0 && relatoriosMes.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum relatório submetido para este mês.</p>
      )}
      {mesesDisponiveis.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum relatório disponível para consolidação.</p>
      )}
    </div>
  );
}
