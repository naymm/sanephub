import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Play, CheckCircle2, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  CI_EVIDENCIAS_ACCEPT,
  ciAuditoriaRelatorioFinalUrl,
  uploadCiAuditoriaRelatorioFinal,
  validateCiEvidenciaFile,
} from '@/lib/ciEvidencias';
import { FileDropZone } from '@/components/shared/FileDropZone';
import { CiConcluirAuditoriaDialog } from '@/modules/controlo-interno/CiConcluirAuditoriaDialog';
import { useData } from '@/context/DataContext';
import { useCiEmpresaId } from '@/modules/controlo-interno/useCiEmpresaId';
import { useCiCanManage } from '@/modules/controlo-interno/useCiCanManage';
import { mapCiAuditoria } from '@/modules/controlo-interno/ciMappers';
import {
  CiEmpresaNaturezaFields,
  validateCiEmpresaNaturezaForm,
  type CiEmpresaNaturezaFormValues,
} from '@/modules/controlo-interno/CiEmpresaNaturezaFields';
import { CI_BASE, CI_ESTADOS_AUDITORIA } from '@/modules/controlo-interno/constants';
import type { CiAuditoria, CiAuditoriaEstado, CiNatureza } from '@/types/controloInterno';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/formatters';

function areaLabel(a: CiAuditoria): string {
  if (a.natureza === 'Direccionada') return a.areaDireccionada || '—';
  return a.areaDepartamento || '—';
}

function tituloFromForm(
  empresas: { id: number; nome: string }[],
  core: CiEmpresaNaturezaFormValues,
): string {
  const emp = empresas.find(e => e.id === core.empresaId);
  const area =
    core.natureza === 'Direccionada' ? core.areaDireccionada.trim() : core.areaDepartamento.trim();
  return `Plano — ${emp?.nome ?? 'Empresa'} — ${area || core.natureza}`;
}

const emptyCore = (empresaId = 0): CiEmpresaNaturezaFormValues => ({
  empresaId,
  data: '',
  prazo: '',
  areaDepartamento: '',
  natureza: 'Orgânica',
  areaDireccionada: '',
});

