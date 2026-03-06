import { useRef, useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import type { ChatAttachment } from '@/types/chat';
import { MessageBubble } from './MessageBubble';
import { formatChatTime } from '@/utils/formatters';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
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
import { Paperclip, Send, Pin, X, Users, FileText, Link2, UserMinus, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

interface ConversationViewProps {
  conversationId: string | null;
}

export function ConversationView({ conversationId }: ConversationViewProps) {
  const { user, usuarios } = useAuth();
  const {
    conversations,
    messages,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<number>(0);
  const [groupMembersSearch, setGroupMembersSearch] = useState('');
  const [groupFilesSearch, setGroupFilesSearch] = useState('');
  const [groupLinksSearch, setGroupLinksSearch] = useState('');

  const conv = useMemo(() => conversations.find(c => c.id === conversationId), [conversations, conversationId]);
  const convMessages = useMemo(
    () => messages.filter(m => m.conversationId === conversationId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages, conversationId]
  );

  useEffect(() => {
    if (conversationId) markConversationAsRead(conversationId);
  }, [conversationId, markConversationAsRead]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
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
  };

  const insertMention = (nome: string) => {
    const before = input.slice(0, mentionAnchor);
    const after = input.slice(mentionAnchor).replace(/@\w*$/, '');
    setInput(`${before}@${nome} ${after}`);
    setMentionQuery(null);
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

  const handleSend = () => {
    const text = input.trim();
    if (!conversationId || (!text && attachments.length === 0)) return;
    sendMessage(conversationId, text || '(ficheiro anexado)', attachments);
    setInput('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      <div className="flex-1 flex items-center justify-center bg-muted/30 text-muted-foreground">
        <p className="text-sm">Seleccione uma conversa ou inicie uma nova.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <h2 className="font-semibold truncate">{getConversationDisplayName(conv)}</h2>
        <div className="flex items-center gap-1">
          {isGroup && (
              <Popover onOpenChange={open => !open && setGroupMembersSearch('')}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Membros">
                    <Users className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
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
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Ficheiros">
                  <FileText className="h-4 w-4" />
                </Button>
                {convFiles.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {convFiles.length > 99 ? '99+' : convFiles.length}
                  </span>
                )}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
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
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Links">
                  <Link2 className="h-4 w-4" />
                </Button>
                {convLinks.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {convLinks.length > 99 ? '99+' : convLinks.length}
                  </span>
                )}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="end">
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
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Mensagens fixadas">
                  <Pin className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="end">
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

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {convMessages.map(m => (
            <MessageBubble
              key={m.id}
              message={m}
              senderName={getSenderName(m.senderId)}
              onPin={togglePinMessage}
            />
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-3 bg-muted/20">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map(a => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
              >
                {a.name}
                <button type="button" onClick={() => removeAttachment(a.id)} className="p-0.5 hover:bg-muted-foreground/20 rounded">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Escreva uma mensagem... (use @ para mencionar)"
              className="min-h-[44px] max-h-32 resize-none pr-10"
              rows={1}
            />
            {mentionCandidates.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border bg-popover shadow-lg py-1 z-10">
                {mentionCandidates.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
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
            id="chat-file-input"
            onChange={handleFileSelect}
          />
          <label htmlFor="chat-file-input">
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" asChild>
              <span>
                <Paperclip className="h-4 w-4" />
              </span>
            </Button>
          </label>
          <Button
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() && attachments.length === 0}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
