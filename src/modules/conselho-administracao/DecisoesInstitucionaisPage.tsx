import { useState } from 'react';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const DECISOES_MOCK = [
  { id: 1, titulo: 'Plano Estrategico 2024-2026', data: '2024-01-15', tipo: 'Planeamento', estado: 'Aprovada' },
  { id: 2, titulo: 'Regulamento Interno', data: '2024-03-22', tipo: 'Normativo', estado: 'Aprovada' },
  { id: 3, titulo: 'Investimento em TI', data: '2024-06-10', tipo: 'Investimento', estado: 'Aprovada' },
  { id: 4, titulo: 'Mandato Director Geral', data: '2024-09-05', tipo: 'RH', estado: 'Em analise' },
  { id: 5, titulo: 'Politica Sustentabilidade', data: '2024-11-18', tipo: 'Politica', estado: 'Pendente' },
];

export default function DecisoesInstitucionaisPage() {
  const [search, setSearch] = useState('');
  const filtered = DECISOES_MOCK.filter(
    (d) =>
      d.titulo.toLowerCase().includes(search.toLowerCase()) ||
      d.tipo.toLowerCase().includes(search.toLowerCase()) ||
      d.estado.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Decisoes Institucionais</h1>
        <p className="text-sm text-muted-foreground mt-1">Acesso às decisões do CA. Apenas consulta.</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9" />
      </div>
      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Titulo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 text-muted-foreground">{formatDate(d.data)}</td>
                <td className="py-3 px-5 font-medium">{d.titulo}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.tipo}</td>
                <td className="py-3 px-5">
                  <span
                    className={
                      d.estado === 'Aprovada'
                        ? 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-400'
                        : d.estado === 'Em analise'
                          ? 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground'
                    }
                  >
                    {d.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma decisao encontrada.</p>}
    </div>
  );
}
