import type { ReactNode } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { explorerTx } from '@/lib/format';
import { truncate } from '@/lib/format';

export type TxStatus = 'pending' | 'success' | 'error';

export function StatusDot({
  state,
  className = '',
}: {
  state: 'ok' | 'wait' | 'bad' | 'idle';
  className?: string;
}) {
  const color =
    state === 'ok'
      ? 'bg-signal-ok shadow-[0_0_8px_rgb(95_211_160/0.8)]'
      : state === 'wait'
        ? 'bg-signal-wait animate-m-pulse'
        : state === 'bad'
          ? 'bg-signal-bad'
          : 'bg-ink-600';
  return <span className={`inline-block size-1.5 shrink-0 rounded-full ${color} ${className}`} />;
}

export function TxResult({
  status,
  message,
  txHash,
  onDismiss,
}: {
  status: TxStatus;
  message: ReactNode;
  txHash?: string;
  onDismiss?: () => void;
}) {
  const tone =
    status === 'success'
      ? 'border-signal-ok/40 bg-signal-ok/5 text-signal-ok'
      : status === 'error'
        ? 'border-signal-bad/40 bg-signal-bad/5 text-signal-bad'
        : 'border-mon-500/40 bg-mon-500/5 text-mon-300';
  const Icon = status === 'success' ? CheckCircle2 : status === 'error' ? XCircle : Loader2;
  return (
    <div className={`animate-m-rise flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${status === 'pending' ? 'animate-spin' : ''}`} />
      <div className="min-w-0 flex-1">
        <div className="leading-relaxed break-words">{message}</div>
        {txHash && (
          <a
            href={explorerTx(txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 font-mono text-xs text-ink-300 underline decoration-ink-600 underline-offset-2 hover:text-mon-300"
          >
            {truncate(txHash, 10, 8)}
            <ArrowUpRight className="size-3" />
          </a>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-ink-500 hover:text-ink-100"
          aria-label="Dismiss"
        >
          <XCircle className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Notice({
  tone = 'warn',
  children,
}: {
  tone?: 'warn' | 'info' | 'bad';
  children: ReactNode;
}) {
  const styles =
    tone === 'warn'
      ? 'border-signal-wait/40 bg-signal-wait/5 text-signal-wait'
      : tone === 'bad'
        ? 'border-signal-bad/40 bg-signal-bad/5 text-signal-bad'
        : 'border-ink-700 bg-ink-900 text-ink-300';
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${styles}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`relative overflow-hidden rounded-md bg-ink-800 animate-m-sheen ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-500">{icon}</div>}
      <p className="text-sm font-medium text-ink-100">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
