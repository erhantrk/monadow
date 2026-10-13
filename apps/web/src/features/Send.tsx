import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, ClipboardPaste, EyeOff, Loader2, Send as SendIcon, XCircle } from 'lucide-react';
import { isAddress, parseUnits, type Address, type Hash } from 'viem';
import { decodeMetaAddress } from 'monadow-sdk';
import { Panel, Well } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { CopyButton } from '@/components/ui/CopyField';
import { Notice } from '@/components/ui/Status';
import { ScrambleText, SeverBurst } from '@/motion';
import { useSession } from '@/store/session';
import { useBalances } from '@/lib/useBalances';
import { deployment, publicClient } from '@/lib/chain';
import { ASSETS, type AssetId } from '@/lib/tokens';
import { errorMessage, explorerAddress, explorerTx, formatAmount, truncate, truncateMeta } from '@/lib/format';

type Resolution =
  | { state: 'empty' }
  | { state: 'checking' }
  | { state: 'ok'; meta: string; via: 'meta' | 'registry'; address?: Address }
  | { state: 'error'; message: string };

/** Native gas headroom kept back when sending "max" MON. */
const MON_HEADROOM = parseUnits('0.05', 18);
/** Tip forwarded with token sends so the stealth address can pay its own withdraw gas. */
const TOKEN_GAS_TIP = parseUnits('0.02', 18);

