import { ChatFloatingButton } from './ChatFloatingButton';
import { GestaoDocumentosFloatingButton } from './GestaoDocumentosFloatingButton';
import { PontoFloatingButton } from './PontoFloatingButton';

/**
 * Canto inferior direito: fila com marcação de ponto + chat; acima, gestão documental.
 */
export function FloatingCornerActions() {
  return (
    <div
      className="pointer-events-none fixed z-40 flex flex-col-reverse items-end gap-3"
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        right: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="pointer-events-auto flex flex-row items-center gap-3">
        <PontoFloatingButton />
        <ChatFloatingButton />
      </div>
      <div className="pointer-events-auto">
        <GestaoDocumentosFloatingButton />
      </div>
    </div>
  );
}
