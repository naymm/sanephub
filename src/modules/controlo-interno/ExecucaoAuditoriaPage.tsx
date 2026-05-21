import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, CheckCircle2, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCiEmpresaId } from '@/modules/controlo-interno/useCiEmpresaId';
import { mapCiAuditoria, mapCiChecklistItem, mapCiEvidencia } from '@/modules/controlo-interno/ciMappers';
import { CiConcluirAuditoriaDialog } from '@/modules/controlo-interno/CiConcluirAuditoriaDialog';
import { CI_RESULTADOS_CHECKLIST } from '@/modules/controlo-interno/constants';
import type { CiChecklistResultado } from '@/types/controloInterno';
import { FileDropZone } from '@/components/shared/FileDropZone';
import {
  CI_EVIDENCIAS_ACCEPT,
  uploadCiChecklistEvidencia,
  validateCiEvidenciaFile,
  ciEvidenciaPublicUrl,
  ciAuditoriaRelatorioFinalUrl,
} from '@/lib/ciEvidencias';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ExecucaoAuditoriaPage() {
  const empresaId = useCiEmpresaId();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const auditoriaId = Number(params.get('auditoria') ?? 0) || null;
  const qc = useQueryClient();
  const [newPergunta, setNewPergunta] = useState('');
  const [newCriterio, setNewCriterio] = useState('');
  const [uploadItemId, setUploadItemId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [concluirOpen, setConcluirOpen] = useState(false);

  const { data: auditorias = [] } = useQuery({
    queryKey: ['ci', 'auditorias', 'exec', empresaId],
    enabled: isSupabaseConfigured() && empresaId != null,
    queryFn: async () => {
      if (!supabase || empresaId == null) return [];
      const { data } = await supabase.from('ci_auditorias').select('id, codigo, titulo, estado').eq('empresa_id', empresaId);
      return data ?? [];
    },
  });

  const selectedId = auditoriaId && auditorias.some(a => a.id === auditoriaId) ? auditoriaId : auditorias[0]?.id ?? null;

  const { data: auditoriaSeleccionada } = useQuery({
    queryKey: ['ci', 'auditoria', selectedId],
    enabled: isSupabaseConfigured() && selectedId != null,
    queryFn: async () => {
      if (!supabase || selectedId == null) return null;
      const { data, error } = await supabase.from('ci_auditorias').select('*').eq('id', selectedId).maybeSingle();
      if (error) throw error;
      return data ? mapCiAuditoria(data as Record<string, unknown>) : null;
    },
  });

  const { data: itens = [], refetch: refetchItens } = useQuery({
    queryKey: ['ci', 'checklist', selectedId],
    enabled: isSupabaseConfigured() && selectedId != null,
    queryFn: async () => {
      if (!supabase || selectedId == null) return [];
      const { data, error } = await supabase
        .from('ci_checklist_itens')
        .select('*')
        .eq('auditoria_id', selectedId)
        .order('ordem');
      if (error) throw error;
      return (data ?? []).map(r => mapCiChecklistItem(r as Record<string, unknown>));
    },
  });

  const itemIds = useMemo(() => itens.map(i => i.id), [itens]);

  const { data: evidencias = [] } = useQuery({
    queryKey: ['ci', 'evidencias', itemIds],
    enabled: itemIds.length > 0,
    queryFn: async () => {
      if (!supabase || !itemIds.length) return [];
      const { data } = await supabase.from('ci_checklist_evidencias').select('*').in('checklist_item_id', itemIds);
      return (data ?? []).map(r => mapCiEvidencia(r as Record<string, unknown>));
    },
  });

  const evByItem = useMemo(() => {
    const m = new Map<number, typeof evidencias>();
    for (const e of evidencias) {
      const list = m.get(e.checklistItemId) ?? [];
      list.push(e);
      m.set(e.checklistItemId, list);
    }
    return m;
  }, [evidencias]);

  const addItem = async () => {
    if (!supabase || selectedId == null || !newPergunta.trim()) return;
    const ordem = itens.length;
    const { error } = await supabase.from('ci_checklist_itens').insert({
      auditoria_id: selectedId,
      ordem,
      pergunta: newPergunta.trim(),
      criterio_avaliacao: newCriterio.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setNewPergunta('');
      setNewCriterio('');
      void refetchItens();
    }
  };

  const updateItem = async (id: number, patch: Record<string, unknown>) => {
    if (!supabase) return;
    const { error } = await supabase.from('ci_checklist_itens').update(patch).eq('id', id);
    if (error) toast.error(error.message);
    else void refetchItens();
  };

  const uploadEvidencia = async () => {
    if (!supabase || uploadItemId == null || !uploadFile) return;
    try {
      await uploadCiChecklistEvidencia(supabase, uploadItemId, uploadFile, user?.id ?? null);
      toast.success('Evidência anexada.');
      setUploadFile(null);
      setUploadItemId(null);
      void qc.invalidateQueries({ queryKey: ['ci', 'evidencias'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no upload');
    }
  };

  if (empresaId == null) return <p className="text-sm text-muted-foreground">Seleccione uma empresa.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="space-y-1 min-w-[240px] flex-1">
          <Label>Auditoria</Label>
          <Select
            value={selectedId?.toString() ?? ''}
            onValueChange={v => setParams({ auditoria: v })}
          >
            <SelectTrigger><SelectValue placeholder="Seleccionar auditoria" /></SelectTrigger>
            <SelectContent>
              {auditorias.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.codigo} — {a.titulo} ({a.estado})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {auditoriaSeleccionada?.estado === 'Em Execução' ? (
          <Button variant="default" onClick={() => setConcluirOpen(true)}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir auditoria
          </Button>
        ) : null}
        {auditoriaSeleccionada?.estado === 'Concluída' &&
        auditoriaSeleccionada.relatorioFinalStoragePath &&
        supabase ? (
          <a
            href={ciAuditoriaRelatorioFinalUrl(supabase, auditoriaSeleccionada.relatorioFinalStoragePath) ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline pb-2"
          >
            Relatório final
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      {!selectedId ? (
        <p className="text-sm text-muted-foreground">Crie uma auditoria em Planeamento primeiro.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Novo item de checklist</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Pergunta</Label>
                <Input value={newPergunta} onChange={e => setNewPergunta(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Critério de avaliação</Label>
                <Textarea value={newCriterio} onChange={e => setNewCriterio(e.target.value)} rows={2} />
              </div>
              <Button onClick={() => void addItem()} disabled={!newPergunta.trim()}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {itens.map(item => (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between gap-2">
                    <CardTitle className="text-sm font-medium">{item.pergunta}</CardTitle>
                    {item.resultado ? <Badge>{item.resultado}</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.criterioAvaliacao}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Resultado</Label>
                      <Select
                        value={item.resultado ?? 'none'}
                        onValueChange={v =>
                          void updateItem(item.id, {
                            resultado: v === 'none' ? null : v,
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {CI_RESULTADOS_CHECKLIST.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Observação</Label>
                    <Textarea
                      defaultValue={item.observacao}
                      onBlur={e => {
                        if (e.target.value !== item.observacao) {
                          void updateItem(item.id, { observacao: e.target.value });
                        }
                      }}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2 border-t pt-3">
                    <Label>Evidências (arrastar ficheiro)</Label>
                    {(evByItem.get(item.id) ?? []).map(ev => (
                      <div key={ev.id} className="text-xs flex items-center gap-2">
                        {supabase && (
                          <a
                            href={ciEvidenciaPublicUrl(supabase, ev.storagePath) ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 hover:underline"
                          >
                            {ev.nomeFicheiro}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                    {uploadItemId === item.id ? (
                      <div className="space-y-2">
                        <FileDropZone
                          label="Ficheiro"
                          accept={CI_EVIDENCIAS_ACCEPT}
                          selectedFile={uploadFile}
                          onFileSelected={setUploadFile}
                          validateFile={validateCiEvidenciaFile}
                          compact
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => void uploadEvidencia()} disabled={!uploadFile}>
                            Enviar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setUploadItemId(null); setUploadFile(null); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setUploadItemId(item.id)}>
                        Anexar evidência
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <CiConcluirAuditoriaDialog
        open={concluirOpen}
        onOpenChange={setConcluirOpen}
        auditoria={auditoriaSeleccionada ?? null}
        onConcluida={() => setConcluirOpen(false)}
      />
    </div>
  );
}
