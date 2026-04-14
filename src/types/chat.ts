/** Estado da mensagem: enviada, entregue, lida */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export type ConversationType = 'private' | 'group';

/** Anexo (mock: url pode ser data URL ou object URL) */
export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: number;
  content: string;
  createdAt: string;
  /** Marcador local de edição (não persistido no DB atualmente). */
  editedAt?: string;
  /** Reply metadata (persistido via campo `attachments` no Supabase). */
  replyTo?: {
    messageId: string;
    senderId: number;
    senderName?: string;
    contentSnippet: string;
  };
  forwardedFrom?: {
    messageId: string;
    senderId: number;
    senderName?: string;
    contentSnippet: string;
  };
  status: MessageStatus;
  /** IDs dos utilizadores que já leram (para status read) */
  readBy: number[];
  attachments: ChatAttachment[];
  pinned: boolean;
  pinnedAt?: string;
  pinnedById?: number;
}

export interface ChatConversation {
  id: string;
  type: ConversationType;
  name: string | null;
  participantIds: number[];
  createdAt: string;
  createdById: number;
}

/** Utilizador no chat (espelho de Usuario para listagens) */
export interface ChatUser {
  id: number;
  nome: string;
  email: string;
  avatar: string;
}
