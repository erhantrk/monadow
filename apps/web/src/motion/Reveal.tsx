import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { prefersReducedMotion } from './useReducedMotion';

/**
 * Reveal-on-scroll: content rises 14px and fades in once it crosses 88% of the
 * viewport (the Shade landing's `.rev` + ScrollTrigger "top 88%" contract),
 * done with one IntersectionObserver instead of GSAP.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
  once = true,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          if (once) io.disconnect();
        } else if (!once) setShown(false);
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  const style: CSSProperties = { transitionDelay: shown ? `${delay}ms` : '0ms' };
  return (
    <Tag ref={ref} style={style} className={`m-rev ${shown ? 'is-in' : ''} ${className}`}>
      {children}
    </Tag>
  );
}
