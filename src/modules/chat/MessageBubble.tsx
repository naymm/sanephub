import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { ChatMessage } from '@/types/chat';
import { formatChatTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock3, Pin, Eye, Download } from 'lucide-react';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { officeOnlineViewerUrl } from '@/utils/officeOnlineViewer';
import { canUseMicrosoftViewerForAttachment, chatAttachmentDisplayKind } from '@/modules/chat/chatAttachmentDisplay';

interface MessageBubbleProps {
  message: ChatMessage;
  senderName: string;
  onPin: (messageId: string) => void;
  onEdit?: (message: ChatMessage) => void;
  onOpenActions?: (message: ChatMessage) => void;
}

/** Renderiza conteúdo com menções @utilizador destacadas */
function parseContent(content: string) {
  const parts = content.split(/(@[\wÀ-ÿ\s]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-medium text-primary bg-primary/10 px-1 rounded">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function MessageBubble({ message, senderName, onPin, onEdit, onOpenActions }: MessageBubbleProps) {
  const { user } = useAuth();
  const isMobile = useIsMobileViewport();
  const [preview, setPreview] = useState<{
    title: string;
    src: string;
    mode: 'office' | 'pdf' | 'image';
  } | null>(null);
  const isOwn = message.senderId === user?.id;
  const time = formatChatTime(message.createdAt);
  const pressTimerRef = useRef<number | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current != null) {
        window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
    };
  }, []);

  /**
   * iOS Safari: o callout/seleção (“Copiar/Traduzir/Procurar”) aparece mesmo com CSS,
   * a não ser que façamos `preventDefault` num listener NÃO-passivo.
   */
  useLayoutEffect(() => {
    if (!isMobile) return;
    const el = bubbleRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'A' || t.closest('a'))) return; // links/anexos clicáveis
      e.preventDefault();
    };
    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('contextmenu', onContextMenu as any);
    };
  }, [isMobile]);

  const statusIcon = () => {
    const cls = cn('h-3 w-3', isOwn ? 'text-primary-foreground/85' : 'text-muted-foreground/70');
    if (message.status === 'sending') return <Clock3 className={cls} />;
    if (message.status === 'read') return <CheckCheck className={cls} />;
    if (message.status === 'delivered') return <CheckCheck className={cls} />;
    return <Check className={cls} />;
  };

  return (
    <div className={cn('flex gap-1.5 md:gap-2', isOwn && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex min-w-0 flex-col gap-1',
          'max-md:max-w-[88%]',
          'md:max-w-[75%]',
          isOwn ? 'items-end' : 'items-start',
        )}
      >
        <div
          ref={bubbleRef}
          className={cn(
            'w-full rounded-[1.25rem] px-3.5 py-2.5 shadow-sm md:rounded-2xl md:px-4 md:py-2',
            isOwn
              ? 'rounded-br-md bg-[hsl(var(--primary))] text-primary-foreground md:rounded-br-md [&::selection]:bg-black/25 [&::selection]:text-primary-foreground'
              : 'rounded-bl-md bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 md:rounded-bl-md md:bg-muted [&::selection]:bg-zinc-300 dark:[&::selection]:bg-zinc-600',
            // Mobile: bloquear seleção e callout nativo (Copiar/Traduzir do iOS).
            isMobile
              ? 'select-none [-webkit-touch-callout:none] [-webkit-user-select:none] [user-select:none] [-webkit-tap-highlight-color:transparent]'
              : 'select-text',
          )}
          onContextMenu={(e) => {
            if (isMobile) return;
            if (!onOpenActions) return;
            e.preventDefault();
            onOpenActions(message);
          }}
          onDoubleClick={() => {
            if (!isOwn || !onEdit) return;
            if (isMobile) return;
            onEdit(message);
          }}
          onTouchStart={(e) => {
            if (!isMobile) return;
            if (!onOpenActions) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'A' || t.closest('a'))) return;
            // Nota: em alguns iPhones o handler React é passivo; o listener nativo acima é o “hard block”.
            if (pressTimerRef.current != null) window.clearTimeout(pressTimerRef.current);
            pressTimerRef.current = window.setTimeout(() => {
              pressTimerRef.current = null;
              onOpenActions(message);
            }, 450);
          }}
          onTouchMove={() => {
            if (pressTimerRef.current != null) {
              window.clearTimeout(pressTimerRef.current);
              pressTimerRef.current = null;
            }
          }}
          onTouchEnd={() => {
            if (pressTimerRef.current != null) {
              window.clearTimeout(pressTimerRef.current);
              pressTimerRef.current = null;
            }
          }}
        >
          {!isOwn && (
            <p className="mb-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 md:text-xs md:text-muted-foreground">
              {senderName}
            </p>
          )}
          {message.forwardedFrom && message.forwardedFrom.contentSnippet ? (
            <div
              className={cn(
                'mb-1.5 flex items-center gap-2 text-[11px] font-semibold opacity-90',
                isOwn ? 'text-primary-foreground/90' : 'text-foreground/70',
              )}
            >
              <span className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">
                Encaminhada
              </span>
              <span className={cn('truncate', isOwn ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                {message.forwardedFrom.senderName ?? 'Mensagem'}
              </span>
            </div>
          ) : null}
          {message.replyTo && message.replyTo.contentSnippet ? (
            <div
              className={cn(
                'mb-1.5 rounded-xl border border-black/10 bg-white/60 px-2.5 py-1.5 text-xs',
                isOwn
                  ? 'border-white/20 bg-white/15 text-primary-foreground/90'
                  : 'bg-background/70 text-foreground/80 dark:bg-zinc-900/25',
              )}
            >
              <div className={cn('font-semibold', isOwn ? 'text-primary-foreground/95' : 'text-foreground/90')}>
                {message.replyTo.senderName ?? 'Resposta'}
              </div>
              <div className={cn('line-clamp-2', isOwn ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                {message.replyTo.contentSnippet}
              </div>
            </div>
          ) : null}
          <p
            className={cn(
              'whitespace-pre-wrap break-words text-[15px] leading-snug md:text-sm [overflow-wrap:anywhere]',
              isOwn && 'text-primary-foreground',
            )}
          >
            {parseContent(message.content)}
          </p>
          {message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map(att => {
                const kind = chatAttachmentDisplayKind(att);
                const isOwnBubble = isOwn;
                const baseBtn =
                  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors';
                const msOk = canUseMicrosoftViewerForAttachment(att);
                return (
                  <div
                    key={att.id}
                    className={cn(
                      'rounded-xl border px-2 py-1.5',
                      isOwnBubble ? 'border-white/25 bg-black/10' : 'border-border/60 bg-background/50',
                    )}
                  >
                    <p
                      className={cn(
                        'truncate text-xs font-medium',
                        isOwnBubble ? 'text-primary-foreground' : 'text-foreground',
                      )}
                      title={att.name}
                    >
                      {att.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {kind === 'pdf' && att.url ? (
                        <button
                          type="button"
                          className={cn(baseBtn, isOwnBubble ? 'bg-white/20 hover:bg-white/30' : 'bg-muted hover:bg-muted/80')}
                          onClick={() => setPreview({ title: att.name, src: att.url, mode: 'pdf' })}
                        >
                          <Eye className="h-3 w-3" />
                          Pré-visualizar
                        </button>
                      ) : null}
                      {msOk ? (
                        <button
                          type="button"
                          className={cn(baseBtn, isOwnBubble ? 'bg-white/20 hover:bg-white/30' : 'bg-muted hover:bg-muted/80')}
                          onClick={() =>
                            setPreview({
                              title: att.name,
                              src: officeOnlineViewerUrl(att.url),
                              mode: 'office',
                            })
                          }
                        >
                          <Eye className="h-3 w-3" />
                          Pré-visualizar (Microsoft)
                        </button>
                      ) : null}
                      {att.url ? (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            baseBtn,
                            isOwnBubble ? 'bg-white/15 hover:bg-white/25' : 'bg-primary/10 text-primary hover:bg-primary/15',
                          )}
                        >
                          <Download className="h-3 w-3" />
                          Abrir / descarregar
                        </a>
                      ) : null}
                    </div>
                    {kind === 'image' && att.url ? (
                      <button
                        type="button"
                        className="mt-1 block max-w-full rounded-md p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setPreview({ title: att.name, src: att.url, mode: 'image' })}
                        aria-label="Ampliar imagem"
                      >
                        <img src={att.url} alt="" className="max-h-32 max-w-full rounded-md object-contain" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
            <DialogContent className="max-h-[90dvh] max-w-[min(100vw-1rem,56rem)] gap-0 overflow-hidden p-0">
              {preview ? (
                <>
                  <DialogHeader className="border-b px-4 py-3 text-left">
                    <DialogTitle className="truncate text-base">{preview.title}</DialogTitle>
                  </DialogHeader>
                  {preview.mode === 'image' ? (
                    <div className="flex max-h-[min(80dvh,720px)] items-center justify-center overflow-auto bg-muted/30 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.src} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 p-3">
                      {preview.mode === 'office' ? (
                        <p className="text-xs text-muted-foreground">
                          Pré-visualização com <strong>Microsoft Office Online</strong>. O ficheiro tem de estar num URL HTTPS
                          público.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Pré-visualização do PDF no browser.</p>
                      )}
                      <iframe
                        title={preview.title}
                        src={preview.src}
                        className="h-[min(75dvh,640px)] w-full rounded-md border bg-background"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                      />
                    </div>
                  )}
                </>
              ) : null}
            </DialogContent>
          </Dialog>
          {/* Desktop: hora dentro da bolha */}
          <div
            className={cn(
              'mt-1 hidden items-center gap-1 md:flex',
              isOwn ? 'justify-end' : 'justify-start',
            )}
          >
            {message.pinned && <Pin className="h-3 w-3 shrink-0 opacity-80" />}
            {message.editedAt && (
              <span className={cn('text-[10px] opacity-75', isOwn && 'text-primary-foreground/85')}>
                editado
              </span>
            )}
            <span className={cn('text-[10px] opacity-80', isOwn && 'text-primary-foreground/85')}>
              {time}
            </span>
            {isOwn && statusIcon()}
          </div>
        </div>
        {/* Mobile: hora por baixo da bolha (referência tipo WhatsApp / app moderno) */}
        <div
          className={cn(
            'flex items-center gap-1 px-1 md:hidden',
            isOwn ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          {message.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
          {message.editedAt && <span className="text-[10px] text-muted-foreground">editado</span>}
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOwn && statusIcon()}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onPin(message.id)}
        className={cn(
          'hidden shrink-0 self-center rounded-md text-muted-foreground transition-opacity hover:text-foreground md:flex',
          'min-h-0 min-w-0 items-center justify-center p-1 md:opacity-0 md:hover:opacity-100 md:focus:opacity-100',
          message.pinned && 'md:opacity-100',
        )}
        title={message.pinned ? 'Desfixar' : 'Fixar mensagem'}
        aria-label={message.pinned ? 'Desfixar mensagem' : 'Fixar mensagem'}
      >
        <Pin className={cn('h-4 w-4', message.pinned && 'fill-current')} />
      </button>
    </div>
  );
}
