import { useData } from '@/context/DataContext';
import { Users, FileText, Scale, DollarSign, Stamp } from 'lucide-react';

const AREAS = [
  { key: 'capital-humano', label: 'Capital Humano', icon: Users },
  { key: 'financas', label: 'Finanças', icon: DollarSign },
  { key: 'contabilidade', label: 'Contabilidade', icon: FileText },
  { key: 'secretaria', label: 'Secretaria Geral', icon: Stamp },
  { key: 'juridico', label: 'Jurídico', icon: Scale },
];

export default function ActividadeOrganizacionalPage() {
  const { colaboradores, requisicoes, reunioes, contratos, declaracoes, actas, pagamentos } = useData();

  const reqPendentes = requisicoes.filter(r => r.status === 'Pendente' || r.status === 'Em Análise').length;
  const valorPendente = requisicoes.filter(r => r.status === 'Pendente' || r.status === 'Em Análise').reduce((s, r) => s + r.valor, 0);
  const reunioesAgendadas = reunioes.filter(r => r.status === 'Agendada').length;
  const contratosVigentes = contratos.filter(c => c.status === 'Activo').length;
  const declPendentes = declaracoes.filter(d => d.status === 'Pendente').length;

  const resumos = [
    { area: 'Capital Humano', metricas: [{ label: 'Colaboradores activos', value: colaboradores.filter(c => c.status === 'Activo').length }, { label: 'Declarações pendentes', value: declPendentes }] },
    { area: 'Finanças', metricas: [{ label: 'Requisições pendentes', value: reqPendentes }, { label: 'Valor pendente', value: valorPendente }] },
    { area: 'Contabilidade', metricas: [{ label: 'Pagamentos (total)', value: pagamentos.length }] },
    { area: 'Secretaria Geral', metricas: [{ label: 'Reuniões agendadas', value: reunioesAgendadas }, { label: 'Actas', value: actas.length }] },
    { area: 'Jurídico', metricas: [{ label: 'Contratos vigentes', value: contratosVigentes }] },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-header">Actividade Organizacional</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Supervisão da actividade por área. Visão consolidada; execução nas respectivas direcções.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AREAS.map((area, i) => {
          const resumo = resumos[i];
          const Icon = area.icon;
          return (
            <div key={area.key} className="bg-card rounded-xl border border-border/80 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{area.label}</h3>
              </div>
              <ul className="space-y-2 text-sm">
                {resumo.metricas.map((m, j) => (
                  <li key={j} className="flex justify-between">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-medium">{typeof m.value === 'number' && m.value > 1000000 ? `${(m.value / 1000000).toFixed(1)}M Kz` : String(m.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border border-border/80 p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Resumo por Departamento (colaboradores)</h3>
        <div className="flex flex-wrap gap-4">
          {Array.from(new Set(colaboradores.map(c => c.departamento))).sort().map(dep => (
            <div key={dep} className="rounded-lg border border-border/80 px-4 py-2">
              <span className="text-muted-foreground text-sm">{dep}</span>
              <span className="ml-2 font-semibold">{colaboradores.filter(c => c.departamento === dep).length}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
