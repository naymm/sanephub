import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import type { RelatorioMensalPlaneamento, StatusRelatorioPlaneamento } from '@/types';
import { formatKz } from '@/utils/formatters';
import { gerarPdfRelatorioMensal } from '@/utils/planeamentoPdf';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Eye, Pencil, Send, FileText } from 'lucide-react';

const STATUS_LABEL: Record<StatusRelatorioPlaneamento, string> = {
  Rascunho: 'Rascunho',
  Submetido: 'Submetido',
  'Em análise': 'Em análise',
  Consolidado: 'Consolidado',
};

function mesAnoLabel(mesAno: string): string {
  const [y, m] = mesAno.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export default function PlaneamentoRelatoriosPage() {
  const { user } = useAuth();
  const { relatoriosPlaneamento, setRelatoriosPlaneamento, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const navigate = useNavigate();
  const [mesAnoFilter, setMesAnoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusRelatorioPlaneamento | 'todos'>('todos');

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;
  const isGroupLevel = user?.empresaId == null && (user?.perfil === 'Admin' || user?.perfil === 'PCA' || user?.perfil === 'Planeamento');
  const isDirectorDaEmpresa = user?.perfil === 'Director' && user?.empresaId != null && currentEmpresaId !== 'consolidado' && user.empresaId === currentEmpresaId;
  const canEdit = isGroupLevel || isDirectorDaEmpresa;

  const filtered = relatoriosPlaneamento.filter(r => {
    const matchMes = !mesAnoFilter || r.mesAno === mesAnoFilter;
    const matchStatus = statusFilter === 'todos' || r.status === statusFilter;
    return matchMes && matchStatus;
  });

  const mesesDisponiveis = Array.from(new Set(relatoriosPlaneamento.map(r => r.mesAno))).sort().reverse();
  const empresaNome = (id: number) => empresas.find(e => e.id === id)?.nome ?? String(id);

  const submeter = async (r: RelatorioMensalPlaneamento) => {
    if (r.status !== 'Rascunho') return;
    try {
      await updateRelatorioPlaneamento(r.id, {
        status: 'Submetido',
        submetidoEm: new Date().toISOString().slice(0, 19).replace('T', ' '),
        submetidoPor: user?.nome,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao submeter');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Relatórios Mensais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submissão e consulta dos relatórios mensais de planeamento por unidade de negócio.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate(`/planeamento/relatorios/novo?empresaId=${empresaIdForNew}&mesAno=${new Date().toISOString().slice(0, 7)}`)}>
            <Plus className="h-4 w-4 mr-2" /> Novo relatório
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={mesAnoFilter || 'todos'} onValueChange={v => setMesAnoFilter(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Mês/Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {mesesDisponiveis.map(m => (
              <SelectItem key={m} value={m}>{mesAnoLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusRelatorioPlaneamento | 'todos')}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {(Object.keys(STATUS_LABEL) as StatusRelatorioPlaneamento[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Empresa</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Mês/Ano</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase">EBITDA</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                <td className="py-3 px-5 font-medium">{empresaNome(r.empresaId)}</td>
                <td className="py-3 px-5 text-muted-foreground">{mesAnoLabel(r.mesAno)}</td>
                <td className="py-3 px-5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === 'Rascunho' ? 'bg-muted text-muted-foreground' :
                    r.status === 'Submetido' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                    r.status === 'Em análise' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                    'bg-green-500/10 text-green-700 dark:text-green-400'
                  }`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="py-3 px-5 text-right font-mono">{r.ebitda != null ? formatKz(r.ebitda) : '—'}</td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/planeamento/relatorios/${r.id}`)} title="Ver">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => gerarPdfRelatorioMensal(r, empresaNome(r.empresaId))}
                      title="Exportar PDF"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    {r.status === 'Rascunho' && canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/planeamento/relatorios/${r.id}/editar`)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => submeter(r)} title="Submeter">
                          <Send className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 rounded-lg border border-dashed border-border/80">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum relatório encontrado.</p>
          {canEdit && (
            <Button variant="outline" className="mt-3" onClick={() => navigate(`/planeamento/relatorios/novo?empresaId=${empresaIdForNew}&mesAno=${new Date().toISOString().slice(0, 7)}`)}>
              Criar primeiro relatório
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
