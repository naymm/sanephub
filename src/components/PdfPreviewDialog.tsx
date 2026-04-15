import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PREVIEW_DIALOG_MOBILE } from '@/lib/documentPreviewMobileClasses';
import { resolvePdfIframeSrc } from '@/utils/pdfPreviewPublicUrl';
import { useOptionalMobileSessionLock } from '@/context/MobileSessionLockContext';

export type PdfPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  iframeTitle: string;
  /** Texto enquanto ainda não existe URL (ex.: geração do blob). */
  loadingText?: string;
};

/**
 * Pré-visualização de PDF em diálogo — alinhado com Finanças (Tesouraria / Requisições)
 * e com o mesmo comportamento em viewport estreito que Docx/Excel (`PREVIEW_DIALOG_MOBILE`).
 */
export function PdfPreviewDialog({
  open,
  onOpenChange,
  url,
  iframeTitle,
  loadingText = 'Gerando pré-visualização...',
}: PdfPreviewDialogProps) {
  const msl = useOptionalMobileSessionLock();
  const iframeSrc = url ? resolvePdfIframeSrc(url) : undefined;

  const handleOpenChange = (next: boolean) => {
    if (!next) msl?.bumpActivity();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0',
          'h-[95vh] max-w-[90vw] w-full sm:max-w-[90vw]',
          'max-md:h-[100dvh] max-md:max-h-[100dvh]',
          /* Botão fechar (filho Radix) abaixo da status bar / notch */
          'max-md:[&>button]:top-[max(0.75rem,env(safe-area-inset-top,0px))]',
          'max-md:[&>button]:right-[max(0.75rem,env(safe-area-inset-right,0px))]',
          PREVIEW_DIALOG_MOBILE,
        )}
      >
        <DialogTitle className="sr-only">{iframeTitle}</DialogTitle>
        {url && iframeSrc ? (
          <>
            <DialogDescription className="sr-only">Documento PDF em pré-visualização.</DialogDescription>
            <div
              className={cn(
                'min-h-0 min-w-0 flex-1 flex flex-col',
                /* Sem overflow-hidden no telemóvel: permite scroll se o PDF ainda não encaixar */
                'max-md:overflow-auto max-md:overscroll-contain max-md:touch-pan-x max-md:touch-pan-y',
                'md:min-h-0 md:overflow-hidden',
              )}
            >
              <iframe
                src={iframeSrc}
                title={iframeTitle}
                className="min-h-0 min-w-0 flex-1 w-full border-0 bg-muted/10 rounded-md max-md:rounded-none max-md:min-h-[70dvh]"
              />
            </div>
          </>
        ) : (
          <DialogDescription>{loadingText}</DialogDescription>
        )}
      </DialogContent>
    </Dialog>
  );
}
