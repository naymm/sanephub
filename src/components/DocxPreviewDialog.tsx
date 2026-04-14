import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { renderAsync } from 'docx-preview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import {
  PREVIEW_BODY_FLEX_CHAIN,
  PREVIEW_DIALOG_MOBILE,
  PREVIEW_FOOTER_SAFE_BOTTOM,
  PREVIEW_HEADER_SAFE_TOP,
} from '@/lib/documentPreviewMobileClasses';

/** Visualizador Microsoft (requer URL HTTPS pública acessível na internet na Internet). */
const OFFICE_EMBED_BASE = 'https://view.officeapps.live.com/op/embed.aspx';

function officeEmbedUrl(publicFileUrl: string): string {
  return `${OFFICE_EMBED_BASE}?src=${encodeURIComponent(publicFileUrl)}`;
}

type DocxPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storagePath: string | null;
  bucket: string;
  fileUrl: string | null;
  titulo: string;
  nomeDownload: string;
};

async function blobFromSources(
  storagePath: string | null,
  bucket: string,
  fileUrl: string | null,
): Promise<Blob> {
  if (supabase && storagePath) {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (!error && data) return data;
    if (fileUrl) {
      const res = await fetch(fileUrl, { mode: 'cors', credentials: 'omit' });
      if (res.ok) return res.blob();
    }
    if (error) throw new Error(error.message);
    throw new Error('Não foi possível descarregar o ficheiro.');
  }
  if (fileUrl) {
    const res = await fetch(fileUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`Não foi possível obter o ficheiro (HTTP ${res.status}).`);
    return res.blob();
  }
  throw new Error('Sem caminho de ficheiro.');
}

function waitForRef(
  getEl: () => HTMLDivElement | null,
  cb: (el: HTMLDivElement) => void,
  onGiveUp: () => void,
  attempts = 0,
) {
  const el = getEl();
  if (el) {
    cb(el);
    return;
  }
  if (attempts > 120) {
    onGiveUp();
    return;
  }
  requestAnimationFrame(() => waitForRef(getEl, cb, onGiveUp, attempts + 1));
}

type PreviewMode = 'office' | 'html';

/**
 * Pré-visualização DOCX: por defeito Microsoft Office Online (mais fiel ao Word);
 * alternativa HTML via docx-preview (limitações de layout).
 */
