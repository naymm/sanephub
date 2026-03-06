import { useData } from '@/context/DataContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, diasRestantes } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export default function PrazosPage() {
  const { prazos } = useData();

  const getRowClass = (p: typeof prazos[0]) => {
    if (p.status === 'Concluído') return '';
    const d = diasRestantes(p.dataLimite);
    if (d < 0) return 'bg-destructive/5';
    if (d <= 7) return 'bg-orange-50';
    if (d <= 15) return 'bg-amber-50/50';
    return '';
  };

  return (
    <div className="space-y-4">
      <h1 className="page-header">Prazos Legais</h1>
      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Título</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Data Limite</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Dias</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Prioridade</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {prazos.map(p => {
              const d = diasRestantes(p.dataLimite);
              return (
                <tr key={p.id} className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors", getRowClass(p))}>
                  <td className="p-3 font-medium">{p.titulo}</td>
                  <td className="p-3 text-muted-foreground">{p.tipo}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(p.dataLimite)}</td>
                  <td className={cn("p-3 font-semibold", d < 0 ? "text-destructive" : d <= 7 ? "text-orange-600" : d <= 30 ? "text-warning" : "text-success")}>
                    {d < 0 ? `Vencido (${Math.abs(d)}d)` : `${d} dias`}
                  </td>
                  <td className="p-3"><StatusBadge status={p.prioridade} /></td>
                  <td className="p-3 text-muted-foreground">{p.responsavel}</td>
                  <td className="p-3"><StatusBadge status={p.status} pulse={p.status === 'Vencido'} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
