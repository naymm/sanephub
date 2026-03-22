import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const OFFICE_EMBED_BASE = 'https://view.officeapps.live.com/op/embed.aspx';

function officeEmbedUrl(publicFileUrl: string): string {
  return `${OFFICE_EMBED_BASE}?src=${encodeURIComponent(publicFileUrl)}`;
}

/** Máximo de linhas por folha na pré-visualização local (evita bloquear o browser). */
const MAX_ROWS_PER_SHEET = 800;

type ExcelPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storagePath: string | null;
  bucket: string;
  fileUrl: string | null;
  titulo: string;
  nomeDownload: string;
};

async function blobFromSources(
  storagePath: string | null,
  bucket: string,
  fileUrl: string | null,
): Promise<Blob> {
  if (supabase && storagePath) {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (!error && data) return data;
    if (fileUrl) {
      const res = await fetch(fileUrl, { mode: 'cors', credentials: 'omit' });
      if (res.ok) return res.blob();
    }
    if (error) throw new Error(error.message);
    throw new Error('Não foi possível descarregar o ficheiro.');
  }
  if (fileUrl) {
    const res = await fetch(fileUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`Não foi possível obter o ficheiro (HTTP ${res.status}).`);
    return res.blob();
  }
  throw new Error('Sem caminho de ficheiro.');
}

type SheetPreview = {
  name: string;
  rows: string[][];
  truncated: boolean;
};

function parseWorkbook(buf: ArrayBuffer): SheetPreview[] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const out: SheetPreview[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    const rows: string[][] = raw.map(row =>
      (Array.isArray(row) ? row : []).map(cell => {
        if (cell == null || cell === '') return '';
        if (typeof cell === 'string') return cell;
        if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
        if (cell instanceof Date) return cell.toLocaleString('pt-PT');
        return String(cell);
      }),
    );
    const truncated = rows.length > MAX_ROWS_PER_SHEET;
    out.push({
      name,
      rows: truncated ? rows.slice(0, MAX_ROWS_PER_SHEET) : rows,
      truncated,
    });
  }

  return out;
}

type PreviewMode = 'office' | 'table';

