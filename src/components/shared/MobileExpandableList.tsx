import { useState, type ReactNode } from 'react';
import { Plus, Minus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { MobileSortDir } from '@/hooks/useMobileListSort';

export type MobileDetailField = { label: string; value: ReactNode };

export function MobileListSortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: MobileSortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <span className="truncate">{label}</span>
      {!active ? (
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      ) : dir === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
    </button>
  );
}

function DetailField({ label, value }: MobileDetailField) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-semibold leading-snug text-foreground">{value ?? '—'}</p>
    </div>
  );
}

export interface MobileExpandableListProps<T> {
  items: T[];
  rowId: (item: T) => string | number;
  loading?: boolean;
  /** Barra de ordenação no topo (opcional). */
  sortBar?: {
    options: { key: string; label: string }[];
    state: { key: string; dir: MobileSortDir };
    onToggle: (key: string) => void;
  };
  renderSummary: (item: T) => {
    avatar?: ReactNode;
    title: ReactNode;
    trailing?: ReactNode;
  };
  renderDetails: (item: T) => MobileDetailField[];
  renderActions?: (item: T) => ReactNode;
  className?: string;
}

/**
 * Lista móvel com linhas expansíveis (substitui tabelas largas em `max-md`).
 */
export function MobileExpandableList<T>({
  items,
  rowId,
  loading,
  sortBar,
  renderSummary,
  renderDetails,
  renderActions,
  className,
}: MobileExpandableListProps<T>) {
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm',
        className,
      )}
    >
      {sortBar && sortBar.options.length > 0 && (
        <div className="flex gap-1 border-b border-border/80 bg-muted/30 p-2">
          {sortBar.options.map(opt => (
            <MobileListSortButton
              key={opt.key}
              label={opt.label}
              active={sortBar.state.key === opt.key}
              dir={sortBar.state.dir}
              onClick={() => sortBar.onToggle(opt.key)}
            />
          ))}
        </div>
      )}
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map(item => {
            const id = rowId(item);
            const open = expandedId === id;
            const sum = renderSummary(item);
            return (
              <li key={String(id)}>
                <Collapsible open={open} onOpenChange={next => setExpandedId(next ? id : null)}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full min-h-14 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm"
                        aria-hidden
                      >
                        {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                      {sum.avatar != null ? <span className="shrink-0">{sum.avatar}</span> : null}
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{sum.title}</span>
                      {sum.trailing != null ? <span className="shrink-0">{sum.trailing}</span> : null}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-3 border-t border-border/60 bg-muted/25 px-3 py-3">
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {renderDetails(item).map((f, i) => (
                          <DetailField key={i} label={f.label} value={f.value} />
                        ))}
                      </dl>
                      {renderActions ? (
                        <div className="flex flex-wrap items-stretch gap-2 pt-1">{renderActions(item)}</div>
                      ) : null}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
