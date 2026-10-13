import type { CSSProperties } from 'react';

/**
 * View-key scan: a grid of one-time outputs with a light band sweeping across;
 * each column flickers as the band passes and one cell fills in as "yours".
 * Ported from the Shade landing's view-key chapter (scroll-scrubbed GSAP there,
 * a looping CSS animation here so it can stand in for a loading state).
 */
export function ScanSweep({
  cols = 10,
  rows = 3,
  label = 'Scanning announcements with your view key',
  className = '',
}: {
  cols?: number;
  rows?: number;
  label?: string;
  className?: string;
}) {
  const target = { c: Math.floor(cols * 0.62), r: 1 };
  const period = 2.4;
  return (
    <div className={`m-scan ${className}`} role="status" aria-label={label}>
      <div className="m-scan-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows * cols }, (_, k) => {
          const c = k % cols;
          const r = Math.floor(k / cols);
          const style = { '--d': `${(c / cols) * period * 0.8}s`, '--p': `${period}s` } as CSSProperties;
          const hit = c === target.c && r === target.r;
          return (
            <div key={k} className={`m-scan-sq ${hit ? 'is-hit' : ''}`} style={style}>
              {hit && <i />}
            </div>
          );
        })}
      </div>
      <div className="m-scan-band" style={{ '--p': `${period}s` } as CSSProperties} />
      <div className="m-scan-label">
        <span className="m-scan-dot" /> {label}
      </div>
    </div>
  );
}
