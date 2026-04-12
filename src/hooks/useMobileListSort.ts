import { useCallback, useMemo, useState } from 'react';

export type MobileSortDir = 'asc' | 'desc';

export function useMobileListSort(defaultKey: string) {
  const [state, setState] = useState<{ key: string; dir: MobileSortDir }>({ key: defaultKey, dir: 'asc' });

  const toggleSort = useCallback((key: string) => {
    setState(prev => (prev.key !== key ? { key, dir: 'asc' } : { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }));
  }, []);

  return { sortState: state, toggleSort };
}

/** Ordena uma cópia da lista com base no estado do cabeçalho móvel. */
export function sortItemsForMobile<T>(
  items: T[],
  sortState: { key: string; dir: MobileSortDir },
  comparators: Record<string, (a: T, b: T) => number>,
): T[] {
  const cmp = comparators[sortState.key];
  if (!cmp) return items;
  const mult = sortState.dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => mult * cmp(a, b));
}

export function useSortedMobileSlice<T>(
  items: T[],
  sortState: { key: string; dir: MobileSortDir },
  comparators: Record<string, (a: T, b: T) => number>,
) {
  return useMemo(() => sortItemsForMobile(items, sortState, comparators), [items, sortState, comparators]);
}
