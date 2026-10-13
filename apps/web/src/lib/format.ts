import { formatUnits } from 'viem';

export const EXPLORER = 'https://testnet.monadvision.com';
export const FAUCET = 'https://faucet.monad.xyz';

export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${EXPLORER}/address/${addr}`;

export function truncate(value: string, head = 6, tail = 4): string {
  if (!value) return '';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** st:monad:0x<66 bytes> is long; keep the prefix + head/tail. */
export function truncateMeta(meta: string): string {
  const i = meta.indexOf('0x');
  if (i < 0) return truncate(meta, 12, 8);
  return `${meta.slice(0, i + 8)}…${meta.slice(-8)}`;
}

/** Human amount with sensible precision (max 6 significant decimals). */
export function formatAmount(value: bigint, decimals: number, maxFrac = 4): string {
  const s = formatUnits(value, decimals);
  const [int, frac = ''] = s.split('.');
  const intFmt = Number(int).toLocaleString('en-US');
  const f = frac.slice(0, maxFrac).replace(/0+$/, '');
  if (!f && value > 0n && int === '0') {
    // tiny but nonzero
    return `<0.${'0'.repeat(maxFrac - 1)}1`;
  }
  return f ? `${intFmt}.${f}` : intFmt;
}

export function errorMessage(e: unknown): string {
  if (!e) return 'Unknown error';
  const anyE = e as { shortMessage?: string; message?: string; details?: string };
  const msg = anyE.shortMessage || anyE.message || String(e);
  // viem errors are verbose; keep the first meaningful line.
  return msg.split('\n')[0].slice(0, 280);
}
