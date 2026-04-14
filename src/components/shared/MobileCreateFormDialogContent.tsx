import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type MobileCreateStepMeta = {
  current: number;
  total: number;
  title: string;
};

export type MobileCreateFormDialogContentProps = {
  showMobileCreate: boolean;
  onCloseMobile: () => void;
  moduleKicker: string;
  screenTitle: string;
  step?: MobileCreateStepMeta;
  /** Classes para o modo desktop (ex: max-w-sm, max-w-2xl) */
  desktopContentClassName?: string;
  desktopHeader: ReactNode;
  desktopFooter: ReactNode;
  mobileFooter: ReactNode;
  formBody: ReactNode;
};

const fullscreenDialogClasses =
  // Precisa ficar acima do `DialogOverlay` (z-[1050000]) para não aparecer “escurecido” por cima do ecrã.
  'fixed inset-0 left-0 top-0 z-[1050001] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none data-[state=closed]:slide-out-to-top-[0%] data-[state=open]:slide-in-from-top-[0%] data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 [&>button.absolute]:hidden';

/**
 * Conteúdo de Dialog duplo: ecrã completo em mobile (`showMobileCreate`) ou cabeçalho/rodapé clássicos no desktop.
 */
export function MobileCreateFormDialogContent({
  showMobileCreate,
  onCloseMobile,
  moduleKicker,
  screenTitle,
  step,
  desktopContentClassName = 'max-w-lg max-h-[90vh] overflow-y-auto',
  desktopHeader,
  desktopFooter,
  mobileFooter,
  formBody,
}: MobileCreateFormDialogContentProps) {
  return (
    <DialogContent
      className={cn(showMobileCreate ? fullscreenDialogClasses : desktopContentClassName)}
      onPointerDownOutside={(e) => {
        if (showMobileCreate) e.preventDefault();
      }}
      onEscapeKeyDown={(e) => {
        if (showMobileCreate) {
          e.preventDefault();
          onCloseMobile();
        }
      }}
    >
      {showMobileCreate ? (
        <>
          <div className="relative shrink-0 border-b border-border/40 bg-gradient-to-br from-[hsl(var(--navy))] to-[hsl(var(--navy-lighter))] px-4 pb-10 pt-[max(0.45rem,env(safe-area-inset-top,0px))] text-white shadow-md backdrop-blur-sm">
            <button
              type="button"
              onClick={() => onCloseMobile()}
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-center text-xs font-medium uppercase tracking-wider text-white/90">{moduleKicker}</p>
            <h2 className="text-center text-2xl font-bold leading-tight">{screenTitle}</h2>
          </div>
          <div className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-background shadow-[0_-12px_40px_rgba(0,0,0,0.07)]">
            {step ? (
              <div className="shrink-0 border-b border-border/60 bg-background px-4 pb-3 pt-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/5 text-sm font-bold text-primary"
                    aria-hidden
                  >
                    {step.current}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs font-medium text-primary">
                      Passo {step.current}/{step.total}
                    </p>
                    <p className="text-base font-semibold leading-snug text-foreground">{step.title}</p>
                  </div>
                </div>
              </div>
            ) : null}
            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-1',
                !step && 'pt-3',
              )}
            >
              {formBody}
            </div>
            <div className="shrink-0 border-t border-border/80 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              {mobileFooter}
            </div>
          </div>
        </>
      ) : (
        <>
          {desktopHeader}
          {formBody}
          {desktopFooter}
        </>
      )}
    </DialogContent>
  );
}

/** Atalho para cabeçalho desktop típico (título + descrição). */
export function mobileCreateDesktopHeader(
  title: string,
  description: string | undefined,
): ReactNode {
  return (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
    </DialogHeader>
  );
}
