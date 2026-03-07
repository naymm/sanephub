import { useState } from 'react';
import { formatDate } from '@/utils/formatters';
import { PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const ACTOS_MOCK = [
  { id: 1, designacao: 'Minuta de Contrato - Empresa X', dataSubmissao: '2024-12-01', tipo: 'Contrato', prioridade: 'Alta' },
  { id: 2, designacao: 'Acta da Reuniao do CA de 28/11/2024', dataSubmissao: '2024-11-29', tipo: 'Acta', prioridade: 'Media' },
  { id: 3, designacao: 'Despacho de Aprovacao de Orcamento Suplementar', dataSubmissao: '2024-11-25', tipo: 'Despacho', prioridade: 'Alta' },
  { id: 4, designacao: 'Declaracao de Voto - Assembleia Geral', dataSubmissao: '2024-11-20', tipo: 'Declaracao', prioridade: 'Baixa' },
];

export default function AssinaturaActosPage() {
  const [actos, setActos] = useState(ACTOS_MOCK);
  const [search, setSearch] = useState('');

  const filtered = actos.filter(
    a =>
      a.designacao.toLowerCase().includes(search.toLowerCase()) ||
      a.tipo.toLowerCase().includes(search.toLowerCase())
  );

  const assinar = (id: number) => {
    setActos(prev => prev.filter(a => a.id !== id));
    toast.success('Acto assinado digitalmente e registado.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Assinatura Digital de Actos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Actos administrativos submetidos para assinatura do PCA.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Input placeholder="Pesquisar acto..." value={search} onChange={e => setSearch(e.target.value)} className="h-9" />
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data submissao</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Designacao</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Prioridade</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Accao</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 text-muted-foreground">{formatDate(a.dataSubmissao)}</td>
                <td className="py-3 px-5 font-medium">{a.designacao}</td>
                <td className="py-3 px-5 text-muted-foreground">{a.tipo}</td>
                <td className="py-3 px-5">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    a.prioridade === 'Alta' ? 'bg-destructive/10 text-destructive' :
                    a.prioridade === 'Media' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                  }`}>
                    {a.prioridade}
                  </span>
                </td>
                <td className="py-3 px-5 text-right">
                  <Button size="sm" onClick={() => assinar(a.id)} className="gap-1">
                    <PenLine className="h-3.5 w-3.5" />
                    Assinar digitalmente
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum acto pendente de assinatura.</p>
      )}
    </div>
  );
}
