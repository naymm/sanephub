import { useAuth } from '@/context/AuthContext';
import type { ChatMessage } from '@/types/chat';
import { formatChatTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Pin } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
  senderName: string;
  onPin: (messageId: string) => void;
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

export function MessageBubble({ message, senderName, onPin }: MessageBubbleProps) {
  const { user } = useAuth();
  const isOwn = message.senderId === user?.id;
  const time = formatChatTime(message.createdAt);

  const statusIcon = () => {
    if (message.status === 'read') return <CheckCheck className="h-3 w-3 text-[hsl(var(--primary))]" />;
    if (message.status === 'delivered')
      return <CheckCheck className="h-3 w-3 text-muted-foreground/70" />;
    return <Check className="h-3 w-3 text-muted-foreground/70" />;
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
          className={cn(
            'w-full select-text rounded-[1.25rem] px-3.5 py-2.5 shadow-sm md:rounded-2xl md:px-4 md:py-2',
            isOwn
              ? 'rounded-br-md bg-[hsl(var(--primary))] text-primary-foreground md:rounded-br-md [&::selection]:bg-black/25 [&::selection]:text-primary-foreground'
              : 'rounded-bl-md bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 md:rounded-bl-md md:bg-muted [&::selection]:bg-zinc-300 dark:[&::selection]:bg-zinc-600',
          )}
        >
          {!isOwn && (
            <p className="mb-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 md:text-xs md:text-muted-foreground">
              {senderName}
            </p>
          )}
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
