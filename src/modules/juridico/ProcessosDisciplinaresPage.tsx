import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { ProcessoDisciplinar, MedidaDisciplinarProposta, StatusProcessoDisciplinar } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, ArrowLeft, ChevronRight, ChevronLeft, Scale, FileText } from 'lucide-react';

const STATUS_OPCOES: StatusProcessoDisciplinar[] = [
  'Em análise jurídica', 'Suspensão preventiva', 'Em audiência', 'Relatório elaborado',
  'Em decisão PCA', 'Comunicado emitido', 'Concluído',
];
const GRAVIDADE_OPCOES: NonNullable<ProcessoDisciplinar['avaliacaoGravidade']>[] = ['Leve', 'Média', 'Grave', 'Muito Grave'];
const MEDIDA_TIPOS: MedidaDisciplinarProposta['tipo'][] = ['Advertência', 'Suspensão', 'Demissão', 'Outra'];
const DECISAO_OPCOES: NonNullable<ProcessoDisciplinar['decisaoPca']>[] = ['Aprova medida', 'Altera medida', 'Rejeita', 'Outra'];

const WIZARD_STEPS = [
  { id: '1', title: 'Auto de ocorrência' },
  { id: '2', title: 'Despacho delegação' },
  { id: '3', title: 'Avaliação jurídica' },
  { id: '4', title: 'Suspensão preventiva' },
  { id: '5', title: 'Convocatória audiência' },
  { id: '6', title: 'Audiência disciplinar' },
  { id: '7', title: 'Relatório final' },
  { id: '8', title: 'Medidas propostas' },
  { id: '9', title: 'Decisão PCA' },
  { id: '10', title: 'Comunicado e encerramento' },
];

export default function ProcessosDisciplinaresPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { processosDisciplinares, addProcessoDisciplinar, colaboradores, empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [form, setForm] = useState<Partial<ProcessoDisciplinar> & { medidasPropostas?: MedidaDisciplinarProposta[] }>({
    medidasPropostas: [],
  });

  const processoId = id != null ? parseInt(id, 10) : null;
  const processo = processoId != null ? processosDisciplinares.find(p => p.id === processoId) : null;

  const getEmpresaNome = (empresaId: number) =>
    empresas.find(e => e.id === empresaId)?.nome ?? `Empresa ${empresaId}`;
  const canSeeDetalhes = user?.perfil === 'Admin' || user?.perfil === 'Juridico' || user?.perfil === 'PCA' || user?.perfil === 'Director';
  const canEdit = user?.perfil === 'Admin' || user?.perfil === 'Juridico';

  const colaboradoresFiltrados = currentEmpresaId === 'consolidado'
    ? colaboradores
    : colaboradores.filter(c => c.empresaId === currentEmpresaId);

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? 1 : (typeof currentEmpresaId === 'number' ? currentEmpresaId : 1);
  const pagination = useClientSidePagination({ items: processosDisciplinares, pageSize: 25 });

  if (processoId != null && processo) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/juridico/processos-disciplinares')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="page-header">{processo.numero}</h1>
            <p className="text-sm text-muted-foreground">
              {colaboradores.find(c => c.id === processo.colaboradorId)?.nome ?? `Colaborador #${processo.colaboradorId}`} — {getEmpresaNome(processo.empresaId)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border/80 p-4 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados gerais</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Empresa</dt><dd>{getEmpresaNome(processo.empresaId)}</dd>
              <dt className="text-muted-foreground">Colaborador</dt><dd>{colaboradores.find(c => c.id === processo.colaboradorId)?.nome ?? '—'}</dd>
              <dt className="text-muted-foreground">Criado em</dt><dd>{formatDate(processo.criadoEm.slice(0, 10))}</dd>
              <dt className="text-muted-foreground">Criado por</dt><dd>{processo.criadoPor}</dd>
              <dt className="text-muted-foreground">Status</dt><dd><span className="inline-flex items-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs font-medium">{processo.status}</span></dd>
              {processo.encerradoEm && <><dt className="text-muted-foreground">Encerrado em</dt><dd>{formatDate(processo.encerradoEm)}</dd></>}
            </dl>
          </div>

          <div className="rounded-lg border border-border/80 p-4 space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Auto de ocorrência</h2>
            <p className="text-sm">{processo.autoOcorrenciaDescricao}</p>
            {processo.autoOcorrenciaPdf && <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> {processo.autoOcorrenciaPdf}</p>}
          </div>
        </div>

        <div className="rounded-lg border border-border/80 p-4 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Timeline (histórico)</h2>
          <ul className="space-y-2">
            {processo.historico.map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="text-muted-foreground shrink-0">{formatDate(h.data.slice(0, 10))} {h.data.slice(11, 16)}</span>
                <span className="font-medium">{h.passo}</span>
                <span className="text-muted-foreground">— {h.utilizador}</span>
              </li>
            ))}
          </ul>
        </div>

        {processo.medidasPropostas?.length > 0 && (
          <div className="rounded-lg border border-border/80 p-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Medidas propostas</h2>
            <ul className="list-disc list-inside text-sm">
              {processo.medidasPropostas.map((m, i) => (
                <li key={i}>{m.tipo}{m.descricao ? ` — ${m.descricao}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const openWizard = () => {
    const ano = new Date().getFullYear();
    const nextNum = Math.max(0, ...processosDisciplinares.map(p => parseInt(p.numero.replace(/\D/g, ''), 10) || 0)) + 1;
    setForm({
      empresaId: empresaIdForNew,
      colaboradorId: colaboradoresFiltrados[0]?.id ?? 0,
      numero: `PD-${ano}-${String(nextNum).padStart(4, '0')}`,
      criadoEm: new Date().toISOString(),
      criadoPor: user?.nome ?? 'Sistema',
      autoOcorrenciaDescricao: '',
      medidasPropostas: [],
      status: 'Em análise jurídica',
      historico: [],
    });
    setWizardStep(0);
    setWizardOpen(true);
  };

  const addMedida = () => {
    setForm(f => ({
      ...f,
      medidasPropostas: [...(f.medidasPropostas ?? []), { tipo: 'Advertência', descricao: '' }],
    }));
  };

  const updateMedida = (index: number, field: keyof MedidaDisciplinarProposta, value: string) => {
    setForm(f => {
      const list = [...(f.medidasPropostas ?? [])];
      list[index] = { ...list[index], [field]: value };
      return { ...f, medidasPropostas: list };
    });
  };

  const removeMedida = (index: number) => {
    setForm(f => ({
      ...f,
      medidasPropostas: (f.medidasPropostas ?? []).filter((_, i) => i !== index),
    }));
  };

  const normalizePdf = (nome?: string) => {
    const trimmed = nome?.trim();
    if (!trimmed) return undefined;
    return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
  };

  const saveProcesso = async () => {
    if (!form.colaboradorId || !form.autoOcorrenciaDescricao?.trim()) return;
    const historico = [
      { data: new Date().toISOString(), passo: 'Processo disciplinar criado', utilizador: user?.nome ?? 'Sistema' },
      ...(form.autoOcorrenciaDescricao ? [{ data: new Date().toISOString(), passo: 'Auto de ocorrência registado', utilizador: user?.nome ?? 'Sistema' }] : []),
    ].slice(0, 2);
    const payload: Partial<ProcessoDisciplinar> = {
      empresaId: form.empresaId ?? 1,
      colaboradorId: form.colaboradorId ?? 0,
      numero: form.numero ?? `PD-${new Date().getFullYear()}-0001`,
      criadoEm: form.criadoEm ?? new Date().toISOString(),
      criadoPor: form.criadoPor ?? user?.nome ?? 'Sistema',
      autoOcorrenciaPdf: normalizePdf(form.autoOcorrenciaPdf),
      autoOcorrenciaDescricao: form.autoOcorrenciaDescricao ?? '',
      despachoDelegacaoPdf: normalizePdf(form.despachoDelegacaoPdf),
      despachoDelegacaoData: form.despachoDelegacaoData,
      avaliacaoGravidade: form.avaliacaoGravidade,
      parecerJuridico: form.parecerJuridico,
      suspensaoPreventivaPdf: normalizePdf(form.suspensaoPreventivaPdf),
      suspensaoInicio: form.suspensaoInicio,
      suspensaoFim: form.suspensaoFim,
      convocatoriaPdf: normalizePdf(form.convocatoriaPdf),
      convocatoriaData: form.convocatoriaData,
      convocatoriaLocal: form.convocatoriaLocal,
      convocatoriaMotivo: form.convocatoriaMotivo,
      audienciaData: form.audienciaData,
      audienciaActaPdf: normalizePdf(form.audienciaActaPdf),
      relatorioFinalPdf: normalizePdf(form.relatorioFinalPdf),
      relatorioDescricao: form.relatorioDescricao,
      relatorioConclusao: form.relatorioConclusao,
      medidasPropostas: form.medidasPropostas?.length ? form.medidasPropostas : [{ tipo: 'Advertência' }],
      decisaoPca: form.decisaoPca,
      decisaoDescricao: form.decisaoDescricao,
      decisaoPdf: normalizePdf(form.decisaoPdf),
      decisaoData: form.decisaoData,
      comunicadoPdf: normalizePdf(form.comunicadoPdf),
      comunicadoData: form.comunicadoData,
      status: form.status ?? 'Em análise jurídica',
      encerradoEm: form.encerradoEm,
      historico: historico as { data: string; passo: string; utilizador: string }[],
    };
    try {
      const row = await addProcessoDisciplinar(payload);
      setWizardOpen(false);
      navigate(`/juridico/processos-disciplinares/${row.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Processos Disciplinares</h1>
          <p className="text-sm text-muted-foreground">
            Gestão estruturada dos processos disciplinares internos por colaborador e por empresa.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openWizard}>
            <Plus className="h-4 w-4 mr-2" /> Novo processo disciplinar
          </Button>
        )}
      </div>

      <div className="table-container overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Nº Processo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Colaborador</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Início</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Último passo</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Acção</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(p => {
              const colab = colaboradores.find(c => c.id === p.colaboradorId);
              const lastStep = p.historico[p.historico.length - 1];
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{p.numero}</td>
                  <td className="p-3 text-muted-foreground">{getEmpresaNome(p.empresaId)}</td>
                  <td className="p-3 font-medium">{colab ? colab.nome : `Colaborador #${p.colaboradorId}`}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(p.criadoEm.slice(0, 10))}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs font-medium">
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {lastStep ? `${formatDate(lastStep.data.slice(0, 10))} — ${lastStep.passo}` : '—'}
                  </td>
                  <td className="p-3 text-right">
                    {canSeeDetalhes && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/juridico/processos-disciplinares/${p.id}`)}>
                        Ver detalhe
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {processosDisciplinares.length === 0 && (
              <tr>
                <td className="p-4 text-center text-muted-foreground text-sm" colSpan={7}>
                  Nenhum processo disciplinar registado para {currentEmpresaId === 'consolidado' ? 'o Grupo' : 'esta empresa'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DataTablePagination {...pagination.paginationProps} />

      {!canSeeDetalhes && (
        <p className="text-xs text-muted-foreground">
          A visualização detalhada dos processos disciplinares é reservada à Área Jurídica, Direcção e PCA.
        </p>
      )}

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo processo disciplinar — Passo {wizardStep + 1} de {WIZARD_STEPS.length}</DialogTitle>
            <DialogDescription>{WIZARD_STEPS[wizardStep]?.title}</DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {wizardStep === 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select value={String(form.empresaId)} onValueChange={v => setForm(f => ({ ...f, empresaId: Number(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {empresas.filter(e => e.activo).map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Colaborador</Label>
                    <Select value={String(form.colaboradorId)} onValueChange={v => setForm(f => ({ ...f, colaboradorId: Number(v) }))}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {colaboradoresFiltrados.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.nome} — {c.cargo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nº processo</Label>
                  <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="PD-2024-0001" />
                </div>
                <div className="space-y-2">
                  <Label>Auto de ocorrência — Descrição</Label>
                  <Textarea value={form.autoOcorrenciaDescricao} onChange={e => setForm(f => ({ ...f, autoOcorrenciaDescricao: e.target.value }))} rows={4} placeholder="Descreva os factos que motivam o processo..." />
                </div>
                <div className="space-y-2">
                  <Label>Auto de ocorrência — Anexar PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        autoOcorrenciaPdf: e.target.files?.[0]?.name,
                      }))
                    }
                  />
                  {form.autoOcorrenciaPdf && (
                    <p className="text-xs text-muted-foreground">Actual: {form.autoOcorrenciaPdf}</p>
                  )}
                </div>
              </>
            )}

            {wizardStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Despacho delegação — Anexar PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        despachoDelegacaoPdf: e.target.files?.[0]?.name,
                      }))
                    }
                  />
                  {form.despachoDelegacaoPdf && (
                    <p className="text-xs text-muted-foreground">Actual: {form.despachoDelegacaoPdf}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Data do despacho</Label>
                  <Input type="date" value={form.despachoDelegacaoData ?? ''} onChange={e => setForm(f => ({ ...f, despachoDelegacaoData: e.target.value }))} />
                </div>
              </>
            )}

            {wizardStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Avaliação da gravidade</Label>
                  <Select value={form.avaliacaoGravidade ?? ''} onValueChange={v => setForm(f => ({ ...f, avaliacaoGravidade: v as ProcessoDisciplinar['avaliacaoGravidade'] }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {GRAVIDADE_OPCOES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Parecer jurídico</Label>
                  <Textarea value={form.parecerJuridico} onChange={e => setForm(f => ({ ...f, parecerJuridico: e.target.value }))} rows={4} placeholder="Parecer da área jurídica..." />
                </div>
              </>
            )}

            {wizardStep === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Suspensão preventiva — Anexar PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        suspensaoPreventivaPdf: e.target.files?.[0]?.name,
                      }))
                    }
                  />
                  {form.suspensaoPreventivaPdf && (
                    <p className="text-xs text-muted-foreground">Actual: {form.suspensaoPreventivaPdf}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início suspensão</Label>
                    <Input type="date" value={form.suspensaoInicio ?? ''} onChange={e => setForm(f => ({ ...f, suspensaoInicio: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim suspensão</Label>
                    <Input type="date" value={form.suspensaoFim ?? ''} onChange={e => setForm(f => ({ ...f, suspensaoFim: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {wizardStep === 4 && (
              <>
                <div className="space-y-2">
                  <Label>Convocatória — Anexar PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        convocatoriaPdf: e.target.files?.[0]?.name,
                      }))
                    }
                  />
                  {form.convocatoriaPdf && (
                    <p className="text-xs text-muted-foreground">Actual: {form.convocatoriaPdf}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data convocatória</Label>
                    <Input type="date" value={form.convocatoriaData ?? ''} onChange={e => setForm(f => ({ ...f, convocatoriaData: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Local</Label>
                    <Input value={form.convocatoriaLocal} onChange={e => setForm(f => ({ ...f, convocatoriaLocal: e.target.value }))} placeholder="Sala de Reuniões B" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Motivo convocatória</Label>
                  <Textarea value={form.convocatoriaMotivo} onChange={e => setForm(f => ({ ...f, convocatoriaMotivo: e.target.value }))} rows={2} placeholder="Audiência disciplinar para apresentação de defesa." />
                </div>
              </>
            )}

            {wizardStep === 5 && (
              <>
                <div className="space-y-2">
                  <Label>Data da audiência</Label>
                  <Input type="date" value={form.audienciaData ?? ''} onChange={e => setForm(f => ({ ...f, audienciaData: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Acta da audiência — Anexar PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        audienciaActaPdf: e.target.files?.[0]?.name,
                      }))
                    }
                  />
                  {form.audienciaActaPdf && (
                    <p className="text-xs text-muted-foreground">Actual: {form.audienciaActaPdf}</p>
                  )}
                </div>
              </>
            )}

            {wizardStep === 6 && (
              <>
                <div className="space-y-2">
                  <Label>Relatório final — Anexar PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        relatorioFinalPdf: e.target.files?.[0]?.name,
                      }))
                    }
                  />
                  {form.relatorioFinalPdf && (
                    <p className="text-xs text-muted-foreground">Actual: {form.relatorioFinalPdf}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Descrição do relatório</Label>
                  <Textarea value={form.relatorioDescricao} onChange={e => setForm(f => ({ ...f, relatorioDescricao: e.target.value }))} rows={2} placeholder="Análise da conduta e antecedentes..." />
                </div>
                <div className="space-y-2">
                  <Label>Conclusão do relatório</Label>
                  <Textarea value={form.relatorioConclusao} onChange={e => setForm(f => ({ ...f, relatorioConclusao: e.target.value }))} rows={2} placeholder="Recomendação de medida disciplinar..." />
                </div>
              </>
            )}

            {wizardStep === 7 && (
              <>
                <div className="flex items-center justify-between">
                  <Label>Medidas disciplinares propostas</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMedida}>+ Adicionar medida</Button>
                </div>
                {(form.medidasPropostas ?? []).map((m, i) => (
                  <div key={i} className="flex gap-2 items-end rounded border p-2">
                    <Select value={m.tipo} onValueChange={v => updateMedida(i, 'tipo', v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MEDIDA_TIPOS.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input className="flex-1" value={m.descricao ?? ''} onChange={e => updateMedida(i, 'descricao', e.target.value)} placeholder="Descrição (opcional)" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeMedida(i)}>×</Button>
                  </div>
                ))}
              </>
            )}

            {wizardStep === 8 && (
              <>
                <div className="space-y-2">
                  <Label>Decisão do PCA</Label>
                  <Select value={form.decisaoPca ?? ''} onValueChange={v => setForm(f => ({ ...f, decisaoPca: v as ProcessoDisciplinar['decisaoPca'] }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {DECISAO_OPCOES.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição da decisão</Label>
                  <Textarea value={form.decisaoDescricao} onChange={e => setForm(f => ({ ...f, decisaoDescricao: e.target.value }))} rows={2} placeholder="Acompanha parecer jurídico..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Decisão — Anexar PDF</Label>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          decisaoPdf: e.target.files?.[0]?.name,
                        }))
                      }
                    />
                    {form.decisaoPdf && (
                      <p className="text-xs text-muted-foreground">Actual: {form.decisaoPdf}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Data decisão</Label>
                    <Input type="date" value={form.decisaoData ?? ''} onChange={e => setForm(f => ({ ...f, decisaoData: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {wizardStep === 9 && (
              <>
                <div className="space-y-2">
                  <Label>Comunicado ao colaborador — Anexar PDF</Label>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        comunicadoPdf: e.target.files?.[0]?.name,
                      }))
                    }
                  />
                  {form.comunicadoPdf && (
                    <p className="text-xs text-muted-foreground">Actual: {form.comunicadoPdf}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data comunicado</Label>
                    <Input type="date" value={form.comunicadoData ?? ''} onChange={e => setForm(f => ({ ...f, comunicadoData: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status final</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusProcessoDisciplinar }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPCOES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Data encerramento (se Concluído)</Label>
                  <Input type="date" value={form.encerradoEm ?? ''} onChange={e => setForm(f => ({ ...f, encerradoEm: e.target.value || undefined }))} />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {wizardStep > 0 && (
                <Button variant="outline" type="button" onClick={() => setWizardStep(s => s - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
              )}
              {wizardStep < WIZARD_STEPS.length - 1 && (
                <Button type="button" onClick={() => setWizardStep(s => s + 1)}>
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              <Button
                type="button"
                variant="default"
                onClick={saveProcesso}
                disabled={!form.autoOcorrenciaDescricao?.trim() || !form.colaboradorId}
              >
                Guardar processo (pode continuar depois)
              </Button>
            </div>
            <Button variant="ghost" type="button" onClick={() => setWizardOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
