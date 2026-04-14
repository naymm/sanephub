import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { formatChatTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageCircle, Users, Search, Mic, MoreVertical } from 'lucide-react';
import { conversaSoEntreColaboradores } from '@/utils/chatColaboradores';
import { userAvatarFallbackLabel, userAvatarImageSrc } from '@/utils/userAvatar';
import type { Usuario } from '@/types';

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}

type StoryChip = {
  conversationId: string;
  name: string;
  photoUrl?: string;
  fallback: string;
  isGroup: boolean;
};

export function ConversationList({ selectedId, onSelect, onNewConversation }: ConversationListProps) {
  const { user, usuarios } = useAuth();
  const { conversations, getConversationDisplayName, getLastMessage, getUnreadCount } = useChat();
  const [listQuery, setListQuery] = useState('');

  const myConversations = conversations.filter(
    c =>
      c.participantIds.includes(user?.id ?? 0) && conversaSoEntreColaboradores(c.participantIds, usuarios),
  );

  const sortedConversations = useMemo(() => {
    const copy = [...myConversations];
    copy.sort((a, b) => {
      const la = getLastMessage(a.id);
      const lb = getLastMessage(b.id);
      const ta = la?.createdAt ? new Date(la.createdAt).getTime() : new Date(a.createdAt).getTime();
      const tb = lb?.createdAt ? new Date(lb.createdAt).getTime() : new Date(b.createdAt).getTime();
      return tb - ta;
    });
    return copy;
  }, [myConversations, getLastMessage]);

  const filteredConversations = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return sortedConversations;
    return sortedConversations.filter(c => {
      const title = getConversationDisplayName(c).toLowerCase();
      const last = getLastMessage(c.id);
      const lastText = (last?.content ?? '').toLowerCase();
      return title.includes(q) || lastText.includes(q);
    });
  }, [sortedConversations, listQuery, getConversationDisplayName, getLastMessage]);

  const storyChips: StoryChip[] = useMemo(() => {
    const out: StoryChip[] = [];
    for (const c of sortedConversations.slice(0, 14)) {
      if (c.type === 'group') {
        out.push({
          conversationId: c.id,
          name: getConversationDisplayName(c).split(/\s+/).slice(0, 2).join(' ') || 'Grupo',
          fallback: 'GP',
          isGroup: true,
        });
      } else {
        const otherId = c.participantIds.find(id => id !== user?.id);
        const u = usuarios.find(x => x.id === otherId) as Usuario | undefined;
        const first = u?.nome?.trim().split(/\s+/)[0] ?? '?';
        out.push({
          conversationId: c.id,
          name: first,
          photoUrl: u ? userAvatarImageSrc(u) : undefined,
          fallback: userAvatarFallbackLabel(u ?? null),
          isGroup: false,
        });
      }
    }
    return out;
  }, [sortedConversations, user?.id, usuarios, getConversationDisplayName]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAFA] md:border-border md:bg-muted/20 md:border-r">
      {/* Mobile: cabeçalho estilo app */}
      <div className="shrink-0 space-y-3 border-b border-zinc-200/80 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] md:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-11 w-11 border border-zinc-100 shadow-sm">
              {user && userAvatarImageSrc(user) ? (
                <AvatarImage src={userAvatarImageSrc(user)!} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                {userAvatarFallbackLabel(user)}
              </AvatarFallback>
            </Avatar>
            <h1 className="truncate text-lg font-bold tracking-tight text-zinc-900">Mensagens</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100"
                aria-label="Menu"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onNewConversation}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Nova conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Pesquisar conversas…"
            value={listQuery}
            onChange={e => setListQuery(e.target.value)}
            className="h-11 rounded-full border-0 bg-zinc-100 pl-10 pr-11 text-[15px] shadow-inner placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-primary/25"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-600"
            aria-label="Pesquisa por voz (brevemente)"
            disabled
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
        {storyChips.length > 0 ? (
          <div className="-mx-1 flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain pb-1 pt-0.5 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {storyChips.map(s => (
              <button
                key={s.conversationId}
                type="button"
                onClick={() => onSelect(s.conversationId)}
                className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
              >
                <div className="relative">
                  <Avatar className="h-16 w-16 border-[3px] border-white shadow-md ring-1 ring-zinc-100">
                    {s.photoUrl ? <AvatarImage src={s.photoUrl} alt="" className="object-cover" /> : null}
                    <AvatarFallback
                      className={cn(
                        'text-sm font-semibold',
                        s.isGroup ? 'bg-amber-100 text-amber-800' : 'bg-primary/15 text-primary',
                      )}
                    >
                      {s.isGroup ? <Users className="h-6 w-6" /> : s.fallback.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-[3px] ring-white"
                    aria-hidden
                  />
                </div>
                <span className="w-full truncate text-center text-[11px] font-medium text-zinc-700">
                  {s.name}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Desktop: nova conversa */}
      <div className="hidden shrink-0 border-b border-border p-3 md:block">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <MessageCircle className="h-4 w-4" />
          Nova conversa
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-2 md:space-y-0 md:p-1">
          {filteredConversations.map(c => {
            const last = getLastMessage(c.id);
            const unread = getUnreadCount(c.id);
            const isSelected = selectedId === c.id;
            const otherId = c.participantIds.find(id => id !== user?.id);
            const otherUser = otherId != null ? usuarios.find(x => x.id === otherId) : undefined;
            const photoUrl = otherUser ? userAvatarImageSrc(otherUser) : undefined;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  'flex w-full items-center gap-3 text-left transition-colors',
                  'rounded-2xl border border-zinc-100 bg-white px-3 py-3 shadow-sm',
                  'md:rounded-lg md:border-0 md:bg-transparent md:px-3 md:py-3 md:shadow-none',
                  isSelected ? 'md:bg-primary/15 md:text-primary ring-1 ring-primary/20 md:ring-0' : 'md:hover:bg-muted/60',
                  isSelected && 'max-md:ring-2 max-md:ring-primary/35',
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12 md:h-10 md:w-10">
                    {c.type === 'group' ? null : photoUrl ? (
                      <AvatarImage src={photoUrl} alt="" className="object-cover" />
                    ) : null}
                    <AvatarFallback
                      className={cn(
                        'text-sm md:text-sm',
                        c.type === 'group' ? 'bg-primary/20 text-primary' : 'bg-primary/20 text-primary',
                      )}
                    >
                      {c.type === 'group' ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        userAvatarFallbackLabel(otherUser ?? null)
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white md:hidden"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-semibold text-zinc-900 md:font-medium md:text-foreground">
                      {getConversationDisplayName(c)}
                    </span>
                    {last && (
                      <span className="shrink-0 text-[11px] text-zinc-400 md:text-[10px] md:text-muted-foreground">
                        {formatChatTime(last.createdAt)}
                      </span>
                    )}
                  </div>
                  {last && (
                    <p className="truncate text-[13px] text-zinc-500 md:text-xs md:text-muted-foreground">
                      {last.senderId === user?.id ? 'Tu: ' : ''}
                      {last.content.slice(0, 48)}
                      {last.content.length > 48 ? '…' : ''}
                    </p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="flex h-6 min-w-[22px] shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1.5 text-[11px] font-semibold text-primary-foreground">
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
