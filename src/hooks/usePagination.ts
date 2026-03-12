import { useState, useCallback, useMemo } from 'react';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export interface UsePaginationOptions {
  totalCount: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  initialPage?: number;
}

export interface UsePaginationReturn {
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  totalPages: number;
  from: number;
  to: number;
  canPrev: boolean;
  canNext: boolean;
  goToPage: (p: number) => void;
  onPageSizeChange: (size: number) => void;
  resetPage: () => void;
  pageSizeOptions: number[];
}

export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const {
    totalCount,
    pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
    pageSizeOptions: opts = DEFAULT_PAGE_SIZE_OPTIONS,
    initialPage = 0,
  } = options;

  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const from = totalCount === 0 ? 0 : currentPage * pageSize + 1;
  const to = Math.min(currentPage * pageSize + pageSize, totalCount);
  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1;

  const setPage = useCallback((p: number) => {
    setPageState(Math.max(0, p));
  }, []);

  const goToPage = useCallback((p: number) => {
    setPageState(Math.max(0, Math.min(p, totalPages - 1)));
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
  }, []);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(0);
  }, []);

  const resetPage = useCallback(() => {
    setPageState(0);
  }, []);

  return {
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    from,
    to,
    canPrev,
    canNext,
    goToPage,
    onPageSizeChange,
    resetPage,
    pageSizeOptions: opts,
  };
}
