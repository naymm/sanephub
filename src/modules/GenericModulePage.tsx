import { useData } from '@/context/DataContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, formatKz } from '@/utils/formatters';

interface GenericModulePageProps {
  title: string;
  module: string;
}

export default function GenericModulePage({ title }: GenericModulePageProps) {
  return (
    <div className="space-y-6">
      <h1 className="page-header">{title}</h1>
      <div className="table-container py-12 px-6 text-center">
        <p className="text-sm text-muted-foreground">Módulo em desenvolvimento. Dados seed disponíveis.</p>
        <p className="text-xs text-muted-foreground/80 mt-1">Peça para implementar o CRUD completo deste módulo.</p>
      </div>
    </div>
  );
}
