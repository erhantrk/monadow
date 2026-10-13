import { useMemo } from 'react';
import { seeded } from './useReducedMotion';

const OPS = ['transfer', 'transfer', 'transfer', 'swap', 'approve', 'announce'];
const HEX = '0123456789abcdef';

function rows(seed: number, n: number) {
  const rnd = seeded(seed);
  const hex = (k: number) => Array.from({ length: k }, () => HEX[Math.floor(rnd() * 16)]).join('');
  const out: { block: number; op: string; from: string; to: string; amt: string; sym: string }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      block: 31_480_000 + Math.floor(rnd() * 9000),
      op: OPS[Math.floor(rnd() * OPS.length)],
      from: `0x${hex(4)}…${hex(4)}`,
      to: `0x${hex(4)}…${hex(4)}`,
      amt: (rnd() * 480 + 0.5).toFixed(1),
      sym: rnd() < 0.7 ? 'MON' : 'mUSD',
    });
  }
  return out;
}

/**
 * Ambient public-ledger drift: columns of plain, linkable transfers scroll by
 * behind the hero — the "everything is visible" world Monadow hides you from.
 * Ported from the Shade landing's ticker columns (doubled content, seamless
 * translateY(-50%) loop); pure CSS transform so it stays on the compositor.
 * Extra columns hide on phones; frozen under reduced motion.
 */
export function LedgerDrift({ columns = 3, rowsPerColumn = 24, className = '' }: { columns?: number; rowsPerColumn?: number; className?: string }) {
  const cols = useMemo(
    () => Array.from({ length: columns }, (_, c) => rows(0x5eed + c * 97, rowsPerColumn)),
    [columns, rowsPerColumn],
  );
  return (
    <div aria-hidden className={`m-ledger pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {cols.map((list, c) => (
        <div
          key={c}
          className={`m-ledger-col m-ledger-c${c + 1}`}
          style={{ animationDuration: `${46 + (c % 4) * 9}s` }}
        >
          {[0, 1].map((dup) =>
            list.map((r, i) => (
              <div key={`${dup}-${i}`} className="m-ledger-row">
                {r.block} · {r.op} · <b>{r.from}</b> → <b>{r.to}</b> · {r.amt} {r.sym}
              </div>
            )),
          )}
        </div>
      ))}
      <div className="m-ledger-mask" />
    </div>
  );
}
