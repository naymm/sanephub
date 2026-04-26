import type { LucideIcon } from 'lucide-react';
import { CalendarX, Clock, DollarSign, FileText, Palmtree } from 'lucide-react';

/** Ícones do menu Portal (avatar, etc.) alinhados ao `HorizontalMenu`. */
export const PORTAL_PATH_ICONS: Record<string, LucideIcon> = {
  '/portal/ferias': Palmtree,
  '/portal/faltas': CalendarX,
  '/portal/assiduidade': Clock,
  '/portal/recibos': FileText,
  '/portal/declaracoes': FileText,
  '/portal/requisicoes': DollarSign,
};
