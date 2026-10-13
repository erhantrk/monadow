import type { ReactNode } from 'react';

/** The one surface primitive: rounded, hairline border, optional header rail. */
export function Panel({
  eyebrow,
  title,
  action,
  children,
  className = '',
  bodyClassName = 'p-5',
}: {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`relative rounded-2xl border border-ink-700 bg-ink-850/80 backdrop-blur-sm ${className}`}
    >
      {(eyebrow || title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-ink-700 px-5 py-3.5">
          <div className="min-w-0">
            {eyebrow && <div className="label-eyebrow">{eyebrow}</div>}
            {title && (
              <h2 className="font-display mt-0.5 text-base leading-snug font-semibold text-ink-50">
                {title}
              </h2>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Well({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 ${className}`}>
      {children}
    </div>
  );
}
