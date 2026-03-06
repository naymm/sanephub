import { format, formatDistanceToNow, differenceInDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

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
