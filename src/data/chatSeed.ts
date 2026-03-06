import type { ChatConversation, ChatMessage } from '@/types/chat';

/** Conversas iniciais mockadas: 1 privada (Pedro + Maria), 1 grupo (Equipa TI) */
export const CHAT_CONVERSATIONS_SEED: ChatConversation[] = [
  {
    id: 'conv-1',
    type: 'private',
    name: null,
    participantIds: [7, 2],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    createdById: 7,
  },
  {
    id: 'conv-2',
    type: 'group',
    name: 'Equipa Tecnologia',
    participantIds: [7, 3, 1],
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    createdById: 1,
  },
];

/** Mensagens iniciais mockadas */
export const CHAT_MESSAGES_SEED: ChatMessage[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 2,
    content: 'Olá Pedro! Quando podes rever o documento de requisitos?',
    createdAt: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
    status: 'read',
    readBy: [7, 2],
    attachments: [],
    pinned: false,
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderId: 7,
    content: 'Olá Maria! Posso terminar até amanhã. @Maria Silva obrigado pelo envio.',
    createdAt: new Date(Date.now() - 86400000 * 2 + 7200000).toISOString(),
    status: 'read',
    readBy: [7, 2],
    attachments: [],
    pinned: false,
  },
  {
    id: 'msg-3',
    conversationId: 'conv-1',
    senderId: 2,
    content: 'Perfeito, fico à espera.',
    createdAt: new Date(Date.now() - 86400000 * 2 + 10800000).toISOString(),
    status: 'delivered',
    readBy: [2],
    attachments: [],
    pinned: false,
  },
  {
    id: 'msg-4',
    conversationId: 'conv-2',
    senderId: 1,
    content: 'Bom dia equipa. Lembrete: reunião de sprint às 10h. @Pedro Santos @João Costa',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'read',
    readBy: [7, 3, 1],
    attachments: [],
    pinned: true,
    pinnedAt: new Date().toISOString(),
    pinnedById: 1,
  },
  {
    id: 'msg-5',
    conversationId: 'conv-2',
    senderId: 7,
    content: 'Presente!',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    status: 'read',
    readBy: [7, 3, 1],
    attachments: [],
    pinned: false,
  },
];
