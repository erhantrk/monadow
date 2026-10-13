import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Droplets,
  Inbox,
  Radio,
  RefreshCw,
  Send,
  UploadCloud,
} from 'lucide-react';
import { Panel, Well } from '@/components/ui/Panel';
import { Button, LinkButton } from '@/components/ui/Button';
import { CopyButton, CopyField } from '@/components/ui/CopyField';
import { QRCode } from '@/components/ui/QRCode';
import { Notice, Skeleton, StatusDot, TxResult, type TxStatus } from '@/components/ui/Status';
import { useSession } from '@/store/session';
import { CountUp } from '@/motion';
import { useBalances } from '@/lib/useBalances';
import { chain, deployment, publicClient } from '@/lib/chain';
import { ASSETS } from '@/lib/tokens';
import { errorMessage, explorerAddress, FAUCET, truncate, truncateMeta } from '@/lib/format';

const MINT_AMOUNT = 100_000_000n; // 100 mUSD (6 dp)

export function HomePage() {
  const keys = useSession((s) => s.keys)!;
  const client = useSession((s) => s.client)!;
  const bal = useBalances(keys.accountAddress);
  const [mint, setMint] = useState<{ status: TxStatus; msg: string; hash?: string } | null>(null);

  const noGas = bal.mon !== null && bal.mon === 0n;

  async function onMint() {
    if (!deployment) return;
    setMint({ status: 'pending', msg: 'Minting 100 mUSD…' });
    try {
      const hash = await client.mintMockUsd(keys.accountAddress, MINT_AMOUNT);
      setMint({ status: 'pending', msg: 'Waiting for confirmation…', hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setMint({ status: 'success', msg: 'Minted 100 mUSD to your account.', hash });
      void bal.refresh();
    } catch (e) {
      setMint({ status: 'error', msg: errorMessage(e) });
    }
  }

  return (
    <div className="m-stagger space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-eyebrow">Your account</div>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-ink-50 sm:text-[28px]">
            Welcome to the shadows
          </h1>
        </div>
        <div className="flex gap-2">
          <Link to="/send">
            <Button variant="primary" icon={<Send className="size-4" />}>
              Send privately
            </Button>
          </Link>
          <Link to="/inbox">
            <Button icon={<Inbox className="size-4" />}>Inbox</Button>
          </Link>
        </div>
      </div>

      {!deployment && (
        <Notice tone="warn">
          Monadow contracts aren’t deployed for chain {chain.id} in this build yet — balances work, but
          sending, minting and publishing are disabled.
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Panel
            eyebrow="Public wallet · from passkey"
            title={
              <span className="flex items-center gap-2 font-mono text-[15px]">
                {truncate(keys.accountAddress, 8, 6)}
                <CopyButton value={keys.accountAddress} label="" />
                <a
                  href={explorerAddress(keys.accountAddress)}
                  target="_blank"
                  rel="noreferrer"
                  title="View on MonadVision"
                  className="text-ink-400 hover:text-mon-300"
                >
                  <ArrowUpRight className="size-4" />
                </a>
              </span>
            }
            action={
              <span className="flex items-center gap-1.5 text-[11px] text-ink-500" title="Polling every 3s">
                <StatusDot state={bal.error ? 'bad' : 'ok'} />
                live
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <BalanceTile symbol="MON" value={bal.mon} decimals={ASSETS.MON.decimals} />
              <BalanceTile symbol="mUSD" value={bal.musd} decimals={ASSETS.mUSD.decimals} disabled={!deployment} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton href={FAUCET} icon={<Droplets className="size-4" />} size="sm">
                Get test MON
              </LinkButton>
              <Button
                size="sm"
                icon={<Coins className="size-4" />}
                onClick={() => void onMint()}
                loading={mint?.status === 'pending'}
                disabled={!deployment || noGas}
                title={noGas ? 'You need a little MON for gas first' : undefined}
              >
                Mint 100 mUSD
              </Button>
              <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={() => void bal.refresh()}>
                Refresh
              </Button>
            </div>
            {noGas && (
              <p className="mt-3 text-xs leading-relaxed text-ink-400">
                Fresh account — grab test MON from the faucet (paste your address above) to pay gas.
              </p>
            )}
            {mint && (
              <div className="mt-4">
                <TxResult status={mint.status} message={mint.msg} txHash={mint.hash} onDismiss={mint.status !== 'pending' ? () => setMint(null) : undefined} />
              </div>
            )}
          </Panel>

          <RegistryPanel monBalance={bal.mon} />
        </div>

        <Panel eyebrow="Receive privately" title="Your stealth meta-address">
          <div className="flex flex-col items-center gap-4">
            <QRCode value={keys.metaAddress} size={176} />
            <p className="text-center text-[12.5px] leading-relaxed text-ink-400">
              Share this. Every payment to it lands at a brand-new address only you can find and spend.
            </p>
            <CopyField value={keys.metaAddress} wrap className="!items-start" />
            <div className="grid w-full grid-cols-2 gap-2 text-[11px]">
              <Well className="!px-3 !py-2">
                <div className="label-eyebrow !text-[9.5px]">Spend pubkey</div>
                <div className="mt-0.5 truncate font-mono text-ink-300">{truncate(keys.spendingPublicKey, 8, 6)}</div>
              </Well>
              <Well className="!px-3 !py-2">
                <div className="label-eyebrow !text-[9.5px]">View pubkey</div>
                <div className="mt-0.5 truncate font-mono text-ink-300">{truncate(keys.viewingPublicKey, 8, 6)}</div>
              </Well>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function BalanceTile({
  symbol,
  value,
  decimals,
  disabled = false,
}: {
  symbol: string;
  value: bigint | null;
  decimals: number;
  disabled?: boolean;
}) {
  return (
    <div className="m-lift rounded-xl border border-ink-700 bg-ink-900 px-4 py-3.5">
      <div className="label-eyebrow">{symbol}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        {disabled ? (
          <span className="font-display text-2xl font-semibold text-ink-600">—</span>
        ) : value === null ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <span className="font-display truncate text-2xl font-semibold tabular-nums text-ink-50 sm:text-[28px]">
            <CountUp value={value} decimals={decimals} />
          </span>
        )}
      </div>
    </div>
  );
}

type RegState = 'checking' | 'none' | 'published' | 'different' | 'error';

function RegistryPanel({ monBalance }: { monBalance: bigint | null }) {
  const keys = useSession((s) => s.keys)!;
  const client = useSession((s) => s.client)!;
  const [state, setState] = useState<RegState>('checking');
  const [tx, setTx] = useState<{ status: TxStatus; msg: string; hash?: string } | null>(null);

  const check = useCallback(async () => {
    if (!deployment) return;
    try {
      const onchain = await client.resolveMetaAddress(keys.accountAddress);
      if (!onchain) setState('none');
      else setState(onchain.toLowerCase().endsWith(keys.metaAddress.slice(-132).toLowerCase()) ? 'published' : 'different');
    } catch {
      setState('error');
    }
  }, [client, keys]);

  useEffect(() => {
    void check();
  }, [check]);

  async function publish() {
    setTx({ status: 'pending', msg: 'Publishing meta-address to the registry…' });
    try {
      const hash = await client.registerMetaAddress(keys.metaAddress);
      setTx({ status: 'pending', msg: 'Waiting for confirmation…', hash });
      await publicClient.waitForTransactionReceipt({ hash });
      setTx({ status: 'success', msg: 'Published. Anyone can now pay your plain 0x address privately.', hash });
      await check();
    } catch (e) {
      setTx({ status: 'error', msg: errorMessage(e) });
    }
  }

  const noGas = monBalance !== null && monBalance === 0n;

  return (
    <Panel
      eyebrow="ERC-6538 registry"
      title="Payable by your 0x address"
      action={<RegBadge state={deployment ? state : 'error'} />}
    >
      <p className="text-[13px] leading-relaxed text-ink-400">
        Publishing links <span className="font-mono text-ink-200">{truncate(keys.accountAddress, 6, 4)}</span> →{' '}
        <span className="font-mono text-ink-200">{truncateMeta(keys.metaAddress)}</span> on-chain, so senders can
        type your normal address and Monadow resolves it to a stealth payment.
      </p>
      {state !== 'published' && (
        <Button
          className="mt-4"
          variant={state === 'none' ? 'primary' : 'secondary'}
          icon={<UploadCloud className="size-4" />}
          onClick={() => void publish()}
          loading={tx?.status === 'pending'}
          disabled={!deployment || noGas || state === 'checking'}
        >
          {state === 'different' ? 'Update meta-address on-chain' : 'Publish meta-address on-chain'}
        </Button>
      )}
      {noGas && state !== 'published' && (
        <p className="mt-2 text-xs text-ink-500">Needs a little MON for gas.</p>
      )}
      {tx && (
        <div className="mt-4">
          <TxResult status={tx.status} message={tx.msg} txHash={tx.hash} onDismiss={tx.status !== 'pending' ? () => setTx(null) : undefined} />
        </div>
      )}
    </Panel>
  );
}

function RegBadge({ state }: { state: RegState }) {
  const map: Record<RegState, { cls: string; label: string; icon: ReactNode }> = {
    checking: { cls: 'border-ink-600 text-ink-400', label: 'Checking', icon: <StatusDot state="wait" /> },
    none: { cls: 'border-signal-wait/40 text-signal-wait', label: 'Not published', icon: <Radio className="size-3" /> },
    published: { cls: 'border-signal-ok/40 text-signal-ok', label: 'Published', icon: <CheckCircle2 className="size-3" /> },
    different: { cls: 'border-signal-wait/40 text-signal-wait', label: 'Outdated', icon: <Radio className="size-3" /> },
    error: { cls: 'border-ink-600 text-ink-500', label: 'Unavailable', icon: <StatusDot state="idle" /> },
  };
  const m = map[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  );
}
