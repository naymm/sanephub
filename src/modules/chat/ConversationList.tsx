import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { formatChatTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Users } from 'lucide-react';
import { conversaSoEntreColaboradores } from '@/utils/chatColaboradores';

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationList({ selectedId, onSelect, onNewConversation }: ConversationListProps) {
  const { user, usuarios } = useAuth();
  const {
    conversations,
    getConversationDisplayName,
    getLastMessage,
    getUnreadCount,
  } = useChat();

  const myConversations = conversations.filter(
    c =>
      c.participantIds.includes(user?.id ?? 0) && conversaSoEntreColaboradores(c.participantIds, usuarios),
  );

  return (
    <div className="flex h-full flex-col border-border bg-muted/20 md:border-r">
      <div className="shrink-0 border-b border-border p-3">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <MessageCircle className="h-4 w-4" />
          Nova conversa
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1">
          {myConversations.map(c => {
            const last = getLastMessage(c.id);
            const unread = getUnreadCount(c.id);
            const isSelected = selectedId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors',
                  isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-muted/60',
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {c.type === 'group' ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      (() => {
                        const otherId = c.participantIds.find(id => id !== user?.id);
                        const u = usuarios.find(x => x.id === otherId);
                        return u?.avatar?.slice(0, 2) ?? '?';
                      })()
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium truncate">{getConversationDisplayName(c)}</span>
                    {last && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatChatTime(last.createdAt)}
                      </span>
                    )}
                  </div>
                  {last && (
                    <p className="text-xs text-muted-foreground truncate">
                      {last.senderId === user?.id ? 'Tu: ' : ''}
                      {last.content.slice(0, 40)}
                      {last.content.length > 40 ? '...' : ''}
                    </p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="shrink-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground px-1.5">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
