import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface DataTablePaginationProps {
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
}

export function DataTablePagination({
  from,
  to,
  totalFiltered,
  pageSize,
  pageSizeOptions,
  currentPage,
  totalPages,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPageSizeChange,
}: DataTablePaginationProps) {
  if (totalFiltered <= 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-t border-border/80">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{from}–{to} de {totalFiltered}</span>
        <Select value={String(pageSize)} onValueChange={v => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-[72px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map(n => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>por página</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8" disabled={!canPrev} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        <span className="px-2 text-sm text-muted-foreground">
          Página {currentPage + 1} de {totalPages}
        </span>
        <Button variant="outline" size="sm" className="h-8" disabled={!canNext} onClick={onNext}>
          Próximo <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
