import { useState, useMemo } from 'react';
import { formatDate } from '@/utils/formatters';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { gerarPdfDespacho } from '@/utils/despachoPdf';

export default function AssinaturaActosPage() {
  const { documentosOficiais, colaboradoresTodos, empresas, updateDocumentoOficial } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const actos = useMemo(
    () =>
      documentosOficiais
        .filter(d => d.tipo === 'Despacho' && !d.pcaAssinado && d.status !== 'Arquivado')
        .map(d => ({
          id: d.id,
          designacao: d.titulo,
          dataSubmissao: d.data,
          tipo: d.despachoTipo ?? 'Despacho',
        })),
    [documentosOficiais]
  );

  const filtered = actos.filter(
    a =>
      a.designacao.toLowerCase().includes(search.toLowerCase()) ||
      String(a.tipo).toLowerCase().includes(search.toLowerCase())
  );
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const assinar = async (id: number) => {
    if (!user) {
      toast.error('Sessão expirada. Volte a entrar.');
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const doc = documentosOficiais.find(d => d.id === id);
    if (!doc) {
      toast.error('Despacho não encontrado.');
      return;
    }
    try {
      const updated = await updateDocumentoOficial(id, {
        pcaAssinado: true,
        pcaAssinadoEm: hoje,
        pcaAssinadoPor: user.assinaturaLinha || user.nome,
        pcaAssinaturaCargo: user.assinaturaCargo || user.cargo,
        pcaAssinaturaImagemUrl: user.assinaturaImagemUrl ?? null,
      });
      const colaborador = updated.colaboradorId != null
        ? colaboradoresTodos.find(c => c.id === updated.colaboradorId) ?? null
        : null;
      const empresaNome =
        updated.empresaId != null
          ? empresas.find(e => e.id === updated.empresaId)?.nome
          : undefined;
      await gerarPdfDespacho(updated, colaborador, {
        linha: user.assinaturaLinha || user.nome,
        cargo: user.assinaturaCargo || user.cargo,
        imagemUrl: user.assinaturaImagemUrl,
      }, empresaNome);
      toast.success('Despacho assinado e PDF gerado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível registar a assinatura.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Assinatura Digital de Actos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Actos administrativos submetidos para assinatura do PCA.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Input placeholder="Pesquisar acto..." value={search} onChange={e => setSearch(e.target.value)} className="h-9" />
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data submissão</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Designação</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acção</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(a => (
              <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 text-muted-foreground">{formatDate(a.dataSubmissao)}</td>
                <td className="py-3 px-5 font-medium">{a.designacao}</td>
                <td className="py-3 px-5 text-muted-foreground">{a.tipo}</td>
                <td className="py-3 px-5 text-right">
                  <Button size="sm" onClick={() => assinar(a.id)} className="gap-1">
                    <PenLine className="h-3.5 w-3.5" />
                    Assinar digitalmente
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum acto pendente de assinatura.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />
    </div>
  );
}
