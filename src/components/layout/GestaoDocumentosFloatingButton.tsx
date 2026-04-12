import { NavLink, useLocation } from 'react-router-dom';
import { FolderArchive } from 'lucide-react';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

/**
 * Botão flutuante para Gestão documental (canto inferior direito, abaixo do ponto e do chat).
 */
export function GestaoDocumentosFloatingButton() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || !hasModuleAccess(user, 'gestao-documentos')) return null;
  if (location.pathname === '/gestao-documentos' || location.pathname.startsWith('/gestao-documentos/')) {
    return null;
  }

  return (
    <NavLink
      to="/gestao-documentos"
      className={({ isActive }) =>
        cn(
          'relative z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all',
          'bg-card text-primary ring-1 ring-primary/30 hover:bg-primary/10 hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )
      }
      aria-label="Gestão documental"
      title="Gestão documental"
    >
      <FolderArchive className="h-6 w-6" />
    </NavLink>
  );
}
