import { cn } from '@/lib/utils';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  pulse?: boolean;
  className?: string;
}

const autoVariant = (status: string): StatusVariant => {
  const s = status.toLowerCase();
  if (['activo', 'aprovado', 'pago', 'concluído', 'publicado', 'ganho', 'mitigado', 'confirmado', 'respondida', 'conciliado', 'regularizado', 'entregue', 'emitida'].includes(s)) return 'success';
  if (['pendente', 'em análise', 'em tratamento', 'em revisão', 'rascunho', 'em negociação', 'a renovar', 'em monitorização', 'agendada', 'recebido', 'em conciliação'].includes(s)) return 'warning';
  if (['rejeitado', 'vencido', 'perdido', 'materializado', 'cancelado', 'rescindido', 'expirado', 'injustificada', 'crítico', 'devolvido'].includes(s)) return 'danger';
  if (['enviado à contabilidade', 'em curso', 'suspenso', 'identificado'].includes(s)) return 'info';
  return 'neutral';
};

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
  neutral: 'bg-slate-100 text-slate-600',
  gold: 'bg-amber-50 text-amber-800',
};

export function StatusBadge({ status, variant, pulse, className }: StatusBadgeProps) {
  const v = variant ?? autoVariant(status);
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
      variantStyles[v],
      pulse && "animate-pulse",
      className
    )}>
      {status}
    </span>
  );
}
