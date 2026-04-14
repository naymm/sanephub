import { useEffect, useLayoutEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { ChatMessage } from '@/types/chat';
import { formatChatTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock3, Pin } from 'lucide-react';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';

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
            <div className="mt-2 space-y-1">
              {message.attachments.map(att => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'block max-w-full truncate text-xs underline',
                    isOwn ? 'text-primary-foreground/90' : 'text-primary',
                  )}
                >
                  {att.name}
                </a>
              ))}
            </div>
          )}
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
