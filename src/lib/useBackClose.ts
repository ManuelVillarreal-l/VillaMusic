import { useEffect, useRef } from 'react';

/**
 * En el celular, el botón «Atrás» debe cerrar el panel abierto (Descubrir, letras, DJ)
 * en vez de sacar a la persona de la app.
 */
export function useBackClose(open: boolean, close: () => void): void {
  const pushed = useRef(false);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (open && !pushed.current) {
      history.pushState({ vmPanel: true }, '');
      pushed.current = true;
    } else if (!open && pushed.current) {
      pushed.current = false;
      if ((history.state as { vmPanel?: boolean } | null)?.vmPanel) history.back();
    }
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
