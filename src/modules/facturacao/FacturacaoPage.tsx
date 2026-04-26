import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowsFromDb } from '@/lib/supabaseMappers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { PdfPreviewDialog } from '@/components/PdfPreviewDialog';
import { pdfPreviewUrlFromGeneratedBlob, releasePdfPreviewUrl } from '@/utils/pdfPreviewPublicUrl';
import { generateFacturaPdfBlob, type FacturaLinhaPdf } from '@/utils/facturaPdf';

type FacturaRow = {
  id: number;
  empresaId?: number | null;
  idFactura?: string | null;
  numFactura?: number | null;
  tipo?: string | null;
  serie?: number | null;
  cliente?: string | null;
  nif?: string | null;
  totalFactura?: string | null;
  totalIva?: string | null;
  totaMerc?: string | null;
  ultimaActualizacao?: string | null;
  createdAt?: string | null;
};

type ProdutoRow = {
  id: number;
  idFactura?: string | null;
  numLinha?: number | null;
  codArtigo?: string | null;
  descricao?: string | null;
  quantidade?: string | null;
  preco?: string | null;
  totalLiquido?: string | null;
  totalIva?: string | null;
  taxaIva?: string | null;
};

function fmtDataPt(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('pt-PT');
}

function tituloReferencia(f: FacturaRow): string {
  const idf = (f.idFactura ?? '').trim();
  if (idf) return idf;
  const s = f.serie != null ? String(f.serie) : '';
  const n = f.numFactura != null ? String(f.numFactura) : '';
  if (s || n) return [s, n].filter(Boolean).join(' / ');
  return `ID ${f.id}`;
}

