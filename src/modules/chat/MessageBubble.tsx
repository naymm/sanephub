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

  const statusIcon = () => {
    if (message.status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-primary" />;
    if (message.status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
    return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2 shadow-sm',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted rounded-bl-md'
        )}
      >
        {!isOwn && (
          <p className="text-xs font-medium text-muted-foreground mb-0.5">{senderName}</p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{parseContent(message.content)}</p>
        {message.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map(att => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'block text-xs underline truncate max-w-full',
                  isOwn ? 'text-primary-foreground/90' : 'text-primary'
                )}
              >
                {att.name}
              </a>
            ))}
          </div>
        )}
        <div className={cn('flex items-center gap-1.5 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
          {message.pinned && <Pin className="h-3 w-3 shrink-0" />}
          <span className="text-[10px] opacity-80">{formatChatTime(message.createdAt)}</span>
          {isOwn && statusIcon()}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onPin(message.id)}
        className="shrink-0 self-center p-1 rounded opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        title={message.pinned ? 'Desfixar' : 'Fixar mensagem'}
      >
        <Pin className={cn('h-4 w-4', message.pinned && 'fill-current')} />
      </button>
    </div>
  );
}
