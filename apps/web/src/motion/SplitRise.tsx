import type { CSSProperties } from 'react';

/**
 * Hero entrance: each character rises out of a clipped line with a stagger
 * (Shade wordmark: yPercent 130 → 0, power4.out, 55ms stagger). CSS-only.
 */
export function SplitRise({
  text,
  className = '',
  delay = 150,
  stagger = 40,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(' ');
  let i = 0;
  return (
    <span className={`m-split ${className}`} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} className="m-split-word" aria-hidden>
          {[...w].map((ch) => {
            const style = { '--d': `${delay + i++ * stagger}ms` } as CSSProperties;
            return (
              <span key={i} className="m-split-ch" style={style}>
                {ch}
              </span>
            );
          })}
          {wi < words.length - 1 && <span className="m-split-ch">&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}
