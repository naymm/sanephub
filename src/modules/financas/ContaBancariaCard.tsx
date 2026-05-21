import type { ContaBancaria } from '@/types';
import { formatRelative } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Landmark, MoreVertical, Pencil, RefreshCw, Trash2 } from 'lucide-react';

function formatSaldoConta(value: number): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatted} Kz`;
}

export type ContaBancariaCardProps = {
  conta: ContaBancaria;
  bancoNome: string;
  bancoCodigo?: string;
  empresaNome?: string;
  showEmpresa?: boolean;
  canManage?: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  refreshing?: boolean;
};

export function ContaBancariaCard({
  conta,
  bancoNome,
  bancoCodigo,
  empresaNome,
  showEmpresa = false,
  canManage = false,
  onRefresh,
  onEdit,
  onDelete,
  refreshing = false,
}: ContaBancariaCardProps) {
  const tituloPrincipal = conta.descricao?.trim()
    ? `${conta.numeroConta} (${conta.descricao.trim()})`
    : conta.numeroConta;

  const saldoPositivo = conta.saldoActual >= 0;
  const ultimaActualizacao = conta.updatedAt
    ? formatRelative(conta.updatedAt)
    : conta.createdAt
      ? formatRelative(conta.createdAt)
      : null;

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl border-2 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md',
        'border-primary/20 hover:border-primary/35',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Landmark className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold leading-snug text-foreground line-clamp-2">{tituloPrincipal}</h2>
          </div>
          <p className="pl-10 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{bancoNome}</span>
            {bancoCodigo ? (
              <span className="text-muted-foreground"> · {bancoCodigo}</span>
            ) : null}
          </p>
          <p className="pl-10 font-mono text-[11px] text-muted-foreground/90 tracking-tight">{conta.numeroConta}</p>
          {showEmpresa && empresaNome ? (
            <p className="pl-10 text-[11px] text-muted-foreground">{empresaNome}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onRefresh ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Actualizar saldo"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          ) : null}
          {canManage && (onEdit || onDelete) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label="Mais opções"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit ? (
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar conta
                  </DropdownMenuItem>
                ) : null}
                {onEdit && onDelete ? <DropdownMenuSeparator /> : null}
                {onDelete ? (
                  <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="my-6 flex min-h-[3.5rem] items-center justify-center px-2">
        <p
          className={cn(
            'text-center text-2xl font-bold tracking-tight sm:text-[1.65rem]',
            saldoPositivo ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive',
          )}
        >
          {formatSaldoConta(conta.saldoActual)}
        </p>
      </div>

      <div className="mt-auto space-y-0.5 border-t border-border/60 pt-3 text-center text-[11px] text-muted-foreground">
        <p>
          Última actualização:{' '}
          <span className="font-medium text-foreground/80">
            {ultimaActualizacao ?? '—'}
          </span>
        </p>
        <p>
          Saldo actualizado automaticamente pelos movimentos de tesouraria associados a esta conta.
        </p>
      </div>
    </article>
  );
}
