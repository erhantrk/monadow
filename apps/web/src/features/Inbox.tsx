import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpRight, Inbox as InboxIcon, RefreshCw, ScanLine, Wallet } from 'lucide-react';
import { isAddress, zeroAddress, type Address, type Hash } from 'viem';
import type { ReceivedPayment } from 'monadow-sdk';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { CopyButton } from '@/components/ui/CopyField';
import { EmptyState, Notice, Skeleton, TxResult, type TxStatus } from '@/components/ui/Status';
import { useSession } from '@/store/session';
import { ScanSweep, useLinger } from '@/motion';
import { deployment, publicClient } from '@/lib/chain';
import { assetForToken } from '@/lib/tokens';
import { stealthSigner } from '@/lib/passkey';
import { PrivateNote } from './PrivateNote';
import { errorMessage, explorerAddress, formatAmount, truncate } from '@/lib/format';

export function InboxPage() {
  const keys = useSession((s) => s.keys)!;
  const client = useSession((s) => s.client)!;
  const scan = useSession((s) => s.scan);
  const setScan = useSession((s) => s.setScan);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sweep = useLinger(scanning, 1600);

  const runScan = useCallback(async () => {
    if (!deployment) return;
    setScanning(true);
    setError(null);
    try {
      const t0 = performance.now();
      const [payments, count] = await Promise.all([client.scan(keys), client.announcementCount()]);
      const ms = performance.now() - t0;
      payments.sort((a, b) => Number(b.index - a.index));
      setScan({ payments, scannedCount: Number(count), ms, at: Date.now() });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setScanning(false);
    }
  }, [client, keys, setScan]);

  useEffect(() => {
    if (!scan) void runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unclaimed = scan?.payments.filter((p) => p.balance > 0n) ?? [];
  const totals = new Map<string, { symbol: string; decimals: number; sum: bigint }>();
  for (const p of unclaimed) {
    const a = assetForToken(p.token);
    const t = totals.get(a.symbol) ?? { symbol: a.symbol, decimals: a.decimals, sum: 0n };
    t.sum += p.balance;
    totals.set(a.symbol, t);
  }

  return (
    <div className="m-stagger space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-eyebrow">Inbox</div>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-ink-50 sm:text-[28px]">
            Payments only you can see
          </h1>
          <p className="mt-1.5 text-[13px] text-ink-400">
            {scan
              ? `Scanned ${scan.scannedCount.toLocaleString()} announcements in ${Math.round(scan.ms)} ms with your view key.`
              : scanning
                ? 'Scanning on-chain announcements…'
                : 'Scan on-chain announcements with your view key.'}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<RefreshCw className={`size-4 ${scanning ? 'animate-spin' : ''}`} />}
          disabled={scanning || !deployment}
          onClick={() => void runScan()}
        >
          {scanning ? 'Scanning…' : 'Scan again'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat
          icon={<ScanLine className="size-4" />}
          label="Scanned"
          value={scan ? scan.scannedCount.toLocaleString() : scanning ? null : '—'}
          sub={scan ? `in ${Math.round(scan.ms)} ms · view key only` : 'reads via eth_call'}
        />
        <Stat
          icon={<InboxIcon className="size-4" />}
          label="For you"
          value={scan ? String(scan.payments.length) : scanning ? null : '—'}
          sub={scan ? `${unclaimed.length} unclaimed` : ''}
        />
        <Stat
          icon={<Wallet className="size-4" />}
          label="Claimable"
          value={
            scan
              ? totals.size
                ? [...totals.values()].map((t) => `${formatAmount(t.sum, t.decimals)} ${t.symbol}`).join(' · ')
                : '0'
              : scanning
                ? null
                : '—'
          }
          sub="sitting at one-time addresses"
        />
      </div>

      {error && <Notice tone="bad">Scan failed: {error}</Notice>}

      <Panel eyebrow="Received" title="Stealth payments" bodyClassName="p-0">
        {sweep && <ScanSweep className={scan ? 'border-b border-ink-700 !py-4' : ''} rows={scan ? 2 : 3} />}
        {!scan && scanning ? (
          <div className="space-y-3 px-5 pb-5">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : scan && scan.payments.length === 0 ? (
          <EmptyState
            icon={<InboxIcon className="size-8" />}
            title="Nothing here yet"
            description={
              <>
                Share your meta-address from <Link to="/home" className="text-mon-300 underline">Home</Link>, or
                send yourself a payment from <Link to="/send" className="text-mon-300 underline">Send</Link> to see it
                land here.
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {scan?.payments.map((p) => <PaymentRow key={String(p.index)} p={p} onDone={() => void runScan()} />)}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string | null; sub?: string }) {
  return (
    <div className="m-lift min-w-0 rounded-2xl border border-ink-700 bg-ink-850/80 px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="label-eyebrow flex items-center gap-1.5 max-sm:!text-[9px] max-sm:!tracking-wider">
        <span className="text-mon-400 max-sm:hidden">{icon}</span>
        {label}
      </div>
      <div className="font-display mt-1.5 truncate text-xl font-semibold tabular-nums text-ink-50">
        {value === null ? <Skeleton className="h-7 w-20" /> : value}
      </div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-ink-500 max-sm:text-[10px]">{sub}</div>}
    </div>
  );
}

type WState =
  | { s: 'idle' }
  | { s: 'open' }
  | { s: 'busy'; msg: string; hash?: Hash }
  | { s: 'done'; hash: Hash; extra?: Hash; to: Address }
  | { s: 'error'; msg: string };

function PaymentRow({ p, onDone }: { p: ReceivedPayment; onDone: () => void }) {
  const keys = useSession((s) => s.keys)!;
  const client = useSession((s) => s.client)!;
  const trackSession = useSession((s) => s.trackSession);
  const [w, setW] = useState<WState>({ s: 'idle' });
  const [dest, setDest] = useState<'me' | 'custom'>('me');
  const [custom, setCustom] = useState('');

  const asset = assetForToken(p.token);
  const isNative = p.token.toLowerCase() === zeroAddress;
  const claimed = p.balance === 0n;
  const customValid = isAddress(custom.trim());
  const to = (dest === 'me' ? keys.accountAddress : custom.trim()) as Address;

  async function withdraw() {
    setW({ s: 'busy', msg: 'Waiting for Monad’s 3-block reserve window, then signing with the one-time key…' });
    try {
      // Each stealth key gets its own transient Mera signing session, ended
      // right after signing (and tracked so Lock can end it too).
      const accountFactory = (pk: `0x${string}`) => {
        const { account, end } = stealthSigner(pk);
        return { account, end: trackSession(end) };
      };
      if (isNative) {
        const hash = await client.withdraw(p, to, { accountFactory });
        setW({ s: 'busy', msg: 'Confirming…', hash });
        await publicClient.waitForTransactionReceipt({ hash });
        setW({ s: 'done', hash, to });
      } else {
        const r = await client.withdrawAll(p, to, { accountFactory });
        setW({ s: 'done', hash: r.tokenHash!, extra: r.nativeHash, to });
      }
      onDone();
    } catch (e) {
      setW({ s: 'error', msg: errorMessage(e) });
    }
  }

  return (
    <li className="animate-m-flash px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-[11px] font-bold ${
            isNative ? 'bg-mon-500/15 text-mon-300' : 'bg-signal-ok/10 text-signal-ok'
          }`}
        >
          {asset.symbol.slice(0, 4)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[17px] font-semibold tabular-nums text-ink-50">
              {formatAmount(p.amount, asset.decimals)} {asset.symbol}
            </span>
            {claimed ? (
              <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[10px] text-ink-400">withdrawn</span>
            ) : (
              <span className="rounded-full border border-signal-ok/40 px-2 py-0.5 text-[10px] text-signal-ok">unclaimed</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-ink-400">
            <a
              href={explorerAddress(p.stealthAddress)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono hover:text-mon-300"
            >
              {truncate(p.stealthAddress, 8, 6)} <ArrowUpRight className="size-3" />
            </a>
            <CopyButton value={p.stealthAddress} />
            <span>block {p.blockNumber.toString()}</span>
            {!isNative && <span>+{formatAmount(p.nativeBalance, 18)} MON gas</span>}
          </div>
        </div>
        {!claimed && w.s === 'idle' && (
          <Button size="sm" icon={<ArrowDownToLine className="size-4" />} onClick={() => setW({ s: 'open' })} className="max-sm:w-full">
            Withdraw
          </Button>
        )}
      </div>

      <PrivateNote subject={p.stealthAddress} />

      {w.s === 'open' && (
        <div className="animate-m-rise mt-4 space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <DestOption active={dest === 'me'} onClick={() => setDest('me')} title="My account" sub={truncate(keys.accountAddress, 8, 6)} />
            <DestOption active={dest === 'custom'} onClick={() => setDest('custom')} title="Custom address" sub="any 0x address" />
          </div>
          {dest === 'custom' && (
            <Field
              label="Destination"
              mono
              placeholder="0x…"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              error={custom && !customValid ? 'Not a valid address' : null}
            />
          )}
          {dest === 'me' && (
            <p className="text-[11.5px] leading-relaxed text-ink-500">
              Tip: withdrawing to your public account links this payment to it on-chain. A fresh custom address keeps
              it private.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={dest === 'custom' && !customValid} onClick={() => void withdraw()} icon={<ArrowDownToLine className="size-4" />}>
              Withdraw {isNative ? 'all' : `${formatAmount(p.balance, asset.decimals)} ${asset.symbol}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setW({ s: 'idle' })}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {w.s === 'busy' && (
        <div className="mt-3">
          <TxResult status="pending" message={w.msg} txHash={w.hash} />
        </div>
      )}
      {w.s === 'done' && (
        <div className="mt-3 space-y-2">
          <TxResult
            status="success"
            message={
              <span className="flex items-center gap-1.5">
                
                Withdrawn to <span className="font-mono">{truncate(w.to, 8, 6)}</span>
              </span>
            }
            txHash={w.hash}
          />
          {w.extra && <TxResult status="success" message="Leftover MON gas tip swept too." txHash={w.extra} />}
        </div>
      )}
      {w.s === 'error' && (
        <div className="mt-3">
          <TxResult status={'error' as TxStatus} message={w.msg} onDismiss={() => setW({ s: 'open' })} />
        </div>
      )}
    </li>
  );
}

function DestOption({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active ? 'border-mon-500 bg-mon-500/10' : 'border-ink-700 hover:border-ink-600'
      }`}
    >
      <div className="text-[13px] font-medium text-ink-50">{title}</div>
      <div className="font-mono text-[11px] text-ink-400">{sub}</div>
    </button>
  );
}
