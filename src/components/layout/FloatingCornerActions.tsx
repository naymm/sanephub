import { ChatFloatingButton } from './ChatFloatingButton';
import { GestaoDocumentosFloatingButton } from './GestaoDocumentosFloatingButton';
import { PontoFloatingButton } from './PontoFloatingButton';
import { cn } from '@/lib/utils';

/**
 * Canto inferior direito: coluna vertical (ponto → chat → pasta).
 * Em mobile: sem botão de chat (só desktop); ponto e gestão documental mantêm-se.
 * Posiciona-se acima da barra de navegação tipo PWA.
 */
export function FloatingCornerActions() {
  return (
    <div
      className={cn(
        'pointer-events-none fixed z-40 flex flex-col items-end gap-3 max-md:z-[55]',
        'right-[max(1rem,env(safe-area-inset-right))]',
        'bottom-[max(1rem,env(safe-area-inset-bottom))]',
        'max-md:bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]',
      )}
    >
      <div className="pointer-events-auto">
        <PontoFloatingButton />
      </div>
      <div className="pointer-events-auto hidden md:block">
        <ChatFloatingButton />
      </div>
      <div className="pointer-events-auto">
        <GestaoDocumentosFloatingButton />
      </div>
    </div>
  );
}
