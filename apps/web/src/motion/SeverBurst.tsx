import { useMemo, type CSSProperties } from 'react';
import { seeded } from './useReducedMotion';

/**
 * Payment-sent celebration: a purple link draws itself, snaps in the middle,
 * and shatters into fragments that fly out and fade — the sender/recipient
 * link severed. Ported from the Shade landing's severance chapter (42
 * fragments, seeded spread) as a one-shot CSS animation. Hidden under reduced
 * motion.
 */
export function SeverBurst({ fragments = 28, className = '' }: { fragments?: number; className?: string }) {
  const frags = useMemo(() => {
    const rnd = seeded(0x5e4e);
    return Array.from({ length: fragments }, () => ({
      x: (rnd() - 0.5) * 360,
      y: (rnd() - 0.5) * 150 - 10,
      r: (rnd() - 0.5) * 540,
      s: 0.4 + rnd() * 1.1,
      round: rnd() < 0.35,
    }));
  }, [fragments]);
  return (
    <div aria-hidden className={`m-burst ${className}`}>
      <div className="sever-line">
        <span />
        <span />
      </div>
      <div className="m-burst-origin">
        {frags.map((f, i) => (
          <i
            key={i}
            className={f.round ? 'is-round' : ''}
            style={{ '--x': `${f.x}px`, '--y': `${f.y}px`, '--r': `${f.r}deg`, '--s': f.s } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
