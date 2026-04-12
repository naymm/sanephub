import { useState, useMemo } from 'react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AssinaturaActosPage() {
  const { documentosOficiais, colaboradoresTodos, empresas, updateDocumentoOficial } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [canSign, setCanSign] = useState(false);

  const actosPendentes = useMemo(
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

  const actesAssinados = useMemo(
    () =>
      documentosOficiais
        .filter(d => d.tipo === 'Despacho' && d.pcaAssinado && d.status !== 'Arquivado')
        .map(d => ({
          id: d.id,
          designacao: d.titulo,
          dataAssinatura: d.pcaAssinadoEm ?? d.data,
          tipo: d.despachoTipo ?? 'Despacho',
        })),
    [documentosOficiais]
  );

  const filteredPendentes = actosPendentes.filter(
    a =>
      a.designacao.toLowerCase().includes(search.toLowerCase()) ||
      String(a.tipo).toLowerCase().includes(search.toLowerCase())
  );
  const filteredAssinados = actesAssinados.filter(
    a =>
      a.designacao.toLowerCase().includes(search.toLowerCase()) ||
      String(a.tipo).toLowerCase().includes(search.toLowerCase())
  );

  const paginationPendentes = useClientSidePagination({ items: filteredPendentes, pageSize: 25 });
  const paginationAssinados = useClientSidePagination({ items: filteredAssinados, pageSize: 25 });

  type ActoPendRow = (typeof actosPendentes)[number];
  type ActoAssRow = (typeof actesAssinados)[number];

  const { sortState: mobileSortPend, toggleSort: toggleMobileSortPend } = useMobileListSort('designacao');
  const mobileCompPend = useMemo(
    () => ({
      designacao: (a: ActoPendRow, b: ActoPendRow) => a.designacao.localeCompare(b.designacao, 'pt', { sensitivity: 'base' }),
      dataSubmissao: (a: ActoPendRow, b: ActoPendRow) => a.dataSubmissao.localeCompare(b.dataSubmissao),
      tipo: (a: ActoPendRow, b: ActoPendRow) => String(a.tipo).localeCompare(String(b.tipo), 'pt', { sensitivity: 'base' }),
    }),
    [],
  );
  const sortedMobilePendentes = useSortedMobileSlice(paginationPendentes.slice, mobileSortPend, mobileCompPend);

  const { sortState: mobileSortAss, toggleSort: toggleMobileSortAss } = useMobileListSort('designacao');
  const mobileCompAss = useMemo(
    () => ({
      designacao: (a: ActoAssRow, b: ActoAssRow) => a.designacao.localeCompare(b.designacao, 'pt', { sensitivity: 'base' }),
      dataAssinatura: (a: ActoAssRow, b: ActoAssRow) => String(a.dataAssinatura).localeCompare(String(b.dataAssinatura)),
      tipo: (a: ActoAssRow, b: ActoAssRow) => String(a.tipo).localeCompare(String(b.tipo), 'pt', { sensitivity: 'base' }),
    }),
    [],
  );
  const sortedMobileAssinados = useSortedMobileSlice(paginationAssinados.slice, mobileSortAss, mobileCompAss);

  const abrirPreviewAssinado = async (id: number) => {
    if (!user) {
      toast.error('Sessão expirada. Volte a entrar.');
      return;
    }
    const doc = documentosOficiais.find(d => d.id === id);
    if (!doc) {
      toast.error('Despacho não encontrado.');
      return;
    }
    try {
      const colaborador = doc.colaboradorId != null
        ? colaboradoresTodos.find(c => c.id === doc.colaboradorId) ?? null
        : null;
      const empresaNome =
        doc.empresaId != null
          ? empresas.find(e => e.id === doc.empresaId)?.nome
          : undefined;
      // Para actos já assinados, o preview deve incluir a assinatura digital gravada no documento
      const blobUrl = await gerarPdfDespacho(
        doc,
        colaborador,
        {
          linha: doc.pcaAssinadoPor ?? user.assinaturaLinha ?? user.nome,
          cargo: doc.pcaAssinaturaCargo ?? user.assinaturaCargo ?? user.cargo,
          imagemUrl: doc.pcaAssinaturaImagemUrl ?? user.assinaturaImagemUrl ?? undefined,
        },
        empresaNome
      );
      setPreviewId(id);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
      setCanSign(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar a pré-visualização do despacho assinado.');
    }
  };

  const abrirPreview = async (id: number) => {
    if (!user) {
      toast.error('Sessão expirada. Volte a entrar.');
      return;
    }
    const doc = documentosOficiais.find(d => d.id === id);
    if (!doc) {
      toast.error('Despacho não encontrado.');
      return;
    }
    try {
      const colaborador = doc.colaboradorId != null
        ? colaboradoresTodos.find(c => c.id === doc.colaboradorId) ?? null
        : null;
      const empresaNome =
        doc.empresaId != null
          ? empresas.find(e => e.id === doc.empresaId)?.nome
          : undefined;
      // Pré-visualização para o PCA NÃO deve incluir a assinatura digital
      const blobUrl = await gerarPdfDespacho(doc, colaborador, null, empresaNome);
      setPreviewId(id);
      setPreviewUrl(blobUrl);
      setPreviewOpen(true);
      setCanSign(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar a pré-visualização do despacho.');
    }
  };

  const assinar = async () => {
    if (!user) {
      toast.error('Sessão expirada. Volte a entrar.');
      return;
    }
    if (previewId == null) {
      toast.error('Nenhum despacho seleccionado para assinatura.');
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const doc = documentosOficiais.find(d => d.id === previewId);
    if (!doc) {
      toast.error('Despacho não encontrado.');
      return;
    }
    try {
      const updated = await updateDocumentoOficial(previewId, {
        pcaAssinado: true,
        pcaAssinadoEm: hoje,
        pcaAssinadoPor: user.assinaturaLinha || user.nome,
        pcaAssinaturaCargo: user.assinaturaCargo || user.cargo,
        pcaAssinaturaImagemUrl: user.assinaturaImagemUrl ?? null,
        status: 'Assinado',
      });
      setPreviewOpen(false);
      setPreviewId(null);
      setPreviewUrl(null);
      toast.success('Despacho assinado com sucesso.');
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

      <div className="hidden md:block table-container overflow-x-auto">
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
            {paginationPendentes.slice.map(a => (
              <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 text-muted-foreground">{formatDate(a.dataSubmissao)}</td>
                <td className="py-3 px-5 font-medium">{a.designacao}</td>
                <td className="py-3 px-5 text-muted-foreground">{a.tipo}</td>
                <td className="py-3 px-5 text-right">
                  <Button size="sm" onClick={() => abrirPreview(a.id)} className="gap-1">
                    <PenLine className="h-3.5 w-3.5" />
                    Ver PDF e assinar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobilePendentes}
          rowId={a => a.id}
          sortBar={{
            options: [
              { key: 'designacao', label: 'Designação' },
              { key: 'dataSubmissao', label: 'Data' },
              { key: 'tipo', label: 'Tipo' },
            ],
            state: mobileSortPend,
            onToggle: toggleMobileSortPend,
          }}
          renderSummary={a => ({ title: a.designacao })}
          renderDetails={a => [
            { label: 'Data submissão', value: formatDate(a.dataSubmissao) },
            { label: 'Tipo', value: a.tipo },
          ]}
          renderActions={a => (
            <Button type="button" size="sm" className="min-h-11 gap-1" onClick={() => abrirPreview(a.id)}>
              <PenLine className="h-3.5 w-3.5" />
              Ver PDF e assinar
            </Button>
          )}
        />
      </div>

      {filteredPendentes.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum acto pendente de assinatura.</p>
      )}
      <DataTablePagination {...paginationPendentes.paginationProps} />

      <div className="space-y-2 mt-10">
        <h2 className="text-sm font-semibold text-muted-foreground">Actos já assinados</h2>
        <div className="hidden md:block table-container overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/80">
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data assinatura</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Designação</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acção</th>
              </tr>
            </thead>
            <tbody>
              {paginationAssinados.slice.map(a => (
                <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-5 text-muted-foreground">{formatDate(a.dataAssinatura)}</td>
                  <td className="py-3 px-5 font-medium">{a.designacao}</td>
                  <td className="py-3 px-5 text-muted-foreground">{a.tipo}</td>
                  <td className="py-3 px-5 text-right">
                    <Button size="sm" variant="outline" onClick={() => abrirPreviewAssinado(a.id)} className="gap-1">
                      Ver PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden">
          <MobileExpandableList
            items={sortedMobileAssinados}
            rowId={a => a.id}
            sortBar={{
              options: [
                { key: 'designacao', label: 'Designação' },
                { key: 'dataAssinatura', label: 'Assinatura' },
                { key: 'tipo', label: 'Tipo' },
              ],
              state: mobileSortAss,
              onToggle: toggleMobileSortAss,
            }}
            renderSummary={a => ({ title: a.designacao })}
            renderDetails={a => [
              { label: 'Data assinatura', value: formatDate(a.dataAssinatura) },
              { label: 'Tipo', value: a.tipo },
            ]}
            renderActions={a => (
              <Button type="button" size="sm" variant="outline" className="min-h-11 gap-1" onClick={() => abrirPreviewAssinado(a.id)}>
                Ver PDF
              </Button>
            )}
          />
        </div>
        {filteredAssinados.length === 0 && (
          <p className="text-center py-6 text-muted-foreground text-xs">Nenhum acto assinado encontrado.</p>
        )}
        <DataTablePagination {...paginationAssinados.paginationProps} />
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={open => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewUrl(null);
            setPreviewId(null);
            setCanSign(false);
          }
        }}
      >
        <DialogContent className="max-w-[90vw] w-full h-[95vh] p-0">
          {previewUrl ? (
            <>
              <DialogHeader className="px-4 pt-4">
                <DialogTitle>
                  {canSign ? 'Pré-visualização do Despacho para assinatura' : 'Pré-visualização do Despacho assinado'}
                </DialogTitle>
              </DialogHeader>
              <div className="w-full h-[calc(95vh-4rem)] flex flex-col">
                <div className="flex-1">
                  <iframe
                    src={previewUrl}
                    title="Pré-visualização do despacho"
                    className="w-full h-full border-0 rounded-md"
                  />
                </div>
                <div className="p-4 border-t flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                    Fechar
                  </Button>
                  {canSign && (
                    <Button onClick={assinar} className="gap-1">
                      <PenLine className="h-3.5 w-3.5" />
                      Assinar digitalmente
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <DialogHeader className="px-4 py-6">
              <DialogTitle>A carregar pré-visualização...</DialogTitle>
            </DialogHeader>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
