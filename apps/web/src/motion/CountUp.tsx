import { useEffect, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import { formatAmount } from '@/lib/format';
import { prefersReducedMotion } from './useReducedMotion';

const fmt = (n: number, maxFrac: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: maxFrac, minimumFractionDigits: 0 });

/**
 * Balance count-up: eases from the previous value to the new one (expo-out,
 * ~0.9s) and lands on the exact `formatAmount` string, so the final figure is
 * never a float approximation. Only display; the bigint is untouched.
 */
export function CountUp({
  value,
  decimals,
  maxFrac = 4,
  duration = 900,
  className = '',
}: {
  value: bigint;
  decimals: number;
  maxFrac?: number;
  duration?: number;
  className?: string;
}) {
  const final = formatAmount(value, decimals, maxFrac);
  const prev = useRef<number>(0);
  const [text, setText] = useState(() => (prefersReducedMotion() ? final : fmt(0, maxFrac)));

  useEffect(() => {
    const to = Number(formatUnits(value, decimals));
    const from = prev.current;
    if (prefersReducedMotion() || from === to || !Number.isFinite(to)) {
      prev.current = to;
      setText(final);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      prev.current = from + (to - from) * e;
      if (p < 1) {
        setText(fmt(prev.current, maxFrac));
        raf = requestAnimationFrame(step);
      } else setText(final);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals, maxFrac, duration, final]);

  return <span className={`tabular-nums ${className}`}>{text}</span>;
}
