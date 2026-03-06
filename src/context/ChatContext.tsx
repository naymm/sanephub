import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { ChatConversation, ChatMessage, ChatAttachment, MessageStatus } from '@/types/chat';
import { CHAT_CONVERSATIONS_SEED, CHAT_MESSAGES_SEED } from '@/data/chatSeed';

const STORAGE_CONV = 'sanep_chat_conversations';
const STORAGE_MSG = 'sanep_chat_messages';

function loadConversations(): ChatConversation[] {
  try {
    const s = localStorage.getItem(STORAGE_CONV);
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return CHAT_CONVERSATIONS_SEED;
}

function loadMessages(): ChatMessage[] {
  try {
    const s = localStorage.getItem(STORAGE_MSG);
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return CHAT_MESSAGES_SEED;
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface GroupFileItem {
  attachment: ChatAttachment;
  messageId: string;
  senderId: number;
  createdAt: string;
}

export interface GroupLinkItem {
  url: string;
  senderId: number;
  createdAt: string;
}

interface ChatContextType {
  conversations: ChatConversation[];
  messages: ChatMessage[];
  sendMessage: (conversationId: string, content: string, attachments?: ChatAttachment[]) => void;
  createPrivateConversation: (otherUserId: number) => string | null;
  createGroupConversation: (name: string, participantIds: number[]) => string;
  removeParticipantFromGroup: (conversationId: string, userId: number) => boolean;
  markConversationAsRead: (conversationId: string) => void;
  togglePinMessage: (messageId: string) => void;
  getUnreadCount: (conversationId?: string) => number;
  getConversationDisplayName: (c: ChatConversation) => string;
  getLastMessage: (conversationId: string) => ChatMessage | null;
  getPinnedMessages: (conversationId: string) => ChatMessage[];
  getGroupFiles: (conversationId: string) => GroupFileItem[];
  getGroupLinks: (conversationId: string) => GroupLinkItem[];
  canManageGroup: (c: ChatConversation) => boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, usuarios } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>(loadConversations);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);

  useEffect(() => {
    localStorage.setItem(STORAGE_CONV, JSON.stringify(conversations));
  }, [conversations]);
  useEffect(() => {
    localStorage.setItem(STORAGE_MSG, JSON.stringify(messages));
  }, [messages]);

  const currentUserId = user?.id ?? 0;

  const getConversationDisplayName = useCallback(
    (c: ChatConversation): string => {
      if (c.type === 'group' && c.name) return c.name;
      const otherId = c.participantIds.find(id => id !== currentUserId);
      const u = usuarios.find(x => x.id === otherId);
      return u?.nome ?? 'Conversa';
    },
    [currentUserId, usuarios]
  );

  const getLastMessage = useCallback(
    (conversationId: string): ChatMessage | null => {
      const convMessages = messages.filter(m => m.conversationId === conversationId);
      return convMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
    },
    [messages]
  );

  const getUnreadCount = useCallback(
    (conversationId?: string): number => {
      const convs = conversationId ? conversations.filter(c => c.id === conversationId) : conversations;
      let total = 0;
      for (const c of convs) {
        const convMessages = messages.filter(m => m.conversationId === c.id && m.senderId !== currentUserId && !m.readBy.includes(currentUserId));
        total += convMessages.length;
      }
      return total;
    },
    [conversations, messages, currentUserId]
  );

  const sendMessage = useCallback(
    (conversationId: string, content: string, attachments: ChatAttachment[] = []) => {
      if (!currentUserId) return;
      const newMsg: ChatMessage = {
        id: genId('msg'),
        conversationId,
        senderId: currentUserId,
        content: content.trim() || '(ficheiro anexado)',
        createdAt: new Date().toISOString(),
        status: 'sent',
        readBy: [currentUserId],
        attachments: attachments.map(a => ({ ...a, id: a.id || genId('att') })),
        pinned: false,
      };
      setMessages(prev => [...prev, newMsg]);
      // Notificações por user (push) serão feitas na integração com backend; aqui o unread count no sidebar serve de indicador
    },
    [currentUserId, conversations]
  );

  const createPrivateConversation = useCallback(
    (otherUserId: number): string | null => {
      if (!currentUserId) return null;
      const existing = conversations.find(
        c => c.type === 'private' && c.participantIds.includes(currentUserId) && c.participantIds.includes(otherUserId)
      );
      if (existing) return existing.id;
      const newConv: ChatConversation = {
        id: genId('conv'),
        type: 'private',
        name: null,
        participantIds: [currentUserId, otherUserId],
        createdAt: new Date().toISOString(),
        createdById: currentUserId,
      };
      setConversations(prev => [...prev, newConv]);
      return newConv.id;
    },
    [currentUserId, conversations]
  );

  const createGroupConversation = useCallback(
    (name: string, participantIds: number[]): string => {
      const ids = Array.from(new Set([currentUserId, ...participantIds]));
      const newConv: ChatConversation = {
        id: genId('conv'),
        type: 'group',
        name: name.trim() || 'Grupo',
        participantIds: ids,
        createdAt: new Date().toISOString(),
        createdById: currentUserId,
      };
      setConversations(prev => [...prev, newConv]);
      return newConv.id;
    },
    [currentUserId]
  );

  const markConversationAsRead = useCallback(
    (conversationId: string) => {
      setMessages(prev =>
        prev.map(m =>
          m.conversationId === conversationId && m.senderId !== currentUserId && !m.readBy.includes(currentUserId)
            ? { ...m, readBy: [...m.readBy, currentUserId], status: 'read' as MessageStatus }
            : m
        )
      );
    },
    [currentUserId]
  );

  const togglePinMessage = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? {
              ...m,
              pinned: !m.pinned,
              pinnedAt: !m.pinned ? new Date().toISOString() : undefined,
              pinnedById: !m.pinned ? currentUserId : undefined,
            }
          : m
      )
    );
  }, [currentUserId]);

  const getPinnedMessages = useCallback(
    (conversationId: string) => {
      return messages.filter(m => m.conversationId === conversationId && m.pinned).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },
    [messages]
  );

  const canManageGroup = useCallback(
    (c: ChatConversation): boolean => {
      if (c.type !== 'group') return false;
      return user?.perfil === 'Admin' || c.createdById === currentUserId;
    },
    [user?.perfil, currentUserId]
  );

  const removeParticipantFromGroup = useCallback(
    (conversationId: string, userId: number): boolean => {
      const conv = conversations.find(c => c.id === conversationId);
      if (!conv || conv.type !== 'group') return false;
      if (!canManageGroup(conv)) return false;
      if (userId === currentUserId) return false;
      if (conv.participantIds.length <= 2) return false;
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, participantIds: c.participantIds.filter(id => id !== userId) } : c
        )
      );
      return true;
    },
    [conversations, currentUserId, canManageGroup]
  );

  const getGroupFiles = useCallback(
    (conversationId: string): GroupFileItem[] => {
      const items: GroupFileItem[] = [];
      messages
        .filter(m => m.conversationId === conversationId && m.attachments.length > 0)
        .forEach(m => {
          m.attachments.forEach(att => {
            items.push({ attachment: att, messageId: m.id, senderId: m.senderId, createdAt: m.createdAt });
          });
        });
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [messages]
  );

  const getGroupLinks = useCallback(
    (conversationId: string): GroupLinkItem[] => {
      const urlRegex = /https?:\/\/[^\s<>"']+/gi;
      const items: GroupLinkItem[] = [];
      const seen = new Set<string>();
      messages
        .filter(m => m.conversationId === conversationId && m.content)
        .forEach(m => {
          const matches = m.content.match(urlRegex);
          if (matches) {
            matches.forEach(url => {
              const normalized = url.replace(/[.,;:!?)]+$/, '');
              if (!seen.has(normalized)) {
                seen.add(normalized);
                items.push({ url: normalized, senderId: m.senderId, createdAt: m.createdAt });
              }
            });
          }
        });
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [messages]
  );

  const value: ChatContextType = {
    conversations,
    messages,
    sendMessage,
    createPrivateConversation,
    createGroupConversation,
    removeParticipantFromGroup,
    markConversationAsRead,
    togglePinMessage,
    getUnreadCount,
    getConversationDisplayName,
    getLastMessage,
    getPinnedMessages,
    getGroupFiles,
    getGroupLinks,
    canManageGroup,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
