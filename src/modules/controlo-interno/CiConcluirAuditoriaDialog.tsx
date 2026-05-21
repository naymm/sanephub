import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  CI_EVIDENCIAS_ACCEPT,
  ciAuditoriaRelatorioFinalUrl,
  uploadCiAuditoriaRelatorioFinal,
  validateCiEvidenciaFile,
} from '@/lib/ciEvidencias';
import { FileDropZone } from '@/components/shared/FileDropZone';
import type { CiAuditoria } from '@/types/controloInterno';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoria: CiAuditoria | null;
  onConcluida?: () => void;
};

export function CiConcluirAuditoriaDialog({ open, onOpenChange, auditoria, onConcluida }: Props) {
  const qc = useQueryClient();
  const [relatorioFile, setRelatorioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) setRelatorioFile(null);
  }, [open]);

  const temRelatorioExistente = Boolean(auditoria?.relatorioFinalStoragePath);
  const relatorioUrl =
    supabase && auditoria?.relatorioFinalStoragePath
      ? ciAuditoriaRelatorioFinalUrl(supabase, auditoria.relatorioFinalStoragePath)
      : null;

  const confirmar = async () => {
    if (!supabase || !auditoria) return;
    if (!relatorioFile && !temRelatorioExistente) {
      toast.error('Anexe o Relatório Final para concluir a auditoria.');
      return;
    }

    setUploading(true);
    try {
      let meta: {
        relatorio_final_storage_path: string;
        relatorio_final_nome_ficheiro: string;
        relatorio_final_mime_type: string;
        relatorio_final_tamanho_bytes: number;
        relatorio_final_uploaded_at: string;
      } | null = null;

      if (relatorioFile) {
        const upload = await uploadCiAuditoriaRelatorioFinal(supabase, auditoria.id);
        const m = await upload(relatorioFile);
        meta = {
          relatorio_final_storage_path: m.relatorioFinalStoragePath,
          relatorio_final_nome_ficheiro: m.relatorioFinalNomeFicheiro,
          relatorio_final_mime_type: m.relatorioFinalMimeType,
          relatorio_final_tamanho_bytes: m.relatorioFinalTamanhoBytes,
          relatorio_final_uploaded_at: new Date().toISOString(),
        };
      }

      const { error } = await supabase
        .from('ci_auditorias')
        .update({
          estado: 'Concluída',
          ...(meta ?? {}),
        })
        .eq('id', auditoria.id);

      if (error) throw error;
      toast.success('Auditoria concluída com relatório final.');
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ['ci'] });
      onConcluida?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao concluir');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Concluir auditoria</DialogTitle>
        </DialogHeader>
        {auditoria ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-mono text-xs">{auditoria.codigo}</span> — {auditoria.titulo}
            </p>
            <p className="text-sm">
              Para marcar como <strong>Concluída</strong>, é obrigatório anexar o{' '}
              <strong>Relatório Final</strong>.
            </p>
            {temRelatorioExistente && !relatorioFile ? (
              <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                Já existe relatório:{' '}
                {relatorioUrl ? (
                  <a
                    href={relatorioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    {auditoria.relatorioFinalNomeFicheiro ?? 'Ver ficheiro'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  (auditoria.relatorioFinalNomeFicheiro ?? '—')
                )}
                . Pode substituir ao arrastar um novo ficheiro.
              </p>
            ) : null}
            <FileDropZone
              label="Relatório Final"
              accept={CI_EVIDENCIAS_ACCEPT}
              selectedFile={relatorioFile}
              onFileSelected={setRelatorioFile}
              validateFile={validateCiEvidenciaFile}
              existingFileName={
                relatorioFile ? null : (auditoria.relatorioFinalNomeFicheiro ?? null)
              }
              required={!temRelatorioExistente}
              showRequiredHint={!temRelatorioExistente && !relatorioFile}
              uploading={uploading}
              uploadingHint="A carregar relatório…"
              idleTitle="Arraste o relatório final para aqui"
              idleSub="PDF, Word, Excel ou imagem (máx. 25 MB)"
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={uploading || !auditoria}>
            Concluir auditoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
