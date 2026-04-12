import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Acima de Radix Dialog/Sheet (z-50), primeiro acesso (z-200), PIN unlock (z-100), toasts (~100)
 * e possíveis camadas invisíveis — evita toques “mortos” no botão Enviar no iOS.
 * Abaixo apenas do splash inicial (z-5000) enquanto visível.
 */
const Z_INDEX = 999_999;

export type ChatMobileComposerPortalProps = {
  children: ReactNode;
  /** Offset do fundo do visual viewport (teclado / Safari); 0 cola ao fundo do viewport real */
  bottomInset?: number;
};

/**
 * Compositor do chat em mobile: **sempre** em `document.body`, fora de árvores com `overflow`,
 * para `position: fixed` e hit-testing corretos no iOS/WebKit.
 */
export function ChatMobileComposerPortal({
  children,
  bottomInset = 0,
}: ChatMobileComposerPortalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="pointer-events-auto fixed inset-x-0"
      style={{ bottom: bottomInset, zIndex: Z_INDEX }}
      data-sanep-mobile-chat-composer=""
    >
      {children}
    </div>,
    document.body,
  );
}

/** Alias alinhado ao padrão “ChatInput” em portal (mesmo componente). */
export const ChatInput = ChatMobileComposerPortal;
