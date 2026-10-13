import { useCallback, useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [value]);
  return { copied, copy };
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { copied, copy } = useCopy(value);
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied' : `Copy ${label ?? 'value'}`}
      className="inline-flex items-center gap-1.5 rounded-md p-1 text-ink-400 transition-colors hover:text-mon-300"
    >
      {copied ? <Check className="size-3.5 text-signal-ok" /> : <Copy className="size-3.5" />}
      {label && <span className="text-xs">{copied ? 'Copied' : label}</span>}
    </button>
  );
}

export function CopyField({
  value,
  display,
  className = '',
  wrap = false,
}: {
  value: string;
  display?: string;
  className?: string;
  wrap?: boolean;
}) {
  const { copied, copy } = useCopy(value);
  return (
    <button
      type="button"
      onClick={copy}
      title="Click to copy"
      className={`group flex w-full items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-left transition-colors hover:border-mon-500/50 ${className}`}
    >
      <span
        className={`min-w-0 font-mono text-[12.5px] tracking-tight text-ink-100 ${
          wrap ? 'break-all' : 'truncate'
        }`}
      >
        {display ?? value}
      </span>
      {copied ? (
        <Check className="size-4 shrink-0 text-signal-ok" />
      ) : (
        <Copy className="size-4 shrink-0 text-ink-500 transition-colors group-hover:text-mon-300" />
      )}
    </button>
  );
}
