import { ArrowDown, Eye as EyeIcon, Fingerprint, KeyRound, Lock, RefreshCw, ScanLine, Send, Shield, Wallet } from 'lucide-react';
import { useSession } from '@/store/session';
import { truncate } from '@/lib/format';
import { Modal } from './ui/Modal';
import type { ReactNode } from 'react';

type Branch = {
  info: string;
  title: string;
  role: string;
  icon: ReactNode;
  live?: string | null;
};

/**
 * "One passkey, many keys": the whole account layer drawn as a tree.
 * When unlocked, each leaf shows the live public value it produced.
 */
export function HowItWorksDiagram({ compact = false, scripted = false }: { compact?: boolean; scripted?: boolean }) {
  const keys = useSession((s) => s.keys);

  const branches: Branch[] = [
    {
      info: 'monadow/account/v1',
      title: 'Account key',
      role: 'Your public Monad wallet, as a Mera signing session → viem account.',
      icon: <Wallet className="size-4" />,
      live: keys ? truncate(keys.accountAddress, 8, 6) : null,
    },
    {
      info: 'monadow/stealth/spend/v1',
      title: 'Stealth spend key',
      role: 'Combined with each payment’s shared secret to unlock the one-time address funds land in.',
      icon: <KeyRound className="size-4" />,
      live: keys ? truncate(keys.spendingPublicKey, 8, 6) : null,
    },
    {
      info: 'monadow/stealth/view/v1',
      title: 'Stealth view key',
      role: 'Scans announcements for payments meant for you. Can’t move funds.',
      icon: <EyeIcon className="size-4" />,
      live: keys ? truncate(keys.viewingPublicKey, 8, 6) : null,
    },
    {
      info: 'monadow/vault/v1',
      title: 'Vault key',
      role: 'AES-GCM key sealing your private notes. Only ciphertext is stored.',
      icon: <Lock className="size-4" />,
      live: keys ? 'AES-256 · in memory' : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Root: passkey → PRF */}
      <div className="flex flex-col items-center">
        <div className="flex w-full max-w-sm flex-col items-stretch gap-2">
          <RootCard
            className="hiw-root"
            icon={<Fingerprint className="size-5" />}
            eyebrow="1 · Mera ceremony"
            title="One passkey"
            body="Face ID / Touch ID / security key. Never leaves your device."
          />
          <div className="hiw-root flex justify-center text-mon-400">
            <ArrowDown className="size-5" />
          </div>
          <RootCard
            className="hiw-root"
            icon={<Shield className="size-5" />}
            eyebrow="2 · WebAuthn PRF"
            title="32-byte root"
            body={
              <>
                <span className="font-mono text-[11px] text-mon-300">prf(sha256("monadow.prf.root.v1"))</span>
                <span className="hiw-hex mt-1 block break-all font-mono text-[10.5px] text-ink-400">
                  9f3a0c7e51d28b4f6a1e93c05d7b28e4f1a6c39d08e72b5a4c1f96e3d0b78a25
                </span>
                Deterministic per passkey, never stored.
              </>
            }
            accent
          />
        </div>

        {/* Fan-out connector */}
        <div className="relative mt-1 hidden h-10 w-full lg:block" aria-hidden>
          <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 1000 40" preserveAspectRatio="none">
            {[125, 375, 625, 875].map((x) => (
              <path
                key={x}
                className="hiw-branch"
                d={`M500 0 V20 H${x} V40`}
                fill="none"
                stroke="rgb(131 110 249 / 0.6)"
                strokeWidth="1"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset="0"
              />
            ))}
          </svg>
          <div className="hiw-hkdf absolute left-1/2 top-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-mon-500/50 bg-ink-950 px-2.5 py-0.5 font-mono text-[10px] text-mon-300">HKDF-SHA256</div>
        </div>
        <div className="mt-2 flex items-center gap-2 lg:hidden" aria-hidden>
          <ArrowDown className="size-5 text-mon-400" />
        </div>
        <div className="label-eyebrow -mt-1 mb-3 text-center lg:hidden">3 · HKDF-SHA256 namespaces</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {branches.map((b, i) => (
          <div
            key={b.info}
            className={`hiw-leaf flex flex-col rounded-2xl border border-ink-700 bg-ink-850 p-4 ${scripted ? '' : 'animate-m-rise'}`}
            style={scripted ? undefined : { animationDelay: `${120 + i * 70}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-mon-500/15 text-mon-300">
                {b.icon}
              </span>
              <span className="font-display text-[14px] font-semibold text-ink-50">{b.title}</span>
            </div>
            <div className="mt-3 rounded-md bg-ink-900 px-2 py-1 font-mono text-[11px] text-mon-300">
              HKDF · {b.info}
            </div>
            <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-ink-300">{b.role}</p>
            {b.live && (
              <div className="mt-3 flex items-center gap-1.5 border-t border-ink-700 pt-2.5 font-mono text-[11px] text-signal-ok">
                <span className="size-1.5 rounded-full bg-signal-ok" />
                {b.live}
              </div>
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <>
          <div className="hiw-step rounded-2xl border border-ink-700 bg-ink-900/60 p-4 sm:p-5">
            <div className="label-eyebrow mb-3">A private payment, end to end</div>
            <ol className="grid gap-3 sm:grid-cols-3">
              <Step icon={<Send className="size-4" />} n={1} title="Sender derives a one-time address">
                From your <span className="font-mono text-mon-300">st:monad:</span> meta-address (ERC-5564,
                secp256k1). Funds go straight to a fresh EOA nobody can link to you.
              </Step>
              <Step icon={<ScanLine className="size-4" />} n={2} title="You scan with the view key">
                Announcements are read via <span className="font-mono">eth_call</span>; a 1-byte view tag skips
                ~255/256 of them instantly.
              </Step>
              <Step icon={<KeyRound className="size-4" />} n={3} title="Withdraw with a derived key">
                spend key + shared secret = that address’s private key, signed through a transient Mera session.
              </Step>
            </ol>
          </div>
          <div className="hiw-step flex items-start gap-3 rounded-2xl border border-mon-500/30 bg-mon-500/5 p-4 text-[13px] leading-relaxed text-ink-200">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-mon-300" />
            <div>
              <span className="font-semibold text-ink-50">Stateless by design.</span> No key is ever saved, not
              even encrypted. One passkey prompt rebuilds every key; the chain rebuilds your inbox.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RootCard({
  className = '',
  icon,
  eyebrow,
  title,
  body,
  accent = false,
}: {
  className?: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`${className} rounded-2xl border p-4 ${
        accent ? 'border-mon-500/50 bg-mon-500/10' : 'border-ink-700 bg-ink-850'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-mon-500 text-white">{icon}</span>
        <div>
          <div className="label-eyebrow">{eyebrow}</div>
          <div className="font-display text-[15px] font-semibold text-ink-50">{title}</div>
        </div>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-300">{body}</p>
    </div>
  );
}

function Step({ icon, n, title, children }: { icon: ReactNode; n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-ink-600 text-mon-300">
        {icon}
      </span>
      <div>
        <div className="text-[13px] font-semibold text-ink-50">
          <span className="text-ink-500">{n}.</span> {title}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-400">{children}</p>
      </div>
    </li>
  );
}

export function HowItWorksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="One passkey, many keys" wide>
      <HowItWorksDiagram />
    </Modal>
  );
}
