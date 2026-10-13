import { useId } from 'react';

/** Monadow mark: a hexagon (Monad) with a crescent shadow eclipsing its core. */
export function MonadowMark({ className = '', animate = false }: { className?: string; animate?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M16 3.2 27.1 9.6v12.8L16 28.8 4.9 22.4V9.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <mask id={`m-${id}`}>
        <rect width="32" height="32" fill="#fff" />
        <circle cx="19.4" cy="13.4" r="5.7" fill="#000" className={animate ? 'animate-m-eclipse' : ''} />
      </mask>
      <circle cx="16" cy="16" r="6.8" fill="currentColor" mask={`url(#m-${id})`} />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display flex items-center gap-2 font-bold tracking-tight text-ink-50 ${className}`}>
      <MonadowMark className="size-6 text-mon-500" />
      Monadow
    </span>
  );
}
