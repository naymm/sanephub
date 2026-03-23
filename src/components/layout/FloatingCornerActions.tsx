import { ChatFloatingButton } from './ChatFloatingButton';
import { GestaoDocumentosFloatingButton } from './GestaoDocumentosFloatingButton';

/**
 * Empilha o botão de documentos acima do botão de chat (canto inferior direito).
 */
export function FloatingCornerActions() {
  return (
    <div
      className="pointer-events-none fixed z-40 flex flex-col-reverse gap-3"
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        right: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="pointer-events-auto">
        <ChatFloatingButton />
      </div>
      <div className="pointer-events-auto">
        <GestaoDocumentosFloatingButton />
      </div>
    </div>
  );
}