export function ExcelPreviewDialog({
  open,
  onOpenChange,
  storagePath,
  bucket,
  fileUrl,
  titulo,
  nomeDownload,
}: ExcelPreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sheets, setSheets] = useState<SheetPreview[]>([]);

  const canUseOfficeEmbed = Boolean(fileUrl && /^https:\/\//i.test(fileUrl));
  const [previewMode, setPreviewMode] = useState<PreviewMode>('office');

  useEffect(() => {
    if (!open) return;
    setPreviewMode(canUseOfficeEmbed ? 'office' : 'table');
    setError(null);
  }, [open, canUseOfficeEmbed]);

  useEffect(() => {
    if (!open || previewMode !== 'table') {
      if (!open) {
        setSheets([]);
        setLoading(false);
      }
      return;
    }
    if (!storagePath && !fileUrl) {
      setError('Sem ficheiro para mostrar.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSheets([]);

    void (async () => {
      try {
        const blob = await blobFromSources(storagePath, bucket, fileUrl);
        if (cancelled) return;
        const buf = await blob.arrayBuffer();
        if (cancelled) return;
        const parsed = parseWorkbook(buf);
        if (cancelled) return;
        if (parsed.length === 0) {
          setError('O livro não tem folhas legíveis.');
          return;
        }
        setSheets(parsed);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao ler o Excel.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, previewMode, storagePath, bucket, fileUrl]);

  const showOffice = canUseOfficeEmbed && previewMode === 'office';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0',
          showOffice ? 'h-[95vh] max-w-[90vw] w-full sm:max-w-[90vw]' : 'max-w-[90vw] w-full sm:max-w-[90vw]',
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 px-6 pt-6 pb-2">
          <DialogTitle className="line-clamp-2 pr-8">{titulo || 'Folha de cálculo'}</DialogTitle>
          {showOffice ? (
            <DialogDescription className="text-xs leading-relaxed">
              Pré-visualização com <strong>Microsoft Office Online</strong> (próximo do Excel). O ficheiro é carregado a
              partir de um URL público HTTPS. Pode alternar para a vista em tabela se preferir.
            </DialogDescription>
          ) : (
            <DialogDescription className="text-xs leading-relaxed">
              Pré-visualização em <strong>tabela</strong> (folhas e células). Útil sem URL público ou offline; ficheiros
              muito grandes são truncados ({MAX_ROWS_PER_SHEET} linhas por folha).
            </DialogDescription>
          )}
        </DialogHeader>

        {canUseOfficeEmbed ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-6 py-2">
            <Button
              type="button"
              size="sm"
              variant={previewMode === 'office' ? 'secondary' : 'ghost'}
              onClick={() => setPreviewMode('office')}
            >
              Excel (Office Online)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewMode === 'table' ? 'secondary' : 'ghost'}
              onClick={() => setPreviewMode('table')}
            >
              Tabelas no browser
            </Button>
          </div>
        ) : null}

        {showOffice && fileUrl ? (
          <div className="flex min-h-0 flex-1 flex-col px-0 pb-0">
            <iframe
              key={fileUrl}
              title="Pré-visualização Excel (Office Online)"
              src={officeEmbedUrl(fileUrl)}
              className="h-[min(78vh,800px)] w-full flex-1 border-0 bg-muted/20"
              allow="fullscreen"
            />
          </div>
        ) : (
          <div className="relative flex min-h-[min(60vh,520px)] flex-1 flex-col px-6 pb-2">
            {loading ? (
              <div className="absolute inset-x-6 inset-y-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md border border-border/60 bg-background/90">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">A ler folha de cálculo…</span>
              </div>
            ) : null}
            {error ? (
              <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {!loading && !error && sheets.length > 0 ? (
              sheets.length === 1 ? (
                <ScrollArea className="h-[min(60vh,560px)] w-full rounded-md border border-border/60">
                  <SheetTable sheet={sheets[0]} />
                </ScrollArea>
              ) : (
                <Tabs defaultValue="0" className="flex min-h-0 flex-1 flex-col gap-2">
                  <TabsList className="h-auto max-h-24 w-full flex-wrap justify-start gap-1 overflow-y-auto">
                    {sheets.map((s, i) => (
                      <TabsTrigger key={i} value={String(i)} className="max-w-[200px] shrink-0 truncate text-xs">
                        {s.name || `Folha ${i + 1}`}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {sheets.map((s, i) => (
                    <TabsContent key={i} value={String(i)} className="mt-0 min-h-0 flex-1 overflow-hidden">
                      <ScrollArea className="h-[min(56vh,520px)] w-full rounded-md border border-border/60">
                        <SheetTable sheet={s} />
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </Tabs>
              )
            ) : null}
          </div>
        )}

        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={downloading || (!storagePath && !fileUrl)}
            onClick={() => {
              void (async () => {
                if (!nomeDownload.trim()) {
                  toast.error('Nome de ficheiro inválido.');
                  return;
                }
                setDownloading(true);
                try {
                  const blob = await blobFromSources(storagePath, bucket, fileUrl);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = nomeDownload.trim();
                  a.rel = 'noopener';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Não foi possível descarregar.');
                } finally {
                  setDownloading(false);
                }
              })();
            }}
          >
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A descarregar…
              </>
            ) : (
              'Descarregar'
            )}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SheetTable({ sheet }: { sheet: SheetPreview }) {
  const { rows, truncated, name } = sheet;
  if (rows.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Folha «{name}» vazia ou sem dados legíveis.
      </p>
    );
  }
  const colCount = Math.max(...rows.map(r => r.length), 0);

  return (
    <div className="p-2">
      {truncated ? (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
          A mostrar apenas as primeiras {MAX_ROWS_PER_SHEET} linhas desta folha.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-collapse border border-border text-left text-xs">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/60 hover:bg-muted/30">
                {Array.from({ length: colCount }, (_, ci) => (
                  <td
                    key={ci}
                    className="max-w-[min(280px,40vw)] border-r border-border/40 px-2 py-1 align-top whitespace-pre-wrap break-words"
                  >
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
