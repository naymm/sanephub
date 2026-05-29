import type { ComponentProps } from 'react';
import type { PopoverContent } from '@/components/ui/popover';

/** Evita que Popover + Command dentro de Dialog fechem ao pesquisar (focus trap / clique no formulário). */
export const comboboxPopoverContentProps: Partial<ComponentProps<typeof PopoverContent>> = {
  onOpenAutoFocus: (e) => e.preventDefault(),
  onCloseAutoFocus: (e) => e.preventDefault(),
  onFocusOutside: (e) => e.preventDefault(),
  onInteractOutside: (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[role="dialog"]')) {
      e.preventDefault();
    }
  },
};
