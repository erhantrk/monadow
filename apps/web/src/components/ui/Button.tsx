import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'm-shine bg-mon-500 text-white font-semibold shadow-[0_8px_24px_-10px_rgb(131_110_249/0.8)] hover:bg-mon-400 active:bg-mon-600 disabled:bg-ink-700 disabled:text-ink-400 disabled:shadow-none',
  secondary:
    'border border-ink-600 bg-ink-900/40 text-ink-100 hover:border-mon-500/60 hover:bg-ink-800 disabled:text-ink-500 disabled:hover:border-ink-600 disabled:hover:bg-transparent',
  ghost:
    'text-ink-300 hover:text-ink-50 hover:bg-ink-800 disabled:text-ink-600 disabled:hover:bg-transparent',
  danger:
    'border border-signal-bad/50 text-signal-bad hover:bg-signal-bad/10 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-[15px] rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={`m-press inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** Anchor styled like a Button — for external links (faucet, explorer). */
export function LinkButton({
  href,
  children,
  icon,
  variant = 'secondary',
  size = 'md',
  className = '',
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`m-press inline-flex items-center justify-center gap-2 whitespace-nowrap ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {icon}
      {children}
    </a>
  );
}
