import { useState, useCallback, useMemo } from 'react';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export interface UseClientSidePaginationOptions<T> {
  items: T[];
  pageSize?: number;
  pageSizeOptions?: number[];
}

export interface UseClientSidePaginationReturn<T> {
  slice: T[];
  from: number;
  to: number;
  totalFiltered: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  pageSizeOptions: number[];
  canPrev: boolean;
  canNext: boolean;
  goToPage: (p: number) => void;
  onPageSizeChange: (size: number) => void;
  resetPage: () => void;
  paginationProps: {
    from: number;
    to: number;
    totalFiltered: number;
    pageSize: number;
    pageSizeOptions: number[];
    currentPage: number;
    totalPages: number;
    canPrev: boolean;
    canNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    onPageSizeChange: (size: number) => void;
  };
}

export function useClientSidePagination<T>(
  options: UseClientSidePaginationOptions<T>
): UseClientSidePaginationReturn<T> {
  const {
    items,
    pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  } = options;

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalFiltered = items.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const from = totalFiltered === 0 ? 0 : currentPage * pageSize + 1;
  const to = Math.min(currentPage * pageSize + pageSize, totalFiltered);
  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1;

  const slice = useMemo(() => {
    const start = currentPage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
  }, [totalPages]);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  const resetPage = useCallback(() => setPage(0), []);

  return {
    slice,
    from,
    to,
    totalFiltered,
    totalPages,
    currentPage,
    pageSize,
    pageSizeOptions,
    canPrev,
    canNext,
    goToPage,
    onPageSizeChange,
    resetPage,
    paginationProps: {
      from,
      to,
      totalFiltered,
      pageSize,
      pageSizeOptions,
      currentPage,
      totalPages,
      canPrev,
      canNext,
      onPrev: () => goToPage(currentPage - 1),
      onNext: () => goToPage(currentPage + 1),
      onPageSizeChange,
    },
  };
}
