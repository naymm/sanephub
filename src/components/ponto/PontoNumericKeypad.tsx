import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

type PontoNumericKeypadProps = {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  className?: string;
};

const ROWS: (string | 'back')[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'back'],
];

/** Teclado numérico para PIN (evita teclado do sistema no mobile). */
export function PontoNumericKeypad({ onDigit, onBackspace, disabled, className }: PontoNumericKeypadProps) {
  return (
    <div className={cn('grid w-full max-w-sm mx-auto gap-2.5', className)} role="group" aria-label="Teclado numérico">
      {ROWS.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-2.5">
          {row.map((cell, ci) => {
            if (cell === '') {
              return <div key={`spacer-${ri}-${ci}`} className="min-h-[52px]" aria-hidden />;
            }
            if (cell === 'back') {
              return (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBackspace()}
                  className={cn(
                    'flex min-h-[52px] items-center justify-center rounded-2xl border border-border/80 bg-card text-foreground shadow-sm transition-colors',
                    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
                    'hover:bg-muted/80',
                  )}
                  aria-label="Apagar último dígito"
                >
                  <Delete className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
                </button>
              );
            }
            return (
              <button
                key={`${ri}-${ci}`}
                type="button"
                disabled={disabled}
                onClick={() => onDigit(cell)}
                className={cn(
                  'min-h-[52px] rounded-2xl border border-border/80 bg-card text-xl font-semibold text-foreground shadow-sm transition-colors',
                  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
                  'hover:bg-muted/80',
                )}
              >
                {cell}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
