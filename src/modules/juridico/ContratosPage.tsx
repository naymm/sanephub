import { useData } from '@/context/DataContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, diasRestantes } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export default function ContratosPage() {
  const { contratos } = useData();

  const getDiasClass = (dataFim: string) => {
    const d = diasRestantes(dataFim);
    if (d < 0) return 'text-muted-foreground';
    if (d < 30) return 'text-destructive font-bold';
    if (d < 90) return 'text-warning font-semibold';
    return 'text-success';
  };

  return (
    <div className="space-y-4">
      <h1 className="page-header">Contratos</h1>
      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Nº Contrato</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Contraparte</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Objecto</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Início</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Fim</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Dias</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map(c => {
              const d = diasRestantes(c.dataFim);
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{c.numero}</td>
                  <td className="p-3">{c.tipo}</td>
                  <td className="p-3 font-medium">{c.parteB}</td>
                  <td className="p-3 text-muted-foreground max-w-48 truncate">{c.objecto}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.dataInicio)}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.dataFim)}</td>
                  <td className={cn("p-3", getDiasClass(c.dataFim))}>
                    {d < 0 ? 'Vencido' : `${d} dias`}
                  </td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
