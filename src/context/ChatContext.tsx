import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  conversaSoEntreColaboradores,
  eParColaboradorNoChat,
  podeAcederAoChat,
} from '@/utils/chatColaboradores';
import type { ChatConversation, ChatMessage, ChatAttachment, MessageStatus } from '@/types/chat';
import { CHAT_CONVERSATIONS_SEED, CHAT_MESSAGES_SEED } from '@/data/chatSeed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Json } from '@/types/supabase';
import { toast } from 'sonner';

const STORAGE_CONV = 'sanep_chat_conversations';
const STORAGE_MSG = 'sanep_chat_messages';

const supabaseMode = isSupabaseConfigured();

/** Mensagens recentes por conversa ao abrir (estilo WhatsApp Web). */
export const CHAT_PAGE_SIZE = 40;

type MsgRow = {
  id: string;
  conversation_id: string;
  sender_profile_id: number;
  content: string;
  attachments: unknown;
  read_by_profile_ids: number[];
  pinned: boolean;
  pinned_at: string | null;
  pinned_by_profile_id: number | null;
  created_at: string;
};

type ConversationRow = {
  id: string;
  type: string;
  name: string | null;
  participant_ids: number[];
  created_by_profile_id: number;
  created_at: string;
};

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

/** UUID v4 para Supabase. Em contexto não seguro (HTTP por IP na LAN) `crypto.randomUUID` não existe. */
function randomUUID(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const h = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function rowToConversation(row: ConversationRow): ChatConversation {
  return {
    id: row.id,
    type: row.type as ChatConversation['type'],
    name: row.name,
    participantIds: [...row.participant_ids],
    createdAt: row.created_at,
    createdById: row.created_by_profile_id,
  };
}

function deriveMessageStatus(
  row: MsgRow,
  participantIds: number[],
  currentUserId: number,
): MessageStatus {
  const readBy = row.read_by_profile_ids ?? [];
  if (row.sender_profile_id !== currentUserId) {
    return readBy.includes(currentUserId) ? 'read' : 'sent';
  }
  const others = participantIds.filter((id) => id !== row.sender_profile_id);
  if (others.length === 0) return 'sent';
  return others.every((id) => readBy.includes(id)) ? 'read' : 'sent';
}

function rowToMessage(row: MsgRow, participantIds: number[], currentUserId: number): ChatMessage {
  const raw = row.attachments;
  const attachments: ChatAttachment[] = Array.isArray(raw)
    ? (raw as unknown as ChatAttachment[])
    : [];
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_profile_id,
    content: row.content,
    createdAt: row.created_at,
    status: deriveMessageStatus(row, participantIds, currentUserId),
    readBy: [...(row.read_by_profile_ids ?? [])],
    attachments,
    pinned: row.pinned,
    pinnedAt: row.pinned_at ?? undefined,
    pinnedById: row.pinned_by_profile_id ?? undefined,
  };
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
  /** Com Supabase: lista lateral e contagens sem carregar todo o histórico. */
  usesMessagePagination: boolean;
  setActiveConversationId: (id: string | null) => void;
  ensureThreadForConversation: (conversationId: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  hasMoreOlderMessages: (conversationId: string) => boolean;
  loadingOlderMessages: (conversationId: string) => boolean;
  sendMessage: (conversationId: string, content: string, attachments?: ChatAttachment[]) => void;
  createPrivateConversation: (otherUserId: number) => Promise<string | null>;
  createGroupConversation: (name: string, participantIds: number[]) => Promise<string>;
  removeParticipantFromGroup: (conversationId: string, userId: number) => Promise<boolean>;
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
  const [conversations, setConversations] = useState<ChatConversation[]>(() =>
    supabaseMode ? [] : loadConversations(),
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => (supabaseMode ? [] : loadMessages()));
  const [lastMessageByConv, setLastMessageByConv] = useState<Record<string, ChatMessage>>({});
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const [hasMoreOlderByConv, setHasMoreOlderByConv] = useState<Record<string, boolean>>({});
  const [loadingOlderByConv, setLoadingOlderByConv] = useState<Record<string, boolean>>({});

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const hasMoreOlderRef = useRef(hasMoreOlderByConv);
  hasMoreOlderRef.current = hasMoreOlderByConv;

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const initialPageLoadedRef = useRef<Set<string>>(new Set());
  const activeConversationIdRef = useRef<string | null>(null);
  const loadOlderLockRef = useRef<Set<string>>(new Set());

  const currentUserId = user?.id ?? 0;

  /**
   * Som ao receber mensagem nova (realtime).
   * Nota: alguns navegadores bloqueiam áudio sem interação do utilizador — falha silenciosamente.
   */
  const lastChatBeepAtRef = useRef(0);
  const playChatBeep = () => {
    const nowMs = Date.now();
    if (nowMs - lastChatBeepAtRef.current < 900) return; // evita spam em bursts
    lastChatBeepAtRef.current = nowMs;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 932; // Hz (beep curto, distinto)
      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

      oscillator.start(t);
      oscillator.stop(t + 0.15);

      oscillator.onended = () => {
        try {
          ctx.close();
        } catch {}
      };
    } catch {
      // ignore
    }
  };

  const setActiveConversationId = useCallback((id: string | null) => {
    activeConversationIdRef.current = id;
  }, []);

  const refreshUnreadSummary = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('intranet_chat_unread_summary');
    if (error) {
      console.error('[chat] unread_summary', error);
      return;
    }
    const m: Record<string, number> = {};
    for (const r of data ?? []) {
      m[r.conversation_id] = Number(r.unread_count);
    }
    setUnreadByConv(m);
  }, []);

  const fetchRemoteChat = useCallback(
    async (userId: number) => {
      if (!supabase) return;
      const { data: convs, error: ce } = await supabase
        .from('intranet_chat_conversations')
        .select('*')
        .contains('participant_ids', [userId]);
      if (ce) {
        console.error('[chat] fetch conversations', ce);
        return;
      }
      const convList = (convs ?? []).map((row) => rowToConversation(row as ConversationRow));
      const convIds = new Set(convList.map((c) => c.id));
      setConversations(convList);

      setMessages((prev) => prev.filter((m) => convIds.has(m.conversationId)));
      for (const id of [...initialPageLoadedRef.current]) {
        if (!convIds.has(id)) initialPageLoadedRef.current.delete(id);
      }
      setHasMoreOlderByConv((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (!convIds.has(k)) delete next[k];
        }
        return next;
      });

      if (convList.length === 0) {
        setLastMessageByConv({});
        setUnreadByConv({});
        return;
      }

      const ids = convList.map((c) => c.id);

      const { data: latestRows, error: le } = await supabase.rpc('intranet_chat_latest_messages', {
        p_conversation_ids: ids,
      });
      await refreshUnreadSummary();

      if (le) console.error('[chat] latest_messages', le);

      const convMap = new Map(convList.map((c) => [c.id, c.participantIds]));
      const nextLast: Record<string, ChatMessage> = {};
      for (const row of latestRows ?? []) {
        const r = row as MsgRow;
        const pIds = convMap.get(r.conversation_id) ?? [];
        nextLast[r.conversation_id] = rowToMessage(r, pIds, userId);
      }
      setLastMessageByConv(nextLast);
    },
    [refreshUnreadSummary],
  );

  const ensureThreadForConversation = useCallback(
    async (conversationId: string) => {
      if (!supabaseMode || !supabase || !user?.id) return;
      if (initialPageLoadedRef.current.has(conversationId)) return;

      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      if (!conv) return;

      initialPageLoadedRef.current.add(conversationId);

      const { data, error } = await supabase
        .from('intranet_chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE_SIZE);

      if (error) {
        console.error('[chat] ensureThread', error);
        initialPageLoadedRef.current.delete(conversationId);
        return;
      }

      const rows = (data ?? []) as MsgRow[];
      const chronological = [...rows].reverse();
      const mapped = chronological.map((row) => rowToMessage(row, conv.participantIds, user.id));

      setMessages((prev) => {
        const rest = prev.filter((m) => m.conversationId !== conversationId);
        return [...rest, ...mapped].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });

      setHasMoreOlderByConv((prev) => ({
        ...prev,
        [conversationId]: rows.length >= CHAT_PAGE_SIZE,
      }));
    },
    [supabaseMode, user?.id],
  );

  const loadOlderMessages = useCallback(
    async (conversationId: string) => {
      if (!supabaseMode || !supabase || !user?.id) return;
      if (loadOlderLockRef.current.has(conversationId)) return;
      if (!hasMoreOlderRef.current[conversationId]) return;

      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      if (!conv) return;

      const convMsgs = messagesRef.current
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const oldest = convMsgs[0];
      if (!oldest) return;

      loadOlderLockRef.current.add(conversationId);
      setLoadingOlderByConv((p) => ({ ...p, [conversationId]: true }));

      const { data, error } = await supabase
        .from('intranet_chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldest.createdAt)
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE_SIZE);

      loadOlderLockRef.current.delete(conversationId);
      setLoadingOlderByConv((p) => ({ ...p, [conversationId]: false }));

      if (error) {
        console.error('[chat] loadOlder', error);
        return;
      }

      const rows = (data ?? []) as MsgRow[];
      if (rows.length === 0) {
        setHasMoreOlderByConv((p) => ({ ...p, [conversationId]: false }));
        return;
      }

      const chronological = [...rows].reverse();
      const mapped = chronological.map((row) => rowToMessage(row, conv.participantIds, user.id));

      setMessages((prev) => {
        const rest = prev.filter((m) => m.conversationId !== conversationId);
        const kept = prev.filter((m) => m.conversationId === conversationId);
        return [...mapped, ...kept].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });

      setHasMoreOlderByConv((p) => ({
        ...p,
        [conversationId]: rows.length >= CHAT_PAGE_SIZE,
      }));
    },
    [supabaseMode, user?.id],
  );

  const hasMoreOlderMessages = useCallback(
    (conversationId: string) => !!hasMoreOlderByConv[conversationId],
    [hasMoreOlderByConv],
  );

  const loadingOlderMessages = useCallback(
    (conversationId: string) => !!loadingOlderByConv[conversationId],
    [loadingOlderByConv],
  );

  useEffect(() => {
    if (!supabaseMode) {
      localStorage.setItem(STORAGE_CONV, JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    if (!supabaseMode) {
      localStorage.setItem(STORAGE_MSG, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (!supabaseMode || !user?.id) {
      initialPageLoadedRef.current.clear();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!supabaseMode || !supabase || !user?.id) {
      if (supabaseMode && !user?.id) {
        setConversations([]);
        setMessages([]);
        setLastMessageByConv({});
        setUnreadByConv({});
        setHasMoreOlderByConv({});
      }
      return;
    }

    const uid = user.id;
    void fetchRemoteChat(uid);

    const channel = supabase
      .channel(`intranet-chat-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'intranet_chat_conversations' },
        (payload) => {
          const row = payload.new as ConversationRow;
          if (!row.participant_ids?.includes(uid)) return;
          setConversations((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            return [...prev, rowToConversation(row)];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'intranet_chat_conversations' },
        (payload) => {
          const row = payload.new as ConversationRow;
          if (!row.participant_ids?.includes(uid)) {
            setConversations((prev) => prev.filter((c) => c.id !== row.id));
            setMessages((prev) => prev.filter((m) => m.conversationId !== row.id));
            initialPageLoadedRef.current.delete(row.id);
            setLastMessageByConv((p) => {
              const n = { ...p };
              delete n[row.id];
              return n;
            });
            return;
          }
          setConversations((prev) => prev.map((c) => (c.id === row.id ? rowToConversation(row) : c)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'intranet_chat_messages' },
        (payload) => {
          const row = payload.new as MsgRow;
          const conv = conversationsRef.current.find((c) => c.id === row.conversation_id);
          if (!conv) {
            void fetchRemoteChat(uid);
            return;
          }
          const msg = rowToMessage(row, conv.participantIds, uid);

          // Desktop: som quando chega mensagem de outra pessoa (mesmo na conversa aberta).
          if (row.sender_profile_id !== uid) {
            playChatBeep();
          }

          setLastMessageByConv((prev) => {
            const cur = prev[row.conversation_id];
            if (!cur || new Date(row.created_at).getTime() >= new Date(cur.createdAt).getTime()) {
              return { ...prev, [row.conversation_id]: msg };
            }
            return prev;
          });

          if (row.sender_profile_id !== uid && row.conversation_id !== activeConversationIdRef.current) {
            setUnreadByConv((prev) => ({
              ...prev,
              [row.conversation_id]: (prev[row.conversation_id] ?? 0) + 1,
            }));
          }

          const inThread =
            activeConversationIdRef.current === row.conversation_id ||
            initialPageLoadedRef.current.has(row.conversation_id);

          if (inThread) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
              );
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'intranet_chat_messages' },
        (payload) => {
          const row = payload.new as MsgRow;
          const conv = conversationsRef.current.find((c) => c.id === row.conversation_id);
          const pIds = conv?.participantIds ?? [];
          const msg = rowToMessage(row, pIds, uid);

          void refreshUnreadSummary();

          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabaseMode, user?.id, fetchRemoteChat, refreshUnreadSummary]);

  const getConversationDisplayName = useCallback(
    (c: ChatConversation): string => {
      if (c.type === 'group' && c.name) return c.name;
      const otherId = c.participantIds.find((id) => id !== currentUserId);
      const u = usuarios.find((x) => x.id === otherId);
      return u?.nome ?? 'Conversa';
    },
    [currentUserId, usuarios],
  );

  const getLastMessage = useCallback(
    (conversationId: string): ChatMessage | null => {
      if (supabaseMode) {
        const fromMap = lastMessageByConv[conversationId];
        if (fromMap) return fromMap;
      }
      const convMessages = messages.filter((m) => m.conversationId === conversationId);
      return (
        convMessages.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] ?? null
      );
    },
    [messages, lastMessageByConv],
  );

  const getUnreadCount = useCallback(
    (conversationId?: string): number => {
      if (supabaseMode) {
        if (conversationId) {
          const c = conversations.find((x) => x.id === conversationId);
          if (!c || !conversaSoEntreColaboradores(c.participantIds, usuarios)) return 0;
          return unreadByConv[conversationId] ?? 0;
        }
        return conversations
          .filter((x) => conversaSoEntreColaboradores(x.participantIds, usuarios))
          .reduce((acc, c) => acc + (unreadByConv[c.id] ?? 0), 0);
      }
      const convs = conversationId
        ? conversations.filter(
            (c) =>
              c.id === conversationId && conversaSoEntreColaboradores(c.participantIds, usuarios),
          )
        : conversations.filter((c) => conversaSoEntreColaboradores(c.participantIds, usuarios));
      let total = 0;
      for (const c of convs) {
        const convMessages = messages.filter(
          (m) =>
            m.conversationId === c.id &&
            m.senderId !== currentUserId &&
            !m.readBy.includes(currentUserId),
        );
        total += convMessages.length;
      }
      return total;
    },
    [conversations, messages, currentUserId, usuarios, unreadByConv],
  );

  const sendMessage = useCallback(
    (conversationId: string, content: string, attachments: ChatAttachment[] = []) => {
      if (!currentUserId) {
        toast.error('Sessão inválida. Volte a iniciar sessão.', { duration: 12000 });
        return;
      }
      const text = content.trim() || '(ficheiro anexado)';
      const withIds = attachments.map((a) => ({ ...a, id: a.id || genId('att') }));

      if (supabaseMode) {
        if (!supabase) {
          toast.error('Chat indisponível (ligação ao servidor não configurada).', {
            duration: 12000,
          });
          return;
        }
        const id = randomUUID();
        const newMsg: ChatMessage = {
          id,
          conversationId,
          senderId: currentUserId,
          content: text,
          createdAt: new Date().toISOString(),
          status: 'sent',
          readBy: [currentUserId],
          attachments: withIds,
          pinned: false,
        };
        initialPageLoadedRef.current.add(conversationId);
        setMessages((prev) => [...prev, newMsg]);
        setLastMessageByConv((p) => ({ ...p, [conversationId]: newMsg }));
        void (async () => {
          const { error } = await supabase.from('intranet_chat_messages').insert({
            id,
            conversation_id: conversationId,
            sender_profile_id: currentUserId,
            content: text,
            attachments: withIds as unknown as Json,
            read_by_profile_ids: [currentUserId],
            pinned: false,
          });
          if (error) {
            console.error('[chat] sendMessage', error);
            setMessages((prev) => prev.filter((m) => m.id !== id));
            toast.error(error.message || 'Não foi possível enviar a mensagem.', {
              duration: 12000,
              description: error.code ? `Código: ${error.code}` : undefined,
            });
          }
        })();
        return;
      }

      const newMsg: ChatMessage = {
        id: genId('msg'),
        conversationId,
        senderId: currentUserId,
        content: text,
        createdAt: new Date().toISOString(),
        status: 'sent',
        readBy: [currentUserId],
        attachments: withIds,
        pinned: false,
      };
      setMessages((prev) => [...prev, newMsg]);
    },
    [currentUserId, supabase],
  );

  const createPrivateConversation = useCallback(
    async (otherUserId: number): Promise<string | null> => {
      if (!currentUserId || !user || !podeAcederAoChat(user)) return null;
      const other = usuarios.find((x) => x.id === otherUserId);
      if (!other || !eParColaboradorNoChat(user, other)) return null;

      if (supabaseMode) {
        if (!supabase) return null;
        const { data: existing, error: exErr } = await supabase
          .from('intranet_chat_conversations')
          .select('id, participant_ids, type')
          .eq('type', 'private')
          .contains('participant_ids', [currentUserId, otherUserId]);
        if (exErr) {
          console.error('[chat] createPrivate lookup', exErr);
          return null;
        }
        const hit = existing?.find(
          (c) =>
            c.participant_ids.length === 2 &&
            c.participant_ids.includes(currentUserId) &&
            c.participant_ids.includes(otherUserId),
        );
        if (hit) return hit.id;

        const newId = randomUUID();
        const { error } = await supabase.from('intranet_chat_conversations').insert({
          id: newId,
          type: 'private',
          name: null,
          participant_ids: [currentUserId, otherUserId],
          created_by_profile_id: currentUserId,
        });
        if (error) {
          console.error('[chat] createPrivate insert', error);
          return null;
        }
        const newConv: ChatConversation = {
          id: newId,
          type: 'private',
          name: null,
          participantIds: [currentUserId, otherUserId],
          createdAt: new Date().toISOString(),
          createdById: currentUserId,
        };
        setConversations((prev) => (prev.some((c) => c.id === newId) ? prev : [...prev, newConv]));
        return newId;
      }

      const existing = conversations.find(
        (c) =>
          c.type === 'private' &&
          c.participantIds.includes(currentUserId) &&
          c.participantIds.includes(otherUserId),
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
      setConversations((prev) => [...prev, newConv]);
      return newConv.id;
    },
    [currentUserId, conversations, user, usuarios],
  );

  const createGroupConversation = useCallback(
    async (name: string, participantIds: number[]): Promise<string> => {
      if (!user || !podeAcederAoChat(user)) {
        return '';
      }
      const validParticipantIds = participantIds.filter((id) => {
        const u = usuarios.find((x) => x.id === id);
        return u != null && eParColaboradorNoChat(user, u);
      });
      const ids = Array.from(new Set([currentUserId, ...validParticipantIds]));
      if (ids.length < 2) return '';

      if (supabaseMode) {
        if (!supabase) return '';
        const newId = randomUUID();
        const { error } = await supabase.from('intranet_chat_conversations').insert({
          id: newId,
          type: 'group',
          name: name.trim() || 'Grupo',
          participant_ids: ids,
          created_by_profile_id: currentUserId,
        });
        if (error) {
          console.error('[chat] createGroup', error);
          return '';
        }
        const newConv: ChatConversation = {
          id: newId,
          type: 'group',
          name: name.trim() || 'Grupo',
          participantIds: ids,
          createdAt: new Date().toISOString(),
          createdById: currentUserId,
        };
        setConversations((prev) => (prev.some((c) => c.id === newId) ? prev : [...prev, newConv]));
        return newId;
      }

      const newConv: ChatConversation = {
        id: genId('conv'),
        type: 'group',
        name: name.trim() || 'Grupo',
        participantIds: ids,
        createdAt: new Date().toISOString(),
        createdById: currentUserId,
      };
      setConversations((prev) => [...prev, newConv]);
      return newConv.id;
    },
    [currentUserId, user, usuarios],
  );

  const markConversationAsRead = useCallback(
    (conversationId: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.conversationId === conversationId &&
          m.senderId !== currentUserId &&
          !m.readBy.includes(currentUserId)
            ? { ...m, readBy: [...m.readBy, currentUserId], status: 'read' as MessageStatus }
            : m,
        ),
      );
      if (supabaseMode) {
        setUnreadByConv((prev) => ({ ...prev, [conversationId]: 0 }));
        if (supabase) {
          void supabase
            .rpc('intranet_chat_mark_conversation_read', { p_conversation_id: conversationId })
            .then(() => refreshUnreadSummary());
        }
      }
    },
    [currentUserId, refreshUnreadSummary],
  );

  const togglePinMessage = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target) return;
      const nextPinned = !target.pinned;

      if (supabaseMode && supabase) {
        void supabase
          .from('intranet_chat_messages')
          .update({
            pinned: nextPinned,
            pinned_at: nextPinned ? new Date().toISOString() : null,
            pinned_by_profile_id: nextPinned ? currentUserId : null,
          })
          .eq('id', messageId);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                pinned: !m.pinned,
                pinnedAt: !m.pinned ? new Date().toISOString() : undefined,
                pinnedById: !m.pinned ? currentUserId : undefined,
              }
            : m,
        ),
      );
    },
    [currentUserId, messages, supabaseMode],
  );

  const getPinnedMessages = useCallback(
    (conversationId: string) => {
      return messages
        .filter((m) => m.conversationId === conversationId && m.pinned)
        .sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
    },
    [messages],
  );

  const canManageGroup = useCallback(
    (c: ChatConversation): boolean => {
      if (c.type !== 'group') return false;
      return user?.perfil === 'Admin' || c.createdById === currentUserId;
    },
    [user?.perfil, currentUserId],
  );

  const removeParticipantFromGroup = useCallback(
    async (conversationId: string, userId: number): Promise<boolean> => {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv || conv.type !== 'group') return false;
      if (!canManageGroup(conv)) return false;
      if (userId === currentUserId) return false;
      if (conv.participantIds.length <= 2) return false;

      const nextIds = conv.participantIds.filter((id) => id !== userId);

      if (supabaseMode && supabase) {
        const { error } = await supabase
          .from('intranet_chat_conversations')
          .update({ participant_ids: nextIds, updated_at: new Date().toISOString() })
          .eq('id', conversationId);
        if (error) {
          console.error('[chat] removeParticipant', error);
          return false;
        }
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, participantIds: nextIds } : c,
        ),
      );
      return true;
    },
    [conversations, currentUserId, canManageGroup],
  );

  const getGroupFiles = useCallback(
    (conversationId: string): GroupFileItem[] => {
      const items: GroupFileItem[] = [];
      messages
        .filter((m) => m.conversationId === conversationId && m.attachments.length > 0)
        .forEach((m) => {
          m.attachments.forEach((att) => {
            items.push({
              attachment: att,
              messageId: m.id,
              senderId: m.senderId,
              createdAt: m.createdAt,
            });
          });
        });
      return items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
    [messages],
  );

  const getGroupLinks = useCallback(
    (conversationId: string): GroupLinkItem[] => {
      const urlRegex = /https?:\/\/[^\s<>"']+/gi;
      const items: GroupLinkItem[] = [];
      const seen = new Set<string>();
      messages
        .filter((m) => m.conversationId === conversationId && m.content)
        .forEach((m) => {
          const matches = m.content.match(urlRegex);
          if (matches) {
            matches.forEach((url) => {
              const normalized = url.replace(/[.,;:!?)]+$/, '');
              if (!seen.has(normalized)) {
                seen.add(normalized);
                items.push({ url: normalized, senderId: m.senderId, createdAt: m.createdAt });
              }
            });
          }
        });
      return items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
    [messages],
  );

  const value: ChatContextType = {
    conversations,
    messages,
    usesMessagePagination: supabaseMode,
    setActiveConversationId,
    ensureThreadForConversation,
    loadOlderMessages,
    hasMoreOlderMessages,
    loadingOlderMessages,
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
