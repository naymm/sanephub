/**
 * No viewport estreito: anula o centro do Radix Dialog (left 50% + translate -50%)
 * e as animações slide/zoom que deslocam o painel; o conteúdo fica colado ao ecrã.
 * (Mesmo padrão que `MobileCreateFormDialogContent`.)
 */
export const PREVIEW_DIALOG_MOBILE = [
  'max-md:fixed max-md:inset-0 max-md:left-0 max-md:right-0 max-md:top-0 max-md:bottom-0',
  'max-md:flex max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:min-h-0 max-md:w-full max-md:min-w-0 max-md:max-w-none',
  'max-md:!translate-x-0 max-md:!translate-y-0',
  'max-md:gap-0 max-md:overflow-x-hidden max-md:overflow-y-hidden max-md:rounded-none max-md:border-0 max-md:p-0',
  'max-md:data-[state=closed]:slide-out-to-top-[0%] max-md:data-[state=open]:slide-in-from-top-[0%]',
  'max-md:data-[state=closed]:zoom-out-100 max-md:data-[state=open]:zoom-in-100',
].join(' ');

export const PREVIEW_HEADER_SAFE_TOP = 'max-md:pt-[max(0.5rem,env(safe-area-inset-top,0px))] max-md:px-4';

export const PREVIEW_FOOTER_SAFE_BOTTOM =
  'max-md:pb-[max(1rem,env(safe-area-inset-bottom,0px))] max-md:px-4';

/** Evita que filhos flex (iframe / scroll) forçem largura acima do ecrã. */
export const PREVIEW_BODY_FLEX_CHAIN = 'min-w-0 min-h-0 flex-1 flex flex-col overflow-hidden';
