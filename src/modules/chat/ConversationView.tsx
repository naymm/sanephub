import { useRef, useEffect, useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { ChatMobileComposerPortal } from '@/modules/chat/ChatMobileComposerPortal';
import { useAuth } from '@/context/AuthContext';
import { useChat, CHAT_PAGE_SIZE } from '@/context/ChatContext';
import type { ChatAttachment } from '@/types/chat';
import { MessageBubble } from './MessageBubble';
import { formatChatTime } from '@/utils/formatters';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Paperclip,
  Send,
  Pin,
  X,
  Users,
  FileText,
  Link2,
  UserMinus,
  Search,
  Loader2,
  ChevronLeft,
  Smile,
  ImagePlus,
  Phone,
  Video,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { userAvatarFallbackLabel, userAvatarImageSrc } from '@/utils/userAvatar';
import { Input } from '@/components/ui/input';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { useVisualViewportBottomInset } from '@/hooks/useVisualViewportBottomInset';
import { useChatTypingBroadcast } from '@/modules/chat/useChatTypingBroadcast';

interface ConversationViewProps {
  conversationId: string | null;
  /** Mobile: voltar à lista de conversas. */
  onMobileBack?: () => void;
}

function ChatTypingEllipsis() {
  return (
    <span className="inline-flex h-3.5 items-end gap-px pb-0.5" aria-hidden>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="block h-1 w-1 rounded-full bg-current opacity-70 motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

function ChatDateSeparator({ dateStr }: { dateStr: string }) {
  let label: string;
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) label = 'Hoje';
    else if (isYesterday(d)) label = 'Ontem';
    else label = format(d, "d 'de' MMMM yyyy", { locale: pt });
  } catch {
    return null;
  }
  return (
    <div className="flex justify-center py-2 md:py-2">
      <span className="rounded-full bg-zinc-200/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-300">
        {label}
      </span>
    </div>
  );
}

const headerIconBtn =
  'h-11 w-11 shrink-0 md:h-8 md:w-8';

const MOBILE_CHAT_MSG_INPUT_ID = 'sanep-chat-mobile-msg';

export function ConversationView({ conversationId, onMobileBack }: ConversationViewProps) {
  const { user, usuarios } = useAuth();
  const {
    conversations,
    messages,
    usesMessagePagination,
    setActiveConversationId,
    ensureThreadForConversation,
    loadOlderMessages,
    hasMoreOlderMessages,
    loadingOlderMessages,
    sendMessage,
    markConversationAsRead,
    getConversationDisplayName,
    getPinnedMessages,
    togglePinMessage,
    getGroupFiles,
    getGroupLinks,
    removeParticipantFromGroup,
    canManageGroup,
  } = useChat();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const mobileComposerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mobileSendBtnRef = useRef<HTMLButtonElement>(null);
  /** Espelho do texto no mobile — o efeito dos listeners pode ligar só após `conv` existir; o draft cobre desvios DOM/estado. */
  const mobileInputDraftRef = useRef('');
  const handleSendRef = useRef<() => void>(() => {});
  const lastSendAtRef = useRef(0);
  const nearBottomRef = useRef(true);
  const loadingOlderScrollRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const [localHistoryExtra, setLocalHistoryExtra] = useState(0);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<number>(0);
  const [groupMembersSearch, setGroupMembersSearch] = useState('');
  const [groupFilesSearch, setGroupFilesSearch] = useState('');
  const [groupLinksSearch, setGroupLinksSearch] = useState('');
  const isMobileComposer = useIsMobileViewport();
  const keyboardBottomInset = useVisualViewportBottomInset();

  const typingEnabled =
    usesMessagePagination && !!conversationId && (user?.id ?? 0) > 0;
  const { typingPeerIds, onComposerActivity, setTypingInactive } = useChatTypingBroadcast({
    conversationId,
    profileId: user?.id ?? 0,
    enabled: typingEnabled,
  });

  const conv = useMemo(() => conversations.find(c => c.id === conversationId), [conversations, conversationId]);

  const typingSubtitle = useMemo(() => {
    if (typingPeerIds.length === 0) return null;
    const names = typingPeerIds
      .map(id => usuarios.find(u => u.id === id)?.nome)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) return 'A escrever';
    if (names.length === 1) return `${names[0]} está a escrever`;
    if (names.length === 2) return `${names[0]} e ${names[1]} estão a escrever`;
    return `${names.slice(0, 2).join(', ')} e mais ${names.length - 2} estão a escrever`;
  }, [typingPeerIds, usuarios]);

  const headerPeer = useMemo(() => {
    if (!conv || conv.type === 'group') return null;
    const oid = conv.participantIds.find(id => id !== user?.id);
    return oid != null ? usuarios.find(x => x.id === oid) : null;
  }, [conv, user?.id, usuarios]);

  const allConvMessagesSorted = useMemo(
    () =>
      messages
        .filter(m => m.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages, conversationId],
  );

  const convMessages = useMemo(() => {
    if (usesMessagePagination) {
      return allConvMessagesSorted;
    }
    const take = CHAT_PAGE_SIZE + localHistoryExtra;
    if (allConvMessagesSorted.length <= take) return allConvMessagesSorted;
    return allConvMessagesSorted.slice(-take);
  }, [usesMessagePagination, allConvMessagesSorted, localHistoryExtra]);

  const hasMoreLocalOlder =
    !usesMessagePagination && allConvMessagesSorted.length > CHAT_PAGE_SIZE + localHistoryExtra;

  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  useEffect(() => {
    setLocalHistoryExtra(0);
    nearBottomRef.current = true;
    loadingOlderScrollRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !usesMessagePagination) return;
    void ensureThreadForConversation(conversationId).then(() => {
      requestAnimationFrame(() => {
        const el = scrollViewportRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }, [conversationId, usesMessagePagination, ensureThreadForConversation]);

  useEffect(() => {
    if (conversationId) markConversationAsRead(conversationId);
  }, [conversationId, markConversationAsRead]);

  useLayoutEffect(() => {
    const p = loadingOlderScrollRef.current;
    if (!p || !scrollViewportRef.current) return;
    loadingOlderScrollRef.current = null;
    const el = scrollViewportRef.current;
    el.scrollTop = el.scrollHeight - p.prevHeight + p.prevTop;
  }, [convMessages.length, conversationId]);

  useEffect(() => {
    if (!nearBottomRef.current) return;
    const el = scrollViewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [convMessages.length, conversationId]);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el || !conversationId) return;
    const threshold = 100;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    if (el.scrollTop > 72) return;

    if (usesMessagePagination) {
      if (!hasMoreOlderMessages(conversationId) || loadingOlderMessages(conversationId)) return;
      const prevHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      void loadOlderMessages(conversationId).then(() => {
        requestAnimationFrame(() => {
          const n = scrollViewportRef.current;
          if (!n) return;
          n.scrollTop = n.scrollHeight - prevHeight + prevTop;
        });
      });
      return;
    }

    if (!hasMoreLocalOlder) return;
    loadingOlderScrollRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop };
    setLocalHistoryExtra(prev => prev + CHAT_PAGE_SIZE);
  }, [
    conversationId,
    usesMessagePagination,
    hasMoreOlderMessages,
    loadingOlderMessages,
    loadOlderMessages,
    hasMoreLocalOlder,
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    mobileInputDraftRef.current = v;
    setInput(v);
    const cursor = e.target.selectionStart ?? 0;
    const before = v.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionAnchor(cursor - match[0].length);
    } else {
      setMentionQuery(null);
    }
    if (typingEnabled) {
      if (v.trim().length === 0) {
        setTypingInactive();
      } else {
        onComposerActivity();
      }
    }
  };

  const insertMention = (nome: string) => {
    const before = input.slice(0, mentionAnchor);
    const after = input.slice(mentionAnchor).replace(/@\w*$/, '');
    const next = `${before}@${nome} ${after}`;
    mobileInputDraftRef.current = next;
    setInput(next);
    setMentionQuery(null);
    if (typingEnabled) onComposerActivity();
  };

  const mentionCandidates = useMemo(() => {
    if (!mentionQuery) return [];
    return usuarios
      .filter(u => u.id !== user?.id && conv?.participantIds.includes(u.id))
      .filter(u => u.nome.toLowerCase().includes(mentionQuery))
      .slice(0, 5);
  }, [mentionQuery, usuarios, user?.id, conv?.participantIds]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [...prev, {
          id: `att-${Date.now()}-${prev.length}`,
          name: file.name,
          url: reader.result as string,
          type: file.type,
          size: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const clearIosTextSelection = () => {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* ignore */
    }
  };

  const handleSend = () => {
    if (typingEnabled) setTypingInactive();
    clearIosTextSelection();
    const ta =
      mobileComposerTextareaRef.current ??
      (typeof document !== 'undefined'
        ? (document.getElementById(MOBILE_CHAT_MSG_INPUT_ID) as HTMLTextAreaElement | null)
        : null);
    // Mobile: texto vem sempre do textarea (fonte visível); evita heurística length vs estado
    // que em alguns frames no iOS deixava `text` vazio com o botão a reagir.
    const raw = isMobileComposer
      ? (ta?.value ?? mobileInputDraftRef.current ?? input)
      : input;
    const text = raw.trim();
    if (!conversationId || (!text && attachments.length === 0)) return;
    const now = Date.now();
    if (now - lastSendAtRef.current < 280) return;
    lastSendAtRef.current = now;
    nearBottomRef.current = true;
    sendMessage(conversationId, text || '(ficheiro anexado)', attachments);
    mobileInputDraftRef.current = '';
    setInput('');
    setAttachments([]);
  };

  handleSendRef.current = handleSend;

  /**
   * PWA iOS: `touchend` nativo com `{ passive: false }` (React pode registar touch como passivo).
   * Na 1.ª renderização `conv` pode ainda não existir (lista Supabase a carregar) — o botão não está no DOM;
   * com deps só `[isMobileComposer]` o efeito não voltava a correr e ficava sem listeners
   * (`onClick` falha muitas vezes com teclado aberto → não envia).
   */
  useLayoutEffect(() => {
    if (!isMobileComposer || !conversationId || !conv) return;

    let cleanup: (() => void) | undefined;
    let canceled = false;
    let raf = 0;

    const bind = () => {
      const btn = mobileSendBtnRef.current;
      if (!btn || canceled) return;

      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        handleSendRef.current();
      };

      btn.addEventListener('touchend', onTouchEnd, { passive: false });
      cleanup = () => {
        btn.removeEventListener('touchend', onTouchEnd);
      };
    };

    bind();
    if (!cleanup) {
      raf = requestAnimationFrame(() => {
        if (canceled) return;
        bind();
      });
    }

    return () => {
      canceled = true;
      if (raf) cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [isMobileComposer, conversationId, conv?.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.key === 'Process') return;
    if ((e.key === 'Enter' || e.key === 'NumpadEnter') && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const composerSendDisabled = !input.trim() && attachments.length === 0;

  const getSenderName = (senderId: number) => usuarios.find(u => u.id === senderId)?.nome ?? 'Utilizador';

  const pinned = conversationId ? getPinnedMessages(conversationId) : [];
  const isGroup = conv?.type === 'group';
  const canManage = isGroup && conv ? canManageGroup(conv) : false;
  const convFiles = conversationId ? getGroupFiles(conversationId) : [];
  const convLinks = conversationId ? getGroupLinks(conversationId) : [];

  const filteredMemberIds = useMemo(() => {
    if (!conv || conv.type !== 'group') return [];
    const q = groupMembersSearch.trim().toLowerCase();
    if (!q) return conv.participantIds;
    return conv.participantIds.filter(pid => {
      const u = usuarios.find(x => x.id === pid);
      const nome = (u?.nome ?? '').toLowerCase();
      const email = (u?.email ?? '').toLowerCase();
      return nome.includes(q) || email.includes(q);
    });
  }, [conv, groupMembersSearch, usuarios]);

  const filteredFiles = useMemo(() => {
    const q = groupFilesSearch.trim().toLowerCase();
    if (!q) return convFiles;
    return convFiles.filter(item => {
      const name = (item.attachment.name ?? '').toLowerCase();
      const sender = (getSenderName(item.senderId) ?? '').toLowerCase();
      return name.includes(q) || sender.includes(q);
    });
  }, [convFiles, groupFilesSearch, usuarios]);

  const filteredLinks = useMemo(() => {
    const q = groupLinksSearch.trim().toLowerCase();
    if (!q) return convLinks;
    return convLinks.filter(item => {
      const url = (item.url ?? '').toLowerCase();
      const sender = (getSenderName(item.senderId) ?? '').toLowerCase();
      return url.includes(q) || sender.includes(q);
    });
  }, [convLinks, groupLinksSearch, usuarios]);

  if (!conversationId || !conv) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
        {onMobileBack && (
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/20 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] md:hidden">
            <button
              type="button"
              onClick={onMobileBack}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted/80"
              aria-label="Voltar às conversas"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          </div>
        )}
        <div className="flex flex-1 items-center justify-center px-4 text-muted-foreground">
          <p className="text-center text-sm">Seleccione uma conversa ou inicie uma nova.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background max-md:bg-[#ECECEF] md:bg-background">
      {/* Header: shrink-0 — só a área de mensagens abaixo faz scroll (overflow-hidden no pai). */}
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-border bg-muted/20 px-2 py-2 max-md:border-zinc-100 max-md:bg-white max-md:pl-[max(0.5rem,env(safe-area-inset-left,0px))] max-md:pr-[max(0.5rem,env(safe-area-inset-right,0px))] max-md:pt-[max(3rem,env(safe-area-inset-top,0px))] max-md:shadow-sm md:gap-2 md:px-4 md:py-3 md:shadow-none">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onMobileBack && (
            <button
              type="button"
              onClick={onMobileBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 md:h-11 md:w-11 md:rounded-xl md:text-foreground md:hover:bg-muted/80"
              aria-label="Voltar às conversas"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <div className="hidden min-w-0 flex-1 flex-col md:flex">
            <h2 className="truncate font-semibold">{getConversationDisplayName(conv)}</h2>
            {typingSubtitle ? (
              <p
                className="mt-0.5 flex min-h-4 min-w-0 items-center gap-1.5 truncate text-xs italic text-muted-foreground"
                aria-live="polite"
              >
                <ChatTypingEllipsis />
                <span className="truncate">{typingSubtitle}…</span>
              </p>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
            <Avatar className="h-11 w-11 border border-zinc-100 shadow-sm">
              {headerPeer && userAvatarImageSrc(headerPeer) ? (
                <AvatarImage src={userAvatarImageSrc(headerPeer)!} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback
                className={cn(
                  'text-sm font-semibold',
                  conv.type === 'group' ? 'bg-amber-100 text-amber-800' : 'bg-primary/15 text-primary',
                )}
              >
                {conv.type === 'group' ? <Users className="h-5 w-5" /> : userAvatarFallbackLabel(headerPeer)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-zinc-900">
                {getConversationDisplayName(conv)}
              </h2>
              <p className="mt-0.5 flex min-h-4 min-w-0 items-center gap-1.5 text-[11px] font-medium">
                {typingSubtitle ? (
                  <span
                    className="flex min-w-0 items-center gap-1.5 truncate italic text-amber-800 dark:text-amber-200"
                    aria-live="polite"
                  >
                    <ChatTypingEllipsis />
                    <span className="truncate">{typingSubtitle}…</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                    Na intranet
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 md:gap-1">
          <div className="flex items-center md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className={headerIconBtn}
              disabled
              title="Chamada de voz (brevemente)"
              aria-label="Chamada de voz (brevemente)"
            >
              <Phone className="h-[18px] w-[18px] text-zinc-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={headerIconBtn}
              disabled
              title="Vídeo (brevemente)"
              aria-label="Vídeo (brevemente)"
            >
              <Video className="h-[18px] w-[18px] text-zinc-500" />
            </Button>
          </div>
          {isGroup && (
              <Popover onOpenChange={open => !open && setGroupMembersSearch('')}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className={headerIconBtn} title="Membros">
                    <Users className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(calc(100vw-2rem),20rem)] p-0 md:w-80" align="end">
                  <div className="p-2 border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground px-1 pb-2">Membros do grupo</p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar por nome ou email..."
                        value={groupMembersSearch}
                        onChange={e => setGroupMembersSearch(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                  </div>
                  <ScrollArea className="max-h-[280px]">
                    <div className="p-2 space-y-0.5">
                      {filteredMemberIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          {conv.participantIds.length > 0 ? 'Nenhum resultado.' : 'Nenhum membro.'}
                        </p>
                      ) : (
                        filteredMemberIds.map(pid => {
                          const u = usuarios.find(x => x.id === pid);
                          const isSelf = pid === user?.id;
                          const canRemove = canManage && !isSelf && conv.participantIds.length > 2;
                          return (
                            <div
                              key={pid}
                              className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarFallback className="text-xs">{u?.avatar ?? '?'}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium truncate">{u?.nome ?? 'Utilizador'}</span>
                                {isSelf && <span className="text-xs text-muted-foreground">(tu)</span>}
                              </div>
                              {canRemove && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                                        onClick={() => removeParticipantFromGroup(conversationId, pid)}
                                      >
                                        <UserMinus className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remover do grupo</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
          )}
          <Popover onOpenChange={open => !open && setGroupFilesSearch('')}>
            <PopoverTrigger asChild>
              <span className="relative inline-flex">
                <Button variant="ghost" size="icon" className={headerIconBtn} title="Ficheiros">
                  <FileText className="h-4 w-4" />
                </Button>
                {convFiles.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {convFiles.length > 99 ? '99+' : convFiles.length}
                  </span>
                )}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-[min(calc(100vw-2rem),24rem)] p-0 md:w-96" align="end">
              <div className="p-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground px-1 pb-2">Ficheiros partilhados</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por nome ou autor..."
                    value={groupFilesSearch}
                    onChange={e => setGroupFilesSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="p-2 space-y-1">
                  {filteredFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {convFiles.length > 0 ? 'Nenhum resultado.' : 'Nenhum ficheiro partilhado.'}
                    </p>
                  ) : (
                    filteredFiles.map((item, i) => (
                      <a
                        key={`${item.messageId}-${item.attachment.id}-${i}`}
                        href={item.attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50 text-left"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getSenderName(item.senderId)} · {formatChatTime(item.createdAt)}
                          </p>
                        </div>
                      </a>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Popover onOpenChange={open => !open && setGroupLinksSearch('')}>
            <PopoverTrigger asChild>
              <span className="relative inline-flex">
                <Button variant="ghost" size="icon" className={headerIconBtn} title="Links">
                  <Link2 className="h-4 w-4" />
                </Button>
                {convLinks.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {convLinks.length > 99 ? '99+' : convLinks.length}
                  </span>
                )}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-[min(calc(100vw-2rem),26rem)] p-0 md:w-[420px]" align="end">
              <div className="p-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground px-1 pb-2">Links partilhados</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por URL ou autor..."
                    value={groupLinksSearch}
                    onChange={e => setGroupLinksSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="p-2 space-y-1">
                  {filteredLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {convLinks.length > 0 ? 'Nenhum resultado.' : 'Nenhum link partilhado.'}
                    </p>
                  ) : (
                    filteredLinks.map((item, i) => (
                      <a
                        key={`${item.url}-${i}`}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-md p-2 hover:bg-muted/50 text-left"
                      >
                        <p className="text-sm text-primary truncate">{item.url}</p>
                        <p className="text-xs text-muted-foreground">
                          {getSenderName(item.senderId)} · {formatChatTime(item.createdAt)}
                        </p>
                      </a>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          {pinned.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={headerIconBtn} title="Mensagens fixadas">
                  <Pin className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(calc(100vw-2rem),20rem)] p-2 md:w-80" align="end">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Mensagens fixadas</p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {pinned.map(m => (
                    <div key={m.id} className="text-xs p-2 rounded bg-muted/50">
                      <p className="font-medium">{getSenderName(m.senderId)}</p>
                      <p className="truncate">{m.content}</p>
                      <p className="text-muted-foreground">{formatChatTime(m.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Messages (scroll no viewport nativo para paginação estilo WhatsApp Web) */}
      <div
        ref={scrollViewportRef}
        className="min-h-0 flex-1 select-none overflow-y-auto overflow-x-hidden px-3 pb-2 pt-1 max-md:min-h-[120px] md:p-4"
        style={
          isMobileComposer
            ? { paddingBottom: keyboardBottomInset + 132 }
            : undefined
        }
        onScroll={handleMessagesScroll}
      >
        {(usesMessagePagination
          ? hasMoreOlderMessages(conversationId)
          : hasMoreLocalOlder) && (
          <div className="flex flex-col items-center justify-center gap-1 py-3 text-muted-foreground">
            {usesMessagePagination && loadingOlderMessages(conversationId) ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-label="A carregar mensagens" />
            ) : (
              <span className="text-xs text-center px-2">
                {usesMessagePagination
                  ? 'Deslize para cima para carregar mensagens mais antigas'
                  : 'Deslize para cima para ver o histórico anterior'}
              </span>
            )}
          </div>
        )}
        <div className="space-y-2 md:space-y-3">
          {convMessages.map((m, idx) => {
            const prev = idx > 0 ? convMessages[idx - 1] : null;
            let showDate = false;
            try {
              const d0 = prev ? format(parseISO(prev.createdAt), 'yyyy-MM-dd') : '';
              const d1 = format(parseISO(m.createdAt), 'yyyy-MM-dd');
              showDate = !prev || d0 !== d1;
            } catch {
              showDate = !prev;
            }
            return (
              <div key={m.id}>
                {showDate ? <ChatDateSeparator dateStr={m.createdAt} /> : null}
                <MessageBubble
                  message={m}
                  senderName={getSenderName(m.senderId)}
                  onPin={togglePinMessage}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Um compositor montado de cada vez (evita dois Textarea controlados no DOM — problemas em mobile). */}
      {!isMobileComposer ? (
      <div className="shrink-0 border-t border-border bg-muted/20 p-3 pb-3">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map(a => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
              >
                {a.name}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="flex min-h-8 min-w-8 items-center justify-center rounded-md p-1 hover:bg-muted-foreground/20"
                  aria-label={`Remover ${a.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Textarea
              value={input}
              onChange={handleInputChange}
              onInput={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (typingEnabled) setTypingInactive();
              }}
              placeholder="Escreva uma mensagem… (@ menciona)"
              className="min-h-11 max-h-32 resize-none pr-2 text-base md:text-sm"
              rows={1}
            />
            {mentionCandidates.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-48 overflow-y-auto rounded-lg border bg-popover py-1 shadow-lg">
                {mentionCandidates.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-accent md:min-h-9 md:py-1.5"
                    onClick={() => insertMention(u.nome)}
                  >
                    @{u.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx"
            className="hidden"
            id="chat-attach-desktop"
            onChange={handleFileSelect}
          />
          <label htmlFor="chat-attach-desktop">
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" asChild>
              <span>
                <Paperclip className="h-4 w-4" />
              </span>
            </Button>
          </label>
          <Button
            type="button"
            size="icon"
            className="h-11 w-11 shrink-0 touch-manipulation"
            onClick={handleSend}
            disabled={composerSendDisabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      ) : (
      <ChatMobileComposerPortal bottomInset={keyboardBottomInset}>
        <div className="select-none border-t border-zinc-200/80 bg-[#ECECEF] px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map(a => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs shadow-sm"
                >
                  {a.name}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    className="flex min-h-8 min-w-8 items-center justify-center rounded-full p-1 hover:bg-zinc-100"
                    aria-label={`Remover ${a.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Form agrupa controlos; Enviar usa type="button" + onClick — no iOS o submit por
            type="submit" por vezes não dispara onSubmit mesmo com feedback visual no botão. */}
          <form
            className="flex w-full min-w-0 items-end gap-2 [touch-action:manipulation]"
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              id="chat-image-mobile"
              onChange={handleFileSelect}
            />
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx"
              className="sr-only"
              id="chat-attach-mobile"
              onChange={handleFileSelect}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-0.5 h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 touch-manipulation rounded-full text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900 [-webkit-tap-highlight-color:transparent]"
                  aria-label="Anexar"
                >
                  <span className="text-2xl font-light leading-none">+</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 border-zinc-200 p-1 shadow-xl" align="start" side="top">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100"
                  onClick={() => {
                    document.getElementById('chat-image-mobile')?.click();
                  }}
                >
                  <ImagePlus className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
                  Imagem
                </button>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100"
                  onClick={() => {
                    document.getElementById('chat-attach-mobile')?.click();
                  }}
                >
                  <Paperclip className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
                  Ficheiro
                </button>
              </PopoverContent>
            </Popover>

            <div className="flex min-h-[44px] min-w-0 flex-1 touch-manipulation items-end rounded-[1.375rem] border border-zinc-200/90 bg-white px-1 py-1 shadow-sm [-webkit-tap-highlight-color:transparent]">
              <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                <Textarea
                  id={MOBILE_CHAT_MSG_INPUT_ID}
                  ref={mobileComposerTextareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onInput={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    if (typingEnabled) setTypingInactive();
                  }}
                  placeholder="Mensagem…"
                  enterKeyHint="send"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="on"
                  className="min-h-[40px] max-h-[7.5rem] w-full resize-none select-text border-0 bg-transparent px-2.5 py-2 text-[15px] leading-snug shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={1}
                />
                {mentionCandidates.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                    {mentionCandidates.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-zinc-100"
                        onClick={() => insertMention(u.nome)}
                      >
                        @{u.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-0.5 h-9 w-9 shrink-0 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 [-webkit-tap-highlight-color:transparent]"
                    aria-label="Emoji"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto border-zinc-200 p-2 shadow-xl" align="end" side="top">
                  <div className="flex max-w-[240px] flex-wrap gap-0.5">
                    {['👍', '😊', '🎉', '✅', '👋', '❤️', '🙏', '💪', '👏', '🔥'].map(em => (
                      <button
                        key={em}
                        type="button"
                        className="rounded-lg p-1.5 text-2xl transition-colors hover:bg-zinc-100"
                        onClick={() => {
                          setInput(prev => {
                            const n = prev + em;
                            mobileInputDraftRef.current = n;
                            return n;
                          });
                          if (typingEnabled) onComposerActivity();
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <span className="relative z-[120] mb-0.5 inline-flex shrink-0">
              <button
                ref={mobileSendBtnRef}
                type="button"
                aria-label="Enviar"
                aria-disabled={composerSendDisabled}
                onClick={() => handleSend()}
                className={cn(
                  buttonVariants({ size: 'icon' }),
                  // Sempre cor sólida (como a bolha enviada); vazio = não envia em handleSend, sem «fantasma» opacity que parece bug no iOS
                  'h-12 w-12 min-h-[52px] min-w-[52px] shrink-0 cursor-pointer touch-manipulation rounded-full border-0 bg-[hsl(var(--primary))] p-0 text-primary-foreground opacity-100 shadow-md [-webkit-tap-highlight-color:transparent] hover:bg-[hsl(var(--primary)/0.92)] active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:h-5 [&_svg]:w-5',
                )}
              >
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </span>
          </form>
        </div>
      </ChatMobileComposerPortal>
      )}
    </div>
  );
}
