import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  /** Teclas claras com bordo fino (ecrãs tipo cartão branco / referência PWA). */
  variant?: 'default' | 'card';
};

export function MobilePinKeypad({ onDigit, onBackspace, disabled, variant = 'default' }: Props) {
  const keys: Array<string | 'back' | null> = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'back'];

  const digitClass =
    variant === 'card'
      ? 'rounded-full border border-border/40 bg-background text-xl font-semibold text-foreground shadow-none transition active:scale-95 active:bg-muted/30 disabled:opacity-40'
      : 'rounded-full border border-border/80 bg-muted/30 text-xl font-semibold text-foreground shadow-sm transition active:scale-95 active:bg-muted/60 disabled:opacity-40';

  const backClass =
    variant === 'card'
      ? 'rounded-full border border-border/40 bg-background text-foreground shadow-none transition active:scale-95 active:bg-muted/30 disabled:opacity-40'
      : 'rounded-full border border-border/80 bg-muted/40 text-foreground shadow-sm transition active:scale-95 disabled:opacity-40';

  const gridGap = variant === 'card' ? 'gap-5 max-w-[300px]' : 'gap-4 max-w-[280px]';

  return (
    <div className={cn('mx-auto grid w-full grid-cols-3 px-2', gridGap)}>
      {keys.map((k, i) => {
        if (k === null) {
          return <div key={`e-${i}`} className="aspect-square" aria-hidden />;
        }
        if (k === 'back') {
          return (
            <button
              key="back"
              type="button"
              disabled={disabled}
              onClick={onBackspace}
              className={cn('flex aspect-square items-center justify-center', backClass)}
              aria-label="Apagar"
            >
              <Delete className="h-6 w-6" strokeWidth={1.75} />
            </button>
          );
        }
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(k)}
            className={cn('flex aspect-square items-center justify-center', digitClass)}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

export function MobilePinDots({
  filled,
  total = 4,
  size = 'sm',
}: {
  filled: number;
  total?: number;
  size?: 'sm' | 'md';
}) {
  const dot =
    size === 'md'
      ? 'h-3.5 w-3.5 rounded-full border-2'
      : 'h-2.5 w-2.5 rounded-full border-2';

  const gap = size === 'md' ? 'gap-4' : 'gap-3';

  return (
    <div className={cn('flex justify-center py-2', gap)} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            dot,
            'transition-colors',
            i < filled ? 'border-foreground bg-foreground' : 'border-muted-foreground/40 bg-transparent',
          )}
        />
      ))}
    </div>
  );
}
