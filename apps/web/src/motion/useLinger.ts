import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a transient flag (e.g. "scanning") true for at least `minMs` once it
 * turns on, so a fast operation still gets its full animation beat instead of
 * a one-frame flash. Display-only: it never delays the underlying work.
 */
export function useLinger(active: boolean, minMs = 1200): boolean {
  const [shown, setShown] = useState(active);
  const since = useRef(0);
  useEffect(() => {
    if (active) {
      since.current = performance.now();
      setShown(true);
      return;
    }
    const left = minMs - (performance.now() - since.current);
    if (left <= 0) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(false), left);
    return () => clearTimeout(t);
  }, [active, minMs]);
  return shown;
}
