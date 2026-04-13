import { useEffect, useState } from 'react';
import { isStandalonePwa } from '@/lib/pwaDisplayMode';

/**
 * Teclado software em iPhone reduz o visual viewport tipicamente ~250–340px.
 * Valores 80–150px são frequentemente UI do Safari/PWA, não teclado — geram `bottom` errado
 * e faixa branca por baixo do compositor (hit-testing desalinhado).
 */
const MIN_KEYBOARD_SHRINK_SAFARI_TAB = 220;
/** PWA “Adicionar ao ecrã inicial” reporta por vezes encolhimento menor; threshold alto deixa inset=0 e o compositor desalinhado (toques falham). */
const MIN_KEYBOARD_SHRINK_STANDALONE = 140;

/**
 * Offset do fundo do layout até ao fundo do visual viewport (teclado).
 * Só > 0 quando o encolhimento é compatível com teclado aberto.
 */
export function useVisualViewportBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const ih = window.innerHeight;
      const ch = document.documentElement?.clientHeight ?? ih;
      const shrink = ih - vv.height;
      const standalone = isStandalonePwa();
      const minShrink = standalone ? MIN_KEYBOARD_SHRINK_STANDALONE : MIN_KEYBOARD_SHRINK_SAFARI_TAB;
      const isKeyboardOpen = shrink >= minShrink;

      if (!isKeyboardOpen) {
        setInset(0);
        return;
      }

      const a = Math.max(0, Math.round(ih - vv.height - vv.offsetTop));
      const b = Math.max(0, Math.round(ch - vv.height - vv.offsetTop));
      const raw = Math.max(a, b);
      // Evita valores absurdos se algum browser reportar mal as métricas
      setInset(Math.min(raw, Math.round(ih * 0.55)));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return inset;
}
