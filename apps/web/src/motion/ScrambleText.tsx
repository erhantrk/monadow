import { useEffect, useState } from 'react';
import { prefersReducedMotion, seeded } from './useReducedMotion';

const HEX = '0123456789abcdef';

/**
 * Address scramble: characters churn and lock in left-to-right-ish until the
 * final string resolves (Shade's recipient → one-time address frames, quadratic
 * lock-in). Separators like 0x, … and spaces are kept stable.
 */
export function ScrambleText({
  text,
  from,
  frames = 14,
  frameMs = 45,
  delay = 0,
  className = '',
}: {
  text: string;
  from?: string;
  frames?: number;
  frameMs?: number;
  delay?: number;
  className?: string;
}) {
  const [out, setOut] = useState(() => (prefersReducedMotion() ? text : (from ?? text)));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setOut(text);
      return;
    }
    const rnd = seeded(text.length * 7919 + 17);
    const base = (from ?? text).padEnd(text.length).slice(0, text.length).split('');
    const target = text.split('');
    const keep = (c: string) => c === ' ' || c === '…' || c === '.' || c === 'x' || c === ':';
    let f = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      f++;
      if (f >= frames) {
        setOut(text);
        return;
      }
      const t = f / frames;
      setOut(
        target
          .map((ch, i) => {
            if (keep(ch)) return ch;
            if (rnd() < t * t) return ch;
            return rnd() < 0.6 ? HEX[Math.floor(rnd() * 16)] : base[i];
          })
          .join(''),
      );
      timer = setTimeout(tick, frameMs);
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [text, from, frames, frameMs, delay]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}