export default function PlanoAuditoriasPage() {
  const tenantEmpresaId = useCiEmpresaId();
  const canManage = useCiCanManage();
  const { empresas } = useData();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CiAuditoria | null>(null);
  const [core, setCore] = useState<CiEmpresaNaturezaFormValues>(emptyCore());
  const [estado, setEstado] = useState<CiAuditoriaEstado>('Planeada');
  const [objectivo, setObjectivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [relatorioFile, setRelatorioFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [concluirAuditoria, setConcluirAuditoria] = useState<CiAuditoria | null>(null);

  const empresasActivas = useMemo(
    () => empresas.filter(e => e.activo !== false).map(e => ({ id: e.id, nome: e.nome, codigo: e.codigo })),
    [empresas],
  );

  const empresaNome = useCallback(
    (id: number) => empresas.find(e => e.id === id)?.nome ?? `#${id}`,
    [empresas],
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ci', 'plano-auditorias', canManage, tenantEmpresaId],
    enabled: isSupabaseConfigured() && (canManage || tenantEmpresaId != null),
    staleTime: 30_000,
    queryFn: async () => {
      if (!supabase) return [];
      let q = supabase.from('ci_auditorias').select('*').order('created_at', { ascending: false });
      if (!canManage && tenantEmpresaId != null) {
        q = q.eq('empresa_id', tenantEmpresaId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(r => mapCiAuditoria(r as Record<string, unknown>));
    },
  });

  const openCreate = () => {
    setEditing(null);
    setCore(emptyCore(tenantEmpresaId ?? empresasActivas[0]?.id ?? 0));
    setEstado('Planeada');
    setObjectivo('');
    setObservacoes('');
    setRelatorioFile(null);
    setOpen(true);
  };

  const openEdit = (a: CiAuditoria) => {
    setEditing(a);
    setCore({
      empresaId: a.empresaId,
      data: a.dataInicio ?? '',
      prazo: a.prazo ?? a.dataFim ?? '',
      areaDepartamento: a.areaDepartamento,
      natureza: a.natureza,
      areaDireccionada: a.areaDireccionada,
    });
    setEstado(a.estado);
    setObjectivo(a.objectivo);
    setObservacoes(a.observacoes);
    setRelatorioFile(null);
    setOpen(true);
  };

  const save = async () => {
    const err = validateCiEmpresaNaturezaForm(core);
    if (err) {
      toast.error(err);
      return;
    }
    if (!supabase) return;

    const precisaRelatorio =
      estado === 'Concluída' &&
      !relatorioFile &&
      !(editing?.relatorioFinalStoragePath);
    if (precisaRelatorio) {
      toast.error('Anexe o Relatório Final para concluir a auditoria.');
      return;
    }

    const areaDept =
      core.natureza === 'Orgânica' ? core.areaDepartamento.trim() : core.areaDireccionada.trim();
    const payload = {
      empresa_id: core.empresaId,
      titulo: tituloFromForm(empresasActivas, core),
      natureza: core.natureza,
      tipo: 'Operacional',
      area_departamento: areaDept,
      area_direccionada: core.natureza === 'Direccionada' ? core.areaDireccionada.trim() : '',
      data_inicio: core.data,
      prazo: core.prazo,
      data_fim: core.prazo,
      estado,
      objectivo,
      escopo: '',
      observacoes,
    };

    setSaving(true);
    try {
      let auditoriaId = editing?.id;

      if (editing) {
        const { error } = await supabase.from('ci_auditorias').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        if (estado === 'Concluída') {
          toast.error('Crie o plano antes de concluir; use «Concluir» após iniciar a execução.');
          return;
        }
        const { data, error } = await supabase
          .from('ci_auditorias')
          .insert({ ...payload, codigo: '' })
          .select('id')
          .single();
        if (error) throw error;
        auditoriaId = data?.id as number;
      }

      if (estado === 'Concluída' && relatorioFile && auditoriaId) {
        const upload = await uploadCiAuditoriaRelatorioFinal(supabase, auditoriaId);
        const meta = await upload(relatorioFile);
        const { error: relErr } = await supabase
          .from('ci_auditorias')
          .update({
            relatorio_final_storage_path: meta.relatorioFinalStoragePath,
            relatorio_final_nome_ficheiro: meta.relatorioFinalNomeFicheiro,
            relatorio_final_mime_type: meta.relatorioFinalMimeType,
            relatorio_final_tamanho_bytes: meta.relatorioFinalTamanhoBytes,
            relatorio_final_uploaded_at: new Date().toISOString(),
          })
          .eq('id', auditoriaId);
        if (relErr) throw relErr;
      }

      toast.success(editing ? 'Plano actualizado.' : 'Plano de auditoria criado.');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['ci'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const startExecucao = useCallback(
    async (id: number) => {
      if (!supabase) return;
      await supabase.from('ci_auditorias').update({ estado: 'Em Execução' }).eq('id', id);
      void qc.invalidateQueries({ queryKey: ['ci'] });
    },
    [qc],
  );

  if (!canManage && tenantEmpresaId == null) {
    return <p className="text-sm text-muted-foreground">Seleccione uma empresa no contexto.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Planeamento institucional de auditorias por empresa, data, prazo, área e tipo (orgânica ou
        direccionada).
      </p>

      <div className="flex justify-between items-center gap-3">
        <p className="text-sm text-muted-foreground">{isLoading ? 'A carregar…' : `${rows.length} plano(s)`}</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo plano
        </Button>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Código</th>
              <th className="text-left py-2 px-3">Empresa</th>
              <th className="text-left py-2 px-3">Tipo</th>
              <th className="text-left py-2 px-3">Área</th>
              <th className="text-left py-2 px-3">Data</th>
              <th className="text-left py-2 px-3">Prazo</th>
              <th className="text-left py-2 px-3">Estado</th>
              <th className="text-left py-2 px-3">Relatório</th>
              <th className="text-right py-2 px-3">Acções</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 px-3 font-mono text-xs">{a.codigo}</td>
                <td className="py-2 px-3 font-medium">{empresaNome(a.empresaId)}</td>
                <td className="py-2 px-3">
                  <Badge variant="outline">{a.natureza}</Badge>
                </td>
                <td className="py-2 px-3 text-muted-foreground">{areaLabel(a)}</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">
                  {a.dataInicio ? formatDate(a.dataInicio) : '—'}
                </td>
                <td className="py-2 px-3 text-muted-foreground text-xs">
                  {a.prazo ? formatDate(a.prazo) : '—'}
                </td>
                <td className="py-2 px-3">
                  <Badge variant={a.estado === 'Em Execução' ? 'default' : 'secondary'}>{a.estado}</Badge>
                </td>
                <td className="py-2 px-3 text-xs">
                  {a.relatorioFinalStoragePath && supabase ? (
                    <a
                      href={ciAuditoriaRelatorioFinalUrl(supabase, a.relatorioFinalStoragePath) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {a.relatorioFinalNomeFicheiro ?? 'Relatório'}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : a.estado === 'Concluída' ? (
                    <span className="text-destructive">Em falta</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 px-3 text-right space-x-1">
                  {a.estado === 'Planeada' ? (
                    <Button size="sm" variant="outline" onClick={() => void startExecucao(a.id)}>
                      <Play className="h-3 w-3 mr-1" /> Iniciar
                    </Button>
                  ) : null}
                  {a.estado === 'Em Execução' ? (
                    <Button size="sm" variant="outline" onClick={() => setConcluirAuditoria(a)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`${CI_BASE}/execucao?auditoria=${a.id}`}>Executar</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[min(90dvh,90vh)] grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editing ? 'Editar plano de auditoria' : 'Novo plano de auditoria'}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto space-y-4 py-2 pr-1">
            <CiEmpresaNaturezaFields empresas={empresasActivas} values={core} onChange={patch => setCore(c => ({ ...c, ...patch }))} />
            <div className="space-y-1">
              <Label>Estado do plano</Label>
              <Select
                value={estado}
                onValueChange={v => {
                  const next = v as CiAuditoriaEstado;
                  if (next === 'Concluída' && !editing) {
                    toast.message('Guarde o plano e use «Concluir» após iniciar a execução.');
                    return;
                  }
                  setEstado(next);
                  if (next !== 'Concluída') setRelatorioFile(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CI_ESTADOS_AUDITORIA.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {estado === 'Concluída' ? (
              <FileDropZone
                label="Relatório Final"
                accept={CI_EVIDENCIAS_ACCEPT}
                selectedFile={relatorioFile}
                onFileSelected={setRelatorioFile}
                validateFile={validateCiEvidenciaFile}
                existingFileName={
                  relatorioFile ? null : (editing?.relatorioFinalNomeFicheiro ?? null)
                }
                required={!editing?.relatorioFinalStoragePath}
                showRequiredHint={!editing?.relatorioFinalStoragePath && !relatorioFile}
                uploading={saving}
                idleTitle="Arraste o relatório final para aqui"
                idleSub="PDF, Word, Excel ou imagem (máx. 25 MB)"
              />
            ) : null}
            <div className="space-y-1">
              <Label>Objectivo (opcional)</Label>
              <Textarea value={objectivo} onChange={e => setObjectivo(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Observações (opcional)</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CiConcluirAuditoriaDialog
        open={concluirAuditoria != null}
        onOpenChange={o => {
          if (!o) setConcluirAuditoria(null);
        }}
        auditoria={concluirAuditoria}
        onConcluida={() => setConcluirAuditoria(null)}
      />
    </div>
  );
}

/** Rota legada */
export function PlaneamentoAuditoriasRedirect() {
  return <Navigate to={`${CI_BASE}/plano-auditorias`} replace />;
}
