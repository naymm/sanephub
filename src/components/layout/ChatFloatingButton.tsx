import { NavLink, useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { cn } from '@/lib/utils';

/**
 * Botão flutuante (canto inferior direito) para abrir o chat em qualquer página.
 * Em mobile não é mostrado — o chat fica na navegação; o canto fica para ponto / documentos.
 */
export function ChatFloatingButton() {
  const { user } = useAuth();
  const { getUnreadCount } = useChat();
  const location = useLocation();
  const unread = getUnreadCount();

  if (!user || !hasModuleAccess(user, 'dashboard')) return null;
  if (location.pathname === '/chat') return null;

  return (
    <NavLink
      to="/chat"
      className={({ isActive }) =>
        cn(
          'relative z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all',
          'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )
      }
      aria-label={unread > 0 ? `Chat, ${unread} mensagens não lidas` : 'Abrir chat'}
      title="Chat"
    >
      <MessageCircle className="h-6 w-6" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </NavLink>
  );
}
