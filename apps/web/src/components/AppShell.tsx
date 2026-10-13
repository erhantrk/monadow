import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Inbox, Lock, Send, Sparkles } from 'lucide-react';
import { useSession } from '@/store/session';
import { MonadowMark } from './Logo';
import { HowItWorksModal } from './HowItWorks';
import { StatusDot } from './ui/Status';

const NAV = [
  { to: '/home', label: 'Home', Icon: Home },
  { to: '/send', label: 'Send', Icon: Send },
  { to: '/inbox', label: 'Inbox', Icon: Inbox },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [howOpen, setHowOpen] = useState(false);
  const inboxCount = useSession((s) => s.scan?.payments.filter((p) => p.balance > 0n).length ?? 0);

  return (
    <div className="relative min-h-screen bg-ink-950">
      <div className="backdrop-umbra" />
      <div className="backdrop-hex" />

      <header className="sticky top-0 z-30 border-b border-ink-700/80 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-3 px-4 sm:px-6">
          <NavLink to="/home" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Monadow home">
            <MonadowMark className="size-7 text-mon-500" />
            <span className="font-display text-[17px] font-bold tracking-tight text-ink-50">Monadow</span>
            <span className="hidden rounded-full border border-ink-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-400 sm:inline">
              testnet
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 rounded-xl border border-ink-700 bg-ink-900/70 p-1 md:flex">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    isActive ? 'bg-mon-500/15 text-ink-50' : 'text-ink-400 hover:text-ink-100'
                  }`
                }
              >
                <Icon className="size-4" />
                {label}
                {to === '/inbox' && inboxCount > 0 && <Badge n={inboxCount} />}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setHowOpen(true)}
              className="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-ink-400 transition-colors hover:text-ink-100"
            >
              <Sparkles className="size-4" />
              How it works
            </button>
          </nav>

          <SessionPill />
        </div>
      </header>

      <main
        key={location.pathname}
        className="animate-m-page relative z-10 mx-auto w-full max-w-[1080px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-12"
      >
        {children}
      </main>

      <footer className="relative z-10 mx-auto hidden max-w-[1080px] px-6 pb-8 text-xs text-ink-500 md:block">
        Monadow on Monad testnet · keys live only in memory for this tab · experimental, do not use with real value.
      </footer>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? 'text-mon-300' : 'text-ink-400'
                }`
              }
            >
              <span className="relative">
                <Icon className="size-5" />
                {to === '/inbox' && inboxCount > 0 && (
                  <span className="absolute -right-2 -top-1.5">
                    <Badge n={inboxCount} />
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setHowOpen(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-ink-400"
          >
            <Sparkles className="size-5" />
            How
          </button>
        </div>
      </nav>

      <HowItWorksModal open={howOpen} onClose={() => setHowOpen(false)} />
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-mon-500 px-1 text-[10px] font-semibold leading-4 text-white">
      {n}
    </span>
  );
}

function SessionPill() {
  const lock = useSession((s) => s.lock);
  const navigate = useNavigate();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div
        className="flex h-9 items-center gap-2 rounded-xl border border-signal-ok/30 bg-signal-ok/5 px-3 text-[12px] text-ink-200"
        title="A Mera signing session holds your account key in memory: transactions sign without further passkey prompts until you lock."
      >
        <StatusDot state="ok" />
        <span className="hidden sm:inline">
          Signing session active <span className="text-ink-500">·</span>{' '}
          <span className="text-signal-ok">prompt-free</span>
        </span>
        <span className="sm:hidden">Session active</span>
      </div>
      <button
        type="button"
        onClick={() => {
          lock();
          navigate('/', { replace: true });
        }}
        title="End signing sessions and wipe keys from memory"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-600 px-2.5 text-[13px] text-ink-300 transition-colors hover:border-mon-500/60 hover:text-ink-50"
      >
        <Lock className="size-4" />
        <span className="hidden sm:inline">Lock</span>
      </button>
    </div>
  );
}
