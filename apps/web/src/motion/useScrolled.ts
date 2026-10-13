import { useEffect, useState } from 'react';

/** True once the page has scrolled past `threshold` px (Shade header `.solid` toggle). */
export function useScrolled(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}