export default function FacturacaoPage() {
  const { empresas } = useData();
  const { currentEmpresaId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FacturaRow[]>([]);
  const [debugHint, setDebugHint] = useState<string>('');
  const [search, setSearch] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const empresaActiva = useMemo(() => {
    if (currentEmpresaId === 'consolidado') return undefined;
    return empresas.find(e => e.id === currentEmpresaId);
  }, [currentEmpresaId, empresas]);

  const empresaLabel = useMemo(() => {
    if (currentEmpresaId === 'consolidado') return 'Grupo (consolidado)';
    return empresaActiva?.codigo ?? 'Empresa';
  }, [currentEmpresaId, empresaActiva]);

  const refetch = async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      let q = supabase.from('factura').select('*').order('created_at', { ascending: false }).limit(500);
      if (currentEmpresaId !== 'consolidado') {
        q = q.eq('empresa_id', currentEmpresaId);
      }
      const { data, error } = await q;
      if (error) throw error;
      const mapped = mapRowsFromDb<FacturaRow>('factura', (data ?? []) as Record<string, unknown>[]);
      setRows(mapped);
      setDebugHint('');

      if (currentEmpresaId !== 'consolidado' && mapped.length === 0) {
        const { data: mini, error: miniErr } = await supabase
          .from('factura')
          .select('empresa_id, id_factura, num_factura')
          .order('created_at', { ascending: false })
          .limit(60);
        if (!miniErr && Array.isArray(mini) && mini.length > 0) {
          const ids = [...new Set(mini.map((r: { empresa_id?: number | null }) => r.empresa_id).filter(v => v != null))].slice(
            0,
            8,
          ) as number[];
          const idsTxt = ids.length ? ids.join(', ') : '—';
          setDebugHint(
            `Sem facturas para empresa_id=${currentEmpresaId}. Existem facturas noutras empresas_id (ex.: ${idsTxt}). ` +
              `Isto normalmente indica que o "empresa_id" do Primavera não coincide com o "id" da empresa no Hub.`,
          );
        }
      }
    } catch (e) {
      console.error('[facturacao] erro ao carregar facturas', e);
      const anyE = e as { message?: string; details?: string; hint?: string; code?: string };
      const parts = [
        anyE?.message,
        anyE?.code ? `code=${anyE.code}` : '',
        anyE?.details,
        anyE?.hint,
      ].filter(Boolean);
      toast.error(parts.length ? parts.join(' · ') : 'Erro ao carregar facturas');
      setRows([]);
      setDebugHint('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmpresaId]);

  const abrirPreviewPdf = useCallback(
    async (f: FacturaRow) => {
      if (!isSupabaseConfigured() || !supabase) {
        toast.error('Supabase não configurado.');
        return;
      }
      setPdfBusy(true);
      try {
        const idFact = (f.idFactura ?? '').trim();
        let linhasRaw: ProdutoRow[] = [];
        if (idFact) {
          const { data, error } = await supabase
            .from('produto')
            .select('*')
            .eq('id_factura', idFact)
            .order('num_linha', { ascending: true });
          if (error) throw error;
          linhasRaw = mapRowsFromDb<ProdutoRow>('produto', (data ?? []) as Record<string, unknown>[]);
        }

        const linhas: FacturaLinhaPdf[] = linhasRaw.map(p => ({
          codArtigo: (p.codArtigo ?? '').trim() || '—',
          descricao: (p.descricao ?? '').trim() || '—',
          quantidade: (p.quantidade ?? '').trim() || '—',
          un: 'UN',
          precoUnitario: (p.preco ?? '').trim() || '—',
          desconto: '0,00',
          iva: (p.totalIva ?? '').trim() || '0,00',
          valor: (p.totalLiquido ?? '').trim() || '—',
        }));

        const totMerc = (f.totaMerc ?? '').trim() || (f.totalFactura ?? '').trim() || '—';
        const totIva = (f.totalIva ?? '').trim() || '0,00';
        const totFac = (f.totalFactura ?? '').trim() || '—';

        const ivaNum = Number(String(totIva).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
        const motivo =
          Number.isFinite(ivaNum) && Math.abs(ivaNum) < 0.0001
            ? 'Transmissão de bens e serviço não sujeita'
            : null;

        const blob = generateFacturaPdfBlob({
          emitente: {
            nome: empresaActiva?.nome?.trim() || 'Empresa',
            nif: empresaActiva?.nif ?? null,
            morada: empresaActiva?.morada ?? null,
            contactoLinha: null,
          },
          referenciaDocumento: tituloReferencia(f),
          tipoDocumento: f.tipo ?? 'Factura',
          cliente: {
            nome: (f.cliente ?? '').trim() || '—',
            morada: null,
            nif: f.nif ?? null,
          },
          dataEmissao: fmtDataPt(f.createdAt ?? f.ultimaActualizacao),
          moeda: 'AKZ',
          cambio: '—',
          requisicao: null,
          descontoComercial: '0,00',
          descontoAdicional: '0,00',
          vencimento: f.ultimaActualizacao?.trim() ? f.ultimaActualizacao : null,
          condicaoPagamento: 'Factura 30 dias',
          linhas,
          totMercadoria: totMerc,
          totIva,
          totalFactura: totFac,
          motivoIsencaoIva: motivo,
          dadosBancarios: null,
        });

        const previewUrl = await pdfPreviewUrlFromGeneratedBlob(blob, 'factura');
        setPdfUrl(previewUrl);
        setPdfOpen(true);
      } catch (e) {
        console.error('[facturacao] preview pdf', e);
        toast.error(e instanceof Error ? e.message : 'Erro ao gerar PDF');
      } finally {
        setPdfBusy(false);
      }
    },
    [empresaActiva],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => {
      const a = `${r.idFactura ?? ''} ${r.numFactura ?? ''} ${r.cliente ?? ''} ${r.nif ?? ''} ${r.tipo ?? ''} ${r.serie ?? ''}`.toLowerCase();
      return a.includes(s);
    });
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <h1 className="page-header">Facturação</h1>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Empresa: <span className="font-mono">{empresaLabel}</span>
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar (cliente, NIF, nº factura, id_factura, tipo)…"
            className="sm:w-[420px]"
          />
          <Button variant="outline" onClick={refetch} disabled={loading}>
            {loading ? 'A carregar…' : 'Actualizar'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">
          {filtered.length} factura(s)
          {currentEmpresaId !== 'consolidado' ? (
            <>
              {' '}
              · filtro: <span className="font-mono">empresa_id={currentEmpresaId}</span>
            </>
          ) : null}
        </div>
        {debugHint ? <div className="border-b bg-amber-50/60 px-4 py-3 text-sm text-amber-900">{debugHint}</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-2 px-4 w-36">Nº</th>
                <th className="py-2 px-4 w-40">Série</th>
                <th className="py-2 px-4 w-40">Tipo</th>
                <th className="py-2 px-4">Cliente</th>
                <th className="py-2 px-4 w-40">NIF</th>
                <th className="py-2 px-4 w-44 text-right">Total</th>
                <th className="py-2 px-4 w-28 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-4 font-mono tabular-nums">
                    {f.numFactura != null ? f.numFactura : f.idFactura ?? '—'}
                  </td>
                  <td className="py-2 px-4 font-mono tabular-nums text-muted-foreground">{f.serie ?? '—'}</td>
                  <td className="py-2 px-4">{f.tipo ?? '—'}</td>
                  <td className="py-2 px-4">{f.cliente ?? '—'}</td>
                  <td className="py-2 px-4 font-mono tabular-nums">{f.nif ?? '—'}</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums">{f.totalFactura ?? '—'}</td>
                  <td className="py-2 px-4 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={pdfBusy}
                      onClick={() => void abrirPreviewPdf(f)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-sm text-muted-foreground">
                    Sem facturas para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PdfPreviewDialog
        open={pdfOpen}
        onOpenChange={open => {
          setPdfOpen(open);
          if (!open) {
            setPdfUrl(prev => {
              releasePdfPreviewUrl(prev);
              return null;
            });
          }
        }}
        url={pdfUrl}
        iframeTitle="Pré-visualização da factura"
        loadingText={pdfBusy ? 'A gerar PDF…' : 'A abrir…'}
      />
    </div>
  );
}