function useRecipient(input: string): Resolution {
  const client = useSession((s) => s.client);
  const [res, setRes] = useState<Resolution>({ state: 'empty' });

  useEffect(() => {
    const v = input.trim();
    if (!v) return setRes({ state: 'empty' });
    if (/^st:/i.test(v)) {
      try {
        decodeMetaAddress(v);
        setRes({ state: 'ok', meta: v, via: 'meta' });
      } catch {
        setRes({ state: 'error', message: 'Not a valid stealth meta-address (expected st:monad:0x + 66 bytes).' });
      }
      return;
    }
    if (!isAddress(v)) {
      setRes(
        v.startsWith('0x') && v.length < 42
          ? { state: 'checking' }
          : { state: 'error', message: 'Enter a st:monad:… meta-address or a 0x address.' },
      );
      return;
    }
    if (!client || !deployment) return setRes({ state: 'error', message: 'Registry unavailable.' });
    setRes({ state: 'checking' });
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const meta = await client.resolveMetaAddress(v as Address);
        if (cancelled) return;
        setRes(
          meta
            ? { state: 'ok', meta, via: 'registry', address: v as Address }
            : {
                state: 'error',
                message: 'This address hasn’t published a meta-address. Ask them for their st:monad:… string.',
              },
        );
      } catch (e) {
        if (!cancelled) setRes({ state: 'error', message: errorMessage(e) });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [input, client]);

  return res;
}

type Sent = { hash: Hash; stealthAddress: Address; amount: string; asset: AssetId; to: string; ms: number };

export function SendPage() {
  const keys = useSession((s) => s.keys)!;
  const client = useSession((s) => s.client)!;
  const bal = useBalances(keys.accountAddress);
  const [recipient, setRecipient] = useState('');
  const [asset, setAsset] = useState<AssetId>('MON');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<null | 'signing' | 'confirming'>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const res = useRecipient(recipient);

  const meta = ASSETS[asset];
  const balance = asset === 'MON' ? bal.mon : bal.musd;

  const parsed = useMemo(() => {
    if (!amount) return null;
    try {
      const v = parseUnits(amount as `${number}`, meta.decimals);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount, meta.decimals]);

  const amountError = (() => {
    if (!amount) return null;
    if (parsed === null) return 'Enter a positive amount.';
    if (balance !== null && parsed > balance) return `Exceeds your ${meta.symbol} balance.`;
    if (asset === 'mUSD' && bal.mon !== null && bal.mon < TOKEN_GAS_TIP) return 'Need ~0.03 MON for gas + the stealth gas tip.';
    return null;
  })();

  const isSelf = res.state === 'ok' && res.meta.toLowerCase().endsWith(keys.metaAddress.slice(-132).toLowerCase());
  const canSend = res.state === 'ok' && parsed !== null && !amountError && !busy && Boolean(deployment);

  function setMax() {
    if (balance === null) return;
    const v = asset === 'MON' ? (balance > MON_HEADROOM ? balance - MON_HEADROOM : 0n) : balance;
    setAmount(formatAmount(v, meta.decimals, meta.decimals).replace(/,/g, ''));
  }

  async function onSend() {
    if (res.state !== 'ok' || parsed === null || !deployment) return;
    setError(null);
    setBusy('signing');
    const t0 = performance.now();
    try {
      const out =
        asset === 'MON'
          ? await client.sendNative(res.meta, parsed)
          : await client.sendToken(res.meta, deployment.mockUsd, parsed, TOKEN_GAS_TIP);
      setBusy('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: out.hash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted.');
      setSent({
        hash: out.hash,
        stealthAddress: out.stealthAddress,
        amount,
        asset,
        to: res.via === 'registry' && res.address ? res.address : res.meta,
        ms: performance.now() - t0,
      });
      void bal.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (sent) return <SentCard sent={sent} onReset={() => { setSent(null); setAmount(''); setRecipient(''); }} />;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <div className="label-eyebrow">Send</div>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-ink-50 sm:text-[28px]">
          Pay someone privately
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-400">
          Funds go to a fresh one-time address derived from their meta-address. Observers see a payment — not who
          received it.
        </p>
      </div>

      <Panel bodyClassName="p-5 space-y-5">
        <Field
          label="Recipient"
          placeholder="st:monad:0x… or 0x…"
          mono
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          error={res.state === 'error' ? res.message : null}
          adornment={
            <button
              type="button"
              onClick={async () => {
                try {
                  setRecipient((await navigator.clipboard.readText()).trim());
                } catch {
                  /* clipboard denied */
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-400 hover:bg-ink-800 hover:text-mon-300"
            >
              <ClipboardPaste className="size-3.5" /> Paste
            </button>
          }
          hint={
            res.state === 'checking' ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" /> Looking up the registry…
              </span>
            ) : res.state === 'ok' ? (
              <span className="flex items-center gap-1.5 text-signal-ok">
                <CheckCircle2 className="size-3.5" />
                {res.via === 'registry' ? (
                  <>
                    Registered → <span className="font-mono">{truncateMeta(res.meta)}</span>
                  </>
                ) : (
                  'Valid stealth meta-address'
                )}
                {isSelf && <span className="text-ink-400">(that’s you)</span>}
              </span>
            ) : (
              'Paste a meta-address, or any 0x address that published one on-chain.'
            )
          }
        />

        <div>
          <div className="label-eyebrow mb-2">Asset</div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-ink-700 bg-ink-900 p-1">
            {(['MON', 'mUSD'] as AssetId[]).map((a) => {
              const b = a === 'MON' ? bal.mon : bal.musd;
              const active = a === asset;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAsset(a)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-mon-500/15 ring-1 ring-mon-500/60' : 'hover:bg-ink-800'
                  }`}
                >
                  <span className={`text-sm font-semibold ${active ? 'text-ink-50' : 'text-ink-300'}`}>{a}</span>
                  <span className="font-mono text-[11px] text-ink-400">
                    {b === null ? '…' : formatAmount(b, ASSETS[a].decimals)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="Amount"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          error={amountError}
          adornment={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={setMax}
                className="rounded-md border border-ink-600 px-2 py-0.5 text-[11px] font-medium text-ink-300 hover:border-mon-500 hover:text-mon-300"
              >
                MAX
              </button>
              <span className="pr-1 text-sm font-semibold text-ink-300">{meta.symbol}</span>
            </div>
          }
          hint={asset === 'mUSD' ? 'Includes a 0.02 MON tip to the stealth address so it can pay its own withdraw gas.' : undefined}
        />

        {error && <Notice tone="bad">{error}</Notice>}
        {!deployment && <Notice tone="warn">Contracts not deployed in this build — sending disabled.</Notice>}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!canSend}
          loading={busy !== null}
          icon={<SendIcon className="size-4" />}
          onClick={() => void onSend()}
        >
          {busy === 'signing' ? 'Signing (no prompt)…' : busy === 'confirming' ? 'Confirming on Monad…' : 'Send privately'}
        </Button>
        <p className="-mt-2 text-center text-[11.5px] text-ink-500">
          Signed by your open Mera session — no passkey prompt needed.
        </p>
      </Panel>
    </div>
  );
}

function SentCard({ sent, onReset }: { sent: Sent; onReset: () => void }) {
  return (
    <div className="animate-m-page mx-auto max-w-xl">
      <Panel bodyClassName="p-6 sm:p-7">
        <SeverBurst />
        <div className="flex items-center gap-3">
          <span className="animate-m-ripple flex size-10 items-center justify-center rounded-full bg-signal-ok/15 text-signal-ok">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <div className="label-eyebrow">Sent privately · {(sent.ms / 1000).toFixed(1)}s</div>
            <div className="font-display text-2xl font-bold text-ink-50">
              {sent.amount} {ASSETS[sent.asset].symbol}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Well>
            <div className="label-eyebrow mb-1">To</div>
            <div className="truncate font-mono text-[12.5px] text-ink-200">
              {sent.to.startsWith('st:') ? truncateMeta(sent.to) : sent.to}
            </div>
          </Well>
          <Well className="border-mon-500/40 bg-mon-500/5">
            <div className="label-eyebrow mb-1 flex items-center gap-1.5">
              <EyeOff className="size-3" /> One-time stealth address
            </div>
            <div className="flex items-center gap-2">
              <a
                href={explorerAddress(sent.stealthAddress)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate font-mono text-[12.5px] text-mon-200 hover:underline"
              >
                <ScrambleText text={sent.stealthAddress} delay={700} frames={18} />
              </a>
              <CopyButton value={sent.stealthAddress} />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
              Never used before, never reused. Only the recipient’s view key can tell it’s theirs.
            </p>
          </Well>
          <a
            href={explorerTx(sent.hash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-[13px] text-ink-200 transition-colors hover:border-mon-500/50"
          >
            <span>
              <span className="label-eyebrow mb-1 block">Transaction</span>
              <span className="font-mono">{truncate(sent.hash, 12, 10)}</span>
            </span>
            <ArrowUpRight className="size-4 text-ink-400" />
          </a>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" className="flex-1" onClick={onReset} icon={<SendIcon className="size-4" />}>
            Send another
          </Button>
          <Link to="/home" className="flex-1">
            <Button className="w-full" icon={<XCircle className="size-4" />}>
              Done
            </Button>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
