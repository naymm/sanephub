import { ChatFloatingButton } from './ChatFloatingButton';
import { GestaoDocumentosFloatingButton } from './GestaoDocumentosFloatingButton';
import { PontoFloatingButton } from './PontoFloatingButton';

/**
 * Canto inferior direito: uma coluna vertical (ponto → chat → pasta, de cima para baixo no ecrã).
 */
export function FloatingCornerActions() {
  return (
    <div
      className="pointer-events-none fixed z-40 flex flex-col items-end gap-3"
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        right: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="pointer-events-auto">
        <PontoFloatingButton />
      </div>
      <div className="pointer-events-auto">
        <ChatFloatingButton />
      </div>
      <div className="pointer-events-auto">
        <GestaoDocumentosFloatingButton />
      </div>
    </div>
  );
}
