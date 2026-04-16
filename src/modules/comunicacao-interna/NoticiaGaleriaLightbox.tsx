import { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { normalizePublicMediaUrl } from '@/utils/publicMediaUrl';

type NoticiaGaleriaLightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título da notícia (cabeçalho do modal). */
  titulo: string;
  urls: string[];
  /** Índice inicial ao abrir. */
  initialIndex?: number;
};

/**
 * Galeria em lightbox (imagem principal, setas, faixa de miniaturas com destaque no activo).
 * Z-index acima do Sonner, como nos outros modais críticos.
 */
export function NoticiaGaleriaLightbox({ open, onOpenChange, titulo, urls, initialIndex = 0 }: NoticiaGaleriaLightboxProps) {
  const safeUrls = urls.filter((u): u is string => Boolean(u && String(u).trim()));
  const n = safeUrls.length;
  const [index, setIndex] = useState(0);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open || n === 0) return;
    setIndex(Math.min(Math.max(0, initialIndex), n - 1));
  }, [open, initialIndex, n]);

  const goPrev = useCallback(() => {
    setIndex(i => (i - 1 + n) % n);
  }, [n]);

  const goNext = useCallback(() => {
    setIndex(i => (i + 1) % n);
  }, [n]);

  useEffect(() => {
    if (!open || n <= 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex(i => (i - 1 + n) % n);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex(i => (i + 1) % n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, n]);

  useEffect(() => {
    const el = thumbRefs.current[index];
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [index]);

  if (n === 0) return null;

  const currentUrl = safeUrls[index];
  const src = normalizePublicMediaUrl(currentUrl) ?? currentUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          className={cn(
            '!z-[10000060] bg-black/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 !z-[10000061] grid max-h-[min(92dvh,92svh)] w-[min(calc(100vw-1.5rem),56rem)] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'max-md:!left-[max(0.75rem,env(safe-area-inset-left,0px))] max-md:!right-[max(0.75rem,env(safe-area-inset-right,0px))] max-md:!top-[max(0.75rem,env(safe-area-inset-top,0px))] max-md:!bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] max-md:!h-[min(92dvh,92svh)] max-md:!w-auto max-md:!max-w-none max-md:!translate-x-0 max-md:!translate-y-0',
          )}
        >
          <div className="relative flex min-h-[3.25rem] items-center justify-center border-b border-border/60 px-12 py-3">
            <DialogPrimitive.Title className="text-center text-[15px] font-semibold leading-snug text-foreground sm:text-base line-clamp-2">
              {titulo}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              type="button"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar galeria"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="relative flex min-h-[min(40vh,280px)] max-h-[min(58vh,520px)] w-full items-center justify-center bg-neutral-950">
            <img src={src} alt="" className="max-h-[min(58vh,520px)] w-full object-contain" />

            {n > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-[1px] transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:left-3"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-2 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-[1px] transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:right-3"
                  aria-label="Imagem seguinte"
                >
                  <ChevronRight className="h-6 w-6" strokeWidth={2.25} />
                </button>
              </>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-4 pb-4 pt-14 text-center">
              <p className="text-sm font-medium text-white drop-shadow-sm">
                Foto {index + 1} de {n}
              </p>
            </div>
          </div>

          <div className="relative border-t border-border/60 bg-muted/25">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-background via-background/80 to-transparent sm:w-12"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-background via-background/80 to-transparent sm:w-12"
              aria-hidden
            />
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-10 py-3 sm:gap-2.5 sm:px-12 [scrollbar-width:thin]">
              {safeUrls.map((url, i) => {
                const thumb = normalizePublicMediaUrl(url) ?? url;
                const active = i === index;
                return (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    ref={el => {
                      thumbRefs.current[i] = el;
                    }}
                    onClick={() => setIndex(i)}
                    className={cn(
                      'relative h-14 w-[4.5rem] shrink-0 snap-center overflow-hidden rounded-lg border-2 bg-background transition-shadow sm:h-16 sm:w-24',
                      active
                        ? 'border-primary shadow-md ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                        : 'border-transparent opacity-75 hover:opacity-100',
                    )}
                    aria-label={`Miniatura ${i + 1}`}
                    aria-current={active ? 'true' : undefined}
                  >
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                    {active ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Eye className="h-5 w-5 text-white drop-shadow-md" strokeWidth={2.25} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