export function DocxPreviewDialog({
  open,
  onOpenChange,
  storagePath,
  bucket,
  fileUrl,
  titulo,
  nomeDownload,
}: DocxPreviewDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const isMobile = useIsMobileViewport();
  const canUseOfficeEmbed = Boolean(fileUrl && /^https:\/\//i.test(fileUrl));
  const [previewMode, setPreviewMode] = useState<PreviewMode>('office');

  useEffect(() => {
    if (!open) return;
    /** No telemóvel o iframe Office Online costuma falhar ou ser pouco usável; HTML local é mais fiável. */
    setPreviewMode(canUseOfficeEmbed && !isMobile ? 'office' : 'html');
    setError(null);
  }, [open, canUseOfficeEmbed, isMobile]);

  useLayoutEffect(() => {
    if (!open || previewMode !== 'html') {
      if (!open) setLoading(false);
      return;
    }
    if (!storagePath && !fileUrl) {
      setError('Sem ficheiro para mostrar.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    waitForRef(
      () => containerRef.current,
      el => {
        el.innerHTML = '';

        void (async () => {
          try {
            const blob = await blobFromSources(storagePath, bucket, fileUrl);
            if (cancelled) return;
            await renderAsync(blob, el, undefined, {
              className: 'docx',
              inWrapper: true,
              breakPages: true,
              ignoreFonts: false,
              renderHeaders: true,
              renderFooters: true,
              renderFootnotes: true,
              renderEndnotes: true,
            });
          } catch (e) {
            if (!cancelled) {
              setError(e instanceof Error ? e.message : 'Erro ao renderizar o documento.');
            }
          } finally {
            if (!cancelled) setLoading(false);
          }
        })();
      },
      () => {
        if (!cancelled) {
          setError('Área de pré-visualização indisponível. Tente fechar e abrir de novo.');
          setLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
      const el = containerRef.current;
      if (el) el.innerHTML = '';
    };
  }, [open, previewMode, storagePath, bucket, fileUrl]);

  const showOffice = canUseOfficeEmbed && previewMode === 'office';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0',
          PREVIEW_DIALOG_MOBILE,
          showOffice
            ? 'h-[95vh] max-w-[90vw] w-full sm:max-w-[90vw] max-md:h-[100dvh]'
            : 'max-w-4xl sm:max-w-4xl',
        )}
      >
        <DialogHeader
          className={cn('shrink-0 space-y-1 px-6 pt-6 pb-2 max-md:text-left', PREVIEW_HEADER_SAFE_TOP)}
        >
          <DialogTitle className="line-clamp-2 pr-8 text-base md:text-lg">
            {titulo || 'Documento Word'}
          </DialogTitle>
          {showOffice ? (
            <DialogDescription className="text-xs leading-relaxed max-md:line-clamp-3">
              Pré-visualização com <strong>Microsoft Office Online</strong> (layout próximo do Word). O ficheiro é
              carregado a partir de um URL público HTTPS. Se preferir não usar este serviço, escolha a pré-visualização
              HTML abaixo.
            </DialogDescription>
          ) : (
            <DialogDescription className="text-xs leading-relaxed max-md:line-clamp-3">
              Pré-visualização <strong>HTML</strong> (biblioteca docx-preview): útil offline ou sem URL público; o
              aspeto pode diferir do Word.
            </DialogDescription>
          )}
        </DialogHeader>

        {canUseOfficeEmbed ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-6 py-2 max-md:px-4">
            <Button
              type="button"
              size="sm"
              variant={previewMode === 'office' ? 'secondary' : 'ghost'}
              onClick={() => setPreviewMode('office')}
            >
              Word (Office Online)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewMode === 'html' ? 'secondary' : 'ghost'}
              onClick={() => setPreviewMode('html')}
            >
              HTML simplificado
            </Button>
          </div>
        ) : null}

        {showOffice && fileUrl ? (
          <div className={cn('px-0 pb-0', PREVIEW_BODY_FLEX_CHAIN)}>
            <iframe
              key={fileUrl}
              title="Pré-visualização Word (Office Online)"
              src={officeEmbedUrl(fileUrl)}
              className="h-[min(78vh,800px)] w-full min-h-0 min-w-0 flex-1 border-0 bg-muted/20 max-md:h-full"
              allow="fullscreen"
            />
          </div>
        ) : (
          <div
            className={cn(
              'relative px-6 pb-2 max-md:px-4 max-md:pb-2',
              PREVIEW_BODY_FLEX_CHAIN,
            )}
          >
            {loading ? (
              <div className="absolute inset-x-6 inset-y-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md border border-border/60 bg-background/90 max-md:inset-x-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">A carregar documento…</span>
              </div>
            ) : null}
            {error ? (
              <div className="mb-2 shrink-0 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <div className="h-[min(60vh,520px)] w-full min-h-0 min-w-0 flex-1 overflow-auto overscroll-y-contain rounded-md border border-border/60 bg-card p-3 text-foreground touch-pan-y max-md:h-full max-md:max-h-full max-md:p-2">
                <div
                  ref={containerRef}
                  className="docx-preview-mount min-h-[min(50vh,480px)] w-full max-w-full min-w-0 [&_.docx-wrapper]:box-border [&_.docx-wrapper]:max-w-full [&_.docx-wrapper]:bg-card [&_.docx]:box-border [&_.docx]:max-w-full [&_.docx]:text-foreground max-md:min-h-0 max-md:[&_.docx]:text-[15px] max-md:[&_.docx-wrapper]:!p-2"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter
          className={cn(
            'shrink-0 border-t border-border/60 px-6 py-4 sm:justify-between',
            PREVIEW_FOOTER_SAFE_BOTTOM,
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={downloading || (!storagePath && !fileUrl)}
            onClick={() => {
              void (async () => {
                if (!nomeDownload.trim()) {
                  toast.error('Nome de ficheiro inválido.');
                  return;
                }
                setDownloading(true);
                try {
                  const blob = await blobFromSources(storagePath, bucket, fileUrl);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = nomeDownload.trim();
                  a.rel = 'noopener';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Não foi possível descarregar.');
                } finally {
                  setDownloading(false);
                }
              })();
            }}
          >
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A descarregar…
              </>
            ) : (
              'Descarregar'
            )}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
