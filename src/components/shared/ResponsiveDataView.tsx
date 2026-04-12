import type { ReactNode } from 'react';

type Props = {
  /** Vista densa (tabela) — visível a partir de `md`. */
  tableView: ReactNode;
  /** Vista em cartões — mobile-first; oculta a partir de `md`. */
  cardView: ReactNode;
};

/**
 * Alterna entre tabela (desktop) e cartões (mobile) sem duplicar lógica de dados:
 * os dois ramos recebem os mesmos dados via closure no componente pai.
 */
export function ResponsiveDataView({ tableView, cardView }: Props) {
  return (
    <>
      <div className="hidden md:block w-full min-w-0">{tableView}</div>
      <div className="md:hidden w-full min-w-0">{cardView}</div>
    </>
  );
}
