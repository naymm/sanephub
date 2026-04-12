import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FileText, Mail, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

type TipoArquivo = 'todos' | 'Documento' | 'Correspondência' | 'Acta';

interface ItemArquivo {
  id: string;
  tipo: TipoArquivo;
  tipoRaw: string;
  ref: string;
  titulo: string;
  data: string;
  link: string;
}

export default function ArquivoPage() {
  const { documentosOficiais, correspondencias, actas } = useData();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoArquivo>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const docsArquivados = documentosOficiais.filter(d => d.status === 'Arquivado');
  const corrArquivadas = correspondencias.filter(c => c.estadoResposta === 'Arquivada');
  const actasArquivadas = actas.filter(a => a.status === 'Arquivada');

  const items: ItemArquivo[] = [
    ...docsArquivados.map(d => ({
      id: `doc-${d.id}`,
      tipo: 'Documento' as const,
      tipoRaw: d.tipo,
      ref: d.numero,
      titulo: d.titulo,
      data: d.data,
      link: '/secretaria/documentos',
    })),
    ...corrArquivadas.map(c => ({
      id: `corr-${c.id}`,
      tipo: 'Correspondência' as const,
      tipoRaw: c.tipo,
      ref: c.referencia,
      titulo: c.assunto,
      data: c.data,
      link: '/secretaria/correspondencias',
    })),
    ...actasArquivadas.map(a => ({
      id: `acta-${a.id}`,
      tipo: 'Acta' as const,
      tipoRaw: a.status,
      ref: a.numero,
      titulo: a.titulo,
      data: a.data,
      link: '/secretaria/actas',
    })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  const filtered = items.filter(i => {
    const matchSearch =
      i.ref.toLowerCase().includes(search.toLowerCase()) ||
      i.titulo.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === 'todos' || i.tipo === tipoFilter;
    let matchDate = true;
    if (dataInicio) matchDate = matchDate && i.data >= dataInicio;
    if (dataFim) matchDate = matchDate && i.data <= dataFim;
    return matchSearch && matchTipo && matchDate;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('data');
  const mobileComparators = useMemo(
    () => ({
      data: (a: ItemArquivo, b: ItemArquivo) => a.data.localeCompare(b.data),
      titulo: (a: ItemArquivo, b: ItemArquivo) => a.titulo.localeCompare(b.titulo, 'pt', { sensitivity: 'base' }),
    }),
    [],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const Icon = ({ tipo }: { tipo: TipoArquivo }) => {
    if (tipo === 'Documento') return <FileText className="h-4 w-4 text-muted-foreground" />;
    if (tipo === 'Correspondência') return <Mail className="h-4 w-4 text-muted-foreground" />;
    return <BookOpen className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <h1 className="page-header">Arquivo Institucional</h1>
      <p className="text-sm text-muted-foreground">Documentos oficiais arquivados, correspondências arquivadas e actas arquivadas.</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar referência ou título..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as TipoArquivo)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Documento">Documentos oficiais</SelectItem>
            <SelectItem value="Correspondência">Correspondências</SelectItem>
            <SelectItem value="Acta">Actas</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px] h-9" placeholder="Data de" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px] h-9" placeholder="Data até" />
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider w-10"></th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Referência</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Título / Assunto</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Módulo</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(i => (
              <tr key={i.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5"><Icon tipo={i.tipo} /></td>
                <td className="py-3 px-5 font-medium">{i.tipo}</td>
                <td className="py-3 px-5 font-mono text-xs">{i.ref}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-md truncate" title={i.titulo}>{i.titulo}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(i.data)}</td>
                <td className="py-3 px-5">
                  <Link to={i.link} className="text-primary hover:underline text-xs">
                    Ver em {i.tipo === 'Documento' ? 'Documentos' : i.tipo === 'Correspondência' ? 'Correspondências' : 'Actas'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={i => i.id}
          sortBar={{
            options: [
              { key: 'data', label: 'Data' },
              { key: 'titulo', label: 'Título' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={i => ({
            avatar: <Icon tipo={i.tipo} />,
            title: i.titulo,
            trailing: <span className="text-xs text-muted-foreground">{i.tipo}</span>,
          })}
          renderDetails={i => [
            { label: 'Tipo', value: i.tipo },
            { label: 'Tipo (detalhe)', value: i.tipoRaw },
            { label: 'Referência', value: i.ref },
            { label: 'Título / Assunto', value: i.titulo },
            { label: 'Data', value: formatDate(i.data) },
            {
              label: 'Módulo',
              value:
                i.tipo === 'Documento' ? 'Documentos oficiais' : i.tipo === 'Correspondência' ? 'Correspondências' : 'Actas',
            },
          ]}
          renderActions={i => (
            <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" asChild>
              <Link to={i.link}>
                Ver em {i.tipo === 'Documento' ? 'Documentos' : i.tipo === 'Correspondência' ? 'Correspondências' : 'Actas'}
              </Link>
            </Button>
          )}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-12 text-muted-foreground text-sm">
          Nenhum item arquivado encontrado. Documentos com status &quot;Arquivado&quot;, correspondências &quot;Arquivada&quot; e actas &quot;Arquivada&quot; aparecem aqui.
        </p>
      )}
      <DataTablePagination {...pagination.paginationProps} />
    </div>
  );
}
