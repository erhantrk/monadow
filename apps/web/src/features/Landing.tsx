import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Fingerprint, KeyRound, Plus } from 'lucide-react';
import { MonadowMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Status';
import { HowItWorksDiagram } from '@/components/HowItWorks';
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

type Busy = null | 'get' | 'create';

export function Landing({ redirectTo = '/home' }: { redirectTo?: string }) {
  const unlock = useSession((s) => s.unlock);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ kind: PasskeyErrorKind; message: string } | null>(null);
  const [prf, setPrf] = useState<boolean | null>(null);
  const [hasHint] = useState(() => Boolean(getCredentialHint()));
  const available = webAuthnAvailable();

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

      <div className="relative z-10 mx-auto max-w-[1080px] px-4 sm:px-6">
        <header className="flex h-16 items-center justify-between">
          <span className="font-display flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-ink-50">
            <MonadowMark className="size-7 text-mon-500" />
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
        </header>

        <section className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-mon-500/40 bg-mon-500/10 px-3 py-1 text-[12px] text-mon-200">
              <span className="size-1.5 rounded-full bg-mon-400" /> Live on Monad testnet
            </div>
            <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight text-ink-50 sm:text-[56px]">
              Private payments.
              <br />
              <span className="text-mon-400">One passkey.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-300">
              Monadow sends funds to one-time stealth addresses on Monad. Your wallet, stealth keys and vault
              key all come from a single passkey — no seed phrase, no extension, nothing stored.
            </p>

            <div className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
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
        </section>

        <section className="pb-20">
          <div className="mb-6 text-center">
            <div className="label-eyebrow">How it works</div>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-ink-50 sm:text-3xl">
              One passkey, many keys
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed text-ink-400">
              One WebAuthn PRF evaluation gives a 32-byte root. HKDF splits it into independent, purpose-bound
              keys — each namespace can’t reveal another.
            </p>
          </div>
          <HowItWorksDiagram />
        </section>
      </div>
    </div>
  );
}

/** Large animated mark with orbiting stealth "addresses". */
function HeroArt() {
  return (
    <div className="relative mx-auto hidden aspect-square w-full max-w-[380px] lg:block" aria-hidden>
      <div className="absolute inset-[12%] rounded-full bg-mon-500/20 blur-3xl" />
      <div className="absolute inset-0 rounded-full border border-ink-700" />
      <div className="absolute inset-[16%] rounded-full border border-dashed border-ink-600/70" />
      <MonadowMark animate className="absolute inset-[28%] text-mon-500 drop-shadow-[0_0_30px_rgb(131_110_249/0.5)]" />
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
          <div className="label-eyebrow mb-0.5 !text-[9px]">one-time address</div>
          {c.t}
        </div>
      ))}
    </div>
  );
}
