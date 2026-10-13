import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Fingerprint, KeyRound, Plus } from 'lucide-react';
import { MonadowMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Status';
import { LandingStory } from './LandingStory';
import {
  createNewPasskey,
  describePasskeyError,
  getCredentialHint,
  probePrfSupport,
  unlockWithExistingPasskey,
  webAuthnAvailable,
  type PasskeyErrorKind,
} from '@/lib/passkey';
import { useSession } from '@/store/session';
import { LedgerDrift, Lens, ScrambleText, ScrollCue, SplitRise, useScrolled } from '@/motion';

type Busy = null | 'get' | 'create';

export function Landing({ redirectTo = '/home' }: { redirectTo?: string }) {
  const unlock = useSession((s) => s.unlock);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ kind: PasskeyErrorKind; message: string } | null>(null);
  const [prf, setPrf] = useState<boolean | null>(null);
  const [hasHint] = useState(() => Boolean(getCredentialHint()));
  const available = webAuthnAvailable();
  const scrolled = useScrolled(24);

  useEffect(() => {
    void probePrfSupport().then(setPrf);
  }, []);

  async function run(mode: 'get' | 'create') {
    setBusy(mode);
    setError(null);
    try {
      let res;
      try {
        res = mode === 'get' ? await unlockWithExistingPasskey() : await createNewPasskey();
      } catch (e) {
        // A stale credential hint (passkey deleted) shouldn't block the picker.
        if (mode === 'get' && hasHint && describePasskeyError(e).kind === 'cancelled') {
          res = await unlockWithExistingPasskey(false);
        } else throw e;
      }
      unlock(res);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(describePasskeyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-950">
      <div className="backdrop-umbra" />
      <div className="backdrop-hex" />
      <div className="absolute inset-x-0 top-0 h-[100svh]">
        <LedgerDrift />
      </div>
      <Lens />

      <header
        className={`sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ${
          scrolled ? 'border-ink-700/80 bg-ink-950/80 backdrop-blur-md' : 'border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-4 sm:px-6">
          <span className="font-display flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-ink-50">
            <MonadowMark animate className="size-7 text-mon-500" />
            Monadow
          </span>
          <a
            href="https://mera.category.xyz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-mon-300"
          >
            Built on Mera <ArrowUpRight className="size-3" />
          </a>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1080px] px-4 sm:px-6">
        <section className="relative grid items-center gap-10 py-10 sm:py-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <div className="animate-m-rise mb-5 inline-flex items-center gap-2 rounded-full border border-mon-500/40 bg-mon-500/10 px-3 py-1 text-[12px] text-mon-200">
              <span className="animate-m-pulse size-1.5 rounded-full bg-mon-400" /> Live on Monad testnet
              <span className="text-mon-500/60">·</span>
              <a href="https://mera.category.xyz" target="_blank" rel="noreferrer" className="font-semibold text-mon-100 hover:text-white">
                Powered by Mera
              </a>
            </div>
            <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight text-ink-50 sm:text-[56px]">
              <SplitRise text="Private payments." delay={120} stagger={28} />
              <br />
              <SplitRise text="One passkey." delay={560} stagger={34} className="text-mon-400" />
            </h1>
            <p className="animate-m-rise mt-5 max-w-md [animation-delay:700ms] text-[15px] leading-relaxed text-ink-300">
              Monadow sends funds to one-time stealth addresses on Monad. Your wallet, stealth keys and vault
              key all come from a single passkey — no seed phrase, no extension, nothing stored.
            </p>

            <div className="animate-m-rise mt-8 flex max-w-md flex-col gap-3 [animation-delay:850ms] sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                className={`w-full sm:flex-1 ${busy === 'get' ? 'animate-m-halo' : ''}`}
                loading={busy === 'get'}
                disabled={!available || busy !== null}
                icon={<Fingerprint className="size-5" />}
                onClick={() => void run('get')}
              >
                {busy === 'get' ? 'Waiting for passkey…' : 'Continue with passkey'}
              </Button>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                loading={busy === 'create'}
                disabled={!available || busy !== null}
                icon={<Plus className="size-4" />}
                onClick={() => void run('create')}
              >
                Create new passkey
              </Button>
            </div>

            <div className="mt-4 max-w-md space-y-3">
              {!available && (
                <Notice tone="bad">
                  Passkeys need a secure context and a WebAuthn-capable browser. Open this page over https in
                  Chrome, Safari or Edge.
                </Notice>
              )}
              {available && prf === false && !error && (
                <Notice tone="warn">
                  This browser reports no WebAuthn PRF support. Use Chrome or Safari with iCloud Keychain,
                  Google Password Manager, or 1Password.
                </Notice>
              )}
              {error && (
                <Notice tone={error.kind === 'prf' ? 'bad' : 'warn'}>
                  {error.message}
                  {error.kind === 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => void run('create')}
                      className="mt-1.5 block font-medium text-mon-300 underline underline-offset-2"
                    >
                      Create a new passkey instead
                    </button>
                  )}
                </Notice>
              )}
              <p className="flex items-center gap-2 text-[12px] text-ink-500">
                <KeyRound className="size-3.5" />
                {hasHint
                  ? 'Welcome back — one prompt rebuilds your account.'
                  : 'First time? Create a passkey. Returning on a new device? Continue — synced passkeys work.'}
              </p>
            </div>
          </div>

          <HeroArt />
          <ScrollCue className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 lg:flex" />
        </section>

      </div>

      <LandingStory
        onPasskey={() => void run('get')}
        busy={busy === 'get'}
        disabled={!available || busy !== null}
      />

      <section className="relative mx-auto flex max-w-2xl flex-col items-center px-4 pb-24 pt-8 text-center">
        <MonadowMark animate className="mb-6 size-12 text-mon-500 drop-shadow-[0_0_24px_rgb(131_110_249/0.5)]" />
        <h2 className="text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">Ready to get paid privately?</h2>
        <p className="mt-3 text-[15px] text-ink-300">One passkey prompt. No seed phrase, no extension.</p>
        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            className={`w-full sm:flex-1 ${busy === 'get' ? 'animate-m-halo' : ''}`}
            loading={busy === 'get'}
            disabled={!available || busy !== null}
            icon={<Fingerprint className="size-5" />}
            onClick={() => void run('get')}
          >
            {busy === 'get' ? 'Waiting for passkey…' : 'Continue with passkey'}
          </Button>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            loading={busy === 'create'}
            disabled={!available || busy !== null}
            icon={<Plus className="size-4" />}
            onClick={() => void run('create')}
          >
            Create new passkey
          </Button>
        </div>
        {error && (
          <div className="mt-4 w-full max-w-md text-left">
            <Notice tone={error.kind === 'prf' ? 'bad' : 'warn'}>{error.message}</Notice>
          </div>
        )}
        <a
          href="https://mera.category.xyz"
          target="_blank"
          rel="noreferrer"
          className="mt-6 text-[12px] text-ink-500 hover:text-mon-300"
        >
          Built on Monad · Powered by Mera ↗
        </a>
      </section>
    </div>
  );
}

/** Large animated mark with orbiting stealth "addresses". */
function HeroArt() {
  return (
    <div className="relative mx-auto hidden aspect-square w-full max-w-[380px] lg:block" aria-hidden>
      <div className="animate-m-breathe absolute inset-[12%] rounded-full bg-mon-500/20 blur-3xl" />
      <div className="animate-m-orbit absolute inset-0 rounded-full border border-ink-700">
        <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mon-400 shadow-[0_0_12px_rgb(131_110_249/0.9)]" />
      </div>
      <div className="animate-m-orbit-rev absolute inset-[16%] rounded-full border border-dashed border-ink-600/70" />
      <MonadowMark animate className="animate-m-fade absolute inset-[28%] text-mon-500 drop-shadow-[0_0_30px_rgb(131_110_249/0.5)]" />
      {[
        { t: '0x7a3f…e19c', pos: 'left-[-4%] top-[20%]' },
        { t: '0xc04b…22d1', pos: 'right-[-6%] top-[38%]' },
        { t: '0x19ee…a7f0', pos: 'left-[8%] bottom-[8%]' },
      ].map((c, i) => (
        <div
          key={c.t}
          className={`animate-m-rise absolute ${c.pos} rounded-xl border border-ink-600 bg-ink-850/90 px-3 py-2 font-mono text-[11px] text-ink-300 shadow-xl`}
          style={{ animationDelay: `${400 + i * 180}ms` }}
        >
          <div className="animate-m-float" style={{ animationDelay: `${i * -2}s` }}>
            <div className="label-eyebrow mb-0.5 !text-[9px]">one-time address</div>
            <ScrambleText text={c.t} delay={600 + i * 220} frames={16} />
          </div>
        </div>
      ))}
    </div>
  );
}
