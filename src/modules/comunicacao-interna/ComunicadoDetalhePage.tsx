import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Paperclip, ScrollText } from 'lucide-react';
import { useData } from '@/context/DataContext';
import type { Comunicado } from '@/types';

import { Button } from '@/components/ui/button';
import { normalizePublicMediaUrl } from '@/utils/publicMediaUrl';
import { labelComunicadoTipo } from '@/modules/comunicacao-interna/comunicadoTipo';
import { comunicadoConteudoIsHtml, sanitizeComunicadoHtml } from '@/modules/comunicacao-interna/comunicadoConteudoHtml';

export default function ComunicadoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const comunicadoId = id ? Number(id) : null;

  const { comunicados } = useData();

  const comunicado: Comunicado | undefined = useMemo(() => {
    if (comunicadoId == null) return undefined;
    return comunicados.find(c => c.id === comunicadoId);
  }, [comunicadoId, comunicados]);

  if (!comunicadoId) return null;

  if (!comunicado) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/comunicacao-interna/comunicados')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Comunicado não encontrado.</p>
      </div>
    );
  }

  const hrefAnexo = comunicado.anexoUrl ? normalizePublicMediaUrl(comunicado.anexoUrl) ?? comunicado.anexoUrl : null;
  const conteudoSanitizado =
    comunicado.conteudo && comunicadoConteudoIsHtml(comunicado.conteudo)
      ? sanitizeComunicadoHtml(comunicado.conteudo)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate('/comunicacao-interna/comunicados')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <span className="text-xs px-2 py-1 rounded-full border border-primary/40 text-primary">
          {labelComunicadoTipo(comunicado.tipo)}
        </span>
      </div>

      <div className="bg-card border border-border/80 rounded-xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <h1 className="page-header">{comunicado.titulo}</h1>
          </div>

          <div className="text-sm text-muted-foreground">
            Publicado em {new Date(comunicado.publicadoEm).toLocaleString('pt-PT')}
          </div>

          {comunicado.resumo ? <p className="text-sm font-medium text-foreground/90">{comunicado.resumo}</p> : null}

          {conteudoSanitizado != null ? (
            <div
              className="comunicado-tiptap prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: conteudoSanitizado }}
            />
          ) : comunicado.conteudo ? (
            <div className="whitespace-pre-wrap text-sm">{comunicado.conteudo}</div>
          ) : null}

          {hrefAnexo && (
            <div className="pt-2 border-t border-border/60">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Documento em anexo</p>
              <a
                href={hrefAnexo}
                target="_blank"
                rel="noopener noreferrer"
                download={comunicado.anexoNome ?? undefined}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="break-all">{comunicado.anexoNome || 'Descarregar anexo'}</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
