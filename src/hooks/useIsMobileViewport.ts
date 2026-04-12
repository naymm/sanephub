import { useEffect, useState } from 'react';

/** Alinhado ao breakpoint `md` do Tailwind (768px). */
const QUERY = '(max-width: 767px)';

export function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
