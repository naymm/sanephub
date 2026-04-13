import { cn } from '@/lib/utils';

type PontoMobilePinDisplayProps = {
  value: string;
  maxLength?: number;
  className?: string;
};

/** Caixas de PIN estilo OTP mobile (4 dígitos). */
export function PontoMobilePinDisplay({ value, maxLength = 4, className }: PontoMobilePinDisplayProps) {
  return (
    <div className={cn('flex justify-center gap-2.5 sm:gap-3 px-1', className)} aria-hidden>
      {Array.from({ length: maxLength }, (_, i) => {
        const char = value[i] ?? '';
        const isActive = value.length < maxLength && i === value.length;
        return (
          <div
            key={i}
            className={cn(
              'relative flex h-[52px] w-[44px] shrink-0 items-center justify-center rounded-xl border-2 text-xl font-semibold tabular-nums transition-all sm:h-14 sm:w-[52px]',
              isActive
                ? 'border-[hsl(var(--primary))] bg-background shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]'
                : 'border-border bg-card text-foreground',
              char && !isActive && 'border-border',
            )}
          >
            {char ? <span>{char}</span> : null}
            {isActive ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="h-5 w-0.5 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
