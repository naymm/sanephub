import { format, formatDistanceToNow, differenceInDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

/** Texto pt-AO para editar valores (sem sufixo; vírgula decimal). */
export function formatMonetaryAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Interpreta entrada com separadores pt-AO (ex.: 1.234,56 ou 1234,5). */
export function parseMonetaryAmount(s: string): number {
  let t = s.trim().replace(/\u00a0/g, ' ');
  if (!t) return 0;
  t = t.replace(/\s/g, '').replace(/kz/gi, '');
  if (!t) return 0;
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  if (hasComma && hasDot) {
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else {
      t = t.replace(/,/g, '');
    }
  } else if (hasComma) {
    t = t.replace(',', '.');
  } else if (hasDot) {
    const parts = t.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      t = `${parts[0]}.${parts[1]}`;
    } else {
      t = t.replace(/\./g, '');
    }
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function formatKz(value: number): string {
  return new Intl.NumberFormat('pt-AO', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' Kz';
}

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: pt });
  } catch {
    return dateStr;
  }
}

export function formatDateLong(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "d 'de' MMMM 'de' yyyy", { locale: pt });
  } catch {
    return dateStr;
  }
}

export function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: pt });
  } catch {
    return dateStr;
  }
}

export function diasRestantes(dateStr: string): number {
  try {
    return differenceInDays(parseISO(dateStr), new Date());
  } catch {
    return 0;
  }
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function getCurrentDatePT(): string {
  return format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt });
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/** Dias entre duas datas (inclusive), para cálculo de férias */
export function diasEntre(inicio: string, fim: string): number {
  try {
    return differenceInCalendarDays(parseISO(fim), parseISO(inicio)) + 1;
  } catch {
    return 0;
  }
}

/** Hora para chat: hoje "HH:mm", ontem "Ontem HH:mm", mais antigo "d MMM" */
export function formatChatTime(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const now = new Date();
    const diff = differenceInDays(now, d);
    if (diff === 0) return format(d, 'HH:mm', { locale: pt });
    if (diff === 1) return `Ontem ${format(d, 'HH:mm', { locale: pt })}`;
    if (diff < 7) return format(d, 'EEEE HH:mm', { locale: pt });
    return format(d, 'd MMM', { locale: pt });
  } catch {
    return dateStr;
  }
}
