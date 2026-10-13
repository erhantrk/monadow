import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  adornment?: ReactNode;
  mono?: boolean;
  labelAction?: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  adornment,
  mono = false,
  labelAction,
  className = '',
  id,
  ...rest
}: FieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="label-eyebrow block">
          {label}
        </label>
        {labelAction}
      </div>
      <div
        className={`flex items-center rounded-xl border bg-ink-900 transition-colors ${
          error ? 'border-signal-bad/60' : 'border-ink-700 focus-within:border-mon-500'
        }`}
      >
        <input
          {...rest}
          id={inputId}
          className={`h-12 w-full min-w-0 flex-1 bg-transparent px-3.5 text-sm text-ink-50 placeholder:text-ink-500 focus:outline-none ${
            mono ? 'font-mono tracking-tight' : ''
          }`}
        />
        {adornment && <div className="shrink-0 pr-2">{adornment}</div>}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-signal-bad">{error}</p>
      ) : hint ? (
        <div className="mt-2 text-xs leading-relaxed text-ink-400">{hint}</div>
      ) : null}
    </div>
  );
}
