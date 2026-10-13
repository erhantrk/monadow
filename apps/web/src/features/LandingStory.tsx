import { useLayoutEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowRight, ArrowUpRight, Check, Eye, Fingerprint, Lock, Send, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HowItWorksDiagram } from '@/components/HowItWorks';
import { MonadowMark } from '@/components/Logo';
import { seeded } from '@/motion';

gsap.registerPlugin(ScrollTrigger);

/*
 * Scroll film for the landing page. Technique (pinned GSAP ScrollTrigger scenes
 * scrubbed by a Lenis-smoothed scroll, deterministic text scrambles driven from
 * timeline time) ported from the Shade landing (stellarshade-labs/Web).
 *
 * The markup's default state is each scene's FINAL frame, so with
 * prefers-reduced-motion (no GSAP at all) the page reads as a static sequence.
 */

const HEX = '0123456789abcdef';
function hash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Scramble from `from` to `to` at progress p — pure, so scrubbing backwards is exact. */
function scrambleAt(from: string, to: string, p: number, seed: number) {
  if (p <= 0) return from;
  if (p >= 1) return to;
  const step = Math.floor(p * 26);
  return to
    .split('')
    .map((ch, i) => {
      if (ch === 'x' || ch === '…' || ch === ' ' || (i === 0 && ch === '0')) return ch;
      if (p >= 0.2 + hash(seed * 131 + i) * 0.75) return ch;
      return HEX[Math.floor(hash(seed * 977 + i * 31 + step * 7) * 16)];
    })
    .join('');
}

// ---- scene data -----------------------------------------------------------
const rnd = seeded(0x30a7);
const randAddr = () => {
  let a = '0x';
  for (let i = 0; i < 4; i++) a += HEX[Math.floor(rnd() * 16)];
  a += '…';
  for (let i = 0; i < 4; i++) a += HEX[Math.floor(rnd() * 16)];
  return a;
};
const YOU = '0xa11c…e9f2';
const ROW_STEP = 30;
const ROW_SHIFT = 16; // rows scrolled past before the ledger stops
const LEDGER = Array.from({ length: 26 }, (_, k) => {
  const mine = [3, 6, 10, 13, 17, 19, 22, 24].includes(k);
  const youFirst = rnd() < 0.5;
  return {
    k,
    mine,
    hot: mine && k >= ROW_SHIFT,
    a: mine && youFirst ? YOU : randAddr(),
    b: mine && !youFirst ? YOU : randAddr(),
    amt: (rnd() * 40 + 0.5).toFixed(2),
  };
});
const HOT = LEDGER.filter((r) => r.hot);
const rowY = (k: number) => 32 + k * ROW_STEP;

const ROOT_HEX = Array.from({ length: 64 }, () => HEX[Math.floor(rnd() * 16)]).join('');
const ROOT_FROM = '0'.repeat(64);

const KEYS = [
  { icon: Wallet, name: 'Account', sub: 'your wallet' },
  { icon: Send, name: 'Spend', sub: 'moves funds' },
  { icon: Eye, name: 'View', sub: 'finds payments' },
  { icon: Lock, name: 'Vault', sub: 'encrypts notes' },
];

const STEALTH = ['0x0000…0000', '0x91c2…4ae0', '0x3fd8…b71c', '0xe40a…09d5'];
const FRAGS = Array.from({ length: 16 }, () => ({
  x: (rnd() - 0.5) * 180,
  y: (rnd() - 0.5) * 120,
  r: (rnd() - 0.5) * 360,
}));

const GRID_COLS = 10;
const GRID_ROWS = 5;
const HIT = { c: 6, r: 2 };

// ---- component ------------------------------------------------------------
export function LandingStory({
  onPasskey,
  busy,
  disabled,
}: {
  onPasskey: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        const raf = (t: number) => lenis.raf(t * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);

        const q = gsap.utils.selector(root);
        const one = (s: string) => q(s)[0] as HTMLElement;

        const pinned = (sel: string, len: number, onUpdate?: (t: number) => void) => {
          const scene = one(sel);
          // headline rises in as the scene scrolls into view
          gsap.from(scene.querySelectorAll('[data-rise]'), {
            y: 48,
            opacity: 0,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: { trigger: scene, start: 'top 85%', end: 'top 15%', scrub: 0.6 },
          });
          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: scene,
              start: 'top top',
              end: `+=${len}%`,
              scrub: 0.6,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });
          if (onUpdate) tl.eventCallback('onUpdate', () => onUpdate(tl.time()));
          return tl;
        };

        // 1 — the trail
        {
          gsap.set(q('.s1-hl'), { opacity: 0 });
          gsap.set(q('.s1-line'), { strokeDashoffset: 1 });
          gsap.set(q('.s1-node, .s1-tag'), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' });
          const tl = pinned('#s1', 140);
          tl.fromTo(one('.s1-rows'), { y: 0 }, { y: -ROW_SHIFT * ROW_STEP, duration: 3, ease: 'power1.inOut' })
            .to(q('.s1-node'), { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, '-=0.4')
            .to(q('.s1-hl'), { opacity: 1, duration: 0.3, stagger: 0.12 })
            .to(q('.s1-line'), { strokeDashoffset: 0, duration: 0.8, stagger: 0.12 }, '<')
            .to(q('.s1-tag'), { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' })
            .to({}, { duration: 0.6 });
        }

        // 2 — one passkey
        {
          gsap.set(one('.s2-ring'), { strokeDashoffset: 1 });
          gsap.set(q('.s2-ok'), { opacity: 0, y: 12 });
          gsap.set(one('.s2-lit'), { opacity: 0 });
          const tl = pinned('#s2', 110);
          tl.fromTo(one('.s2-halo'), { scale: 0.85, opacity: 0.25 }, { scale: 1.15, opacity: 0.8, duration: 0.5, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0)
            .to(one('.s2-ring'), { strokeDashoffset: 0, duration: 2, ease: 'power1.in' }, 0)
            .to(one('.s2-lit'), { opacity: 1, duration: 0.3 }, 1.8)
            .fromTo(one('.s2-glyph'), { scale: 1 }, { scale: 1.08, duration: 0.15, yoyo: true, repeat: 1 }, 1.9)
            .to(q('.s2-ok'), { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, 2.1)
            .to({}, { duration: 0.5 });
        }

        // Mera — wordmark lands, primitives light up in order
        {
          gsap.set(q('.smera-chip'), { opacity: 0, y: 16, scale: 0.92 });
          gsap.set(q('.smera-arrow'), { opacity: 0 });
          gsap.set(q('.smera-link'), { opacity: 0 });
          const tl = pinned('#smera', 100);
          tl.fromTo(one('.smera-word'), { scale: 0.8, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.6)' }, 0)
            .fromTo(one('.smera-glow'), { opacity: 0.2, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1 }, 0);
          q('.smera-chip').forEach((chip, i) => {
            const at = 0.5 + i * 0.45;
            if (i > 0) tl.to(q('.smera-arrow')[i - 1], { opacity: 1, duration: 0.15 }, at - 0.15);
            tl.to(chip, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(2)' }, at);
          });
          tl.to(q('.smera-link'), { opacity: 1, duration: 0.3 }, 1.8).to({}, { duration: 0.5 });
        }

        // 3 — root → HKDF → four keys
        {
          const hexA = one('.s3-hex-a');
          const hexB = one('.s3-hex-b');
          const rootEl = one('.s3-root');
          const cards = q('.s3-card') as HTMLElement[];
          const delta = (el: HTMLElement, axis: 'x' | 'y') => {
            const r = rootEl.getBoundingClientRect();
            const c = el.getBoundingClientRect();
            return axis === 'x' ? r.left + r.width / 2 - (c.left + c.width / 2) : r.top + r.height / 2 - (c.top + c.height / 2);
          };
          gsap.set(q('.s3-hkdf'), { opacity: 0, scale: 0.8 });
          gsap.set(q('.s3-branch'), { scaleY: 0, transformOrigin: '50% 0%' });
          const tl = pinned('#s3', 150, (t) => {
            const p = Math.min(1, t / 1.2);
            hexA.textContent = scrambleAt(ROOT_FROM.slice(0, 32), ROOT_HEX.slice(0, 32), p, 3);
            hexB.textContent = scrambleAt(ROOT_FROM.slice(32), ROOT_HEX.slice(32), p, 4);
          });
          tl.to({}, { duration: 1.2 })
            .fromTo(rootEl, { scale: 1 }, { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1 })
            .to(q('.s3-hkdf'), { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' })
            .to(q('.s3-branch'), { scaleY: 1, duration: 0.3 }, '<')
            .fromTo(
              cards,
              { x: (_i: number, el: HTMLElement) => delta(el, 'x'), y: (_i: number, el: HTMLElement) => delta(el, 'y'), scale: 0.3, opacity: 0 },
              { x: 0, y: 0, scale: 1, opacity: 1, duration: 1, stagger: 0.15, ease: 'power3.out' },
            )
            .to({}, { duration: 0.6 });
          hexA.textContent = ROOT_FROM.slice(0, 32);
          hexB.textContent = ROOT_FROM.slice(32);
        }

        // 4 — sever ×3, fresh address each time
        {
          const addr = one('.s4-addr');
          const track = one('.s4-track');
          const halves = q('.s4-half');
          const frags = q('.s4-frag');
          const coin = one('.s4-coin');
          const CYCLE = 2;
          gsap.set(q('.s4-receipt'), { opacity: 0, x: -10 });
          gsap.set(halves, { scaleX: 0 });
          gsap.set(frags, { opacity: 0 });
          gsap.set(coin, { opacity: 0 });
          gsap.set(q('.s4-glow'), { opacity: 0 });
          const tl = pinned('#s4', 170, (t) => {
            const cyc = Math.min(2, Math.floor(t / CYCLE));
            const local = (t - cyc * CYCLE - 1.0) / 0.7; // scramble window inside each cycle
            const p = Math.max(0, Math.min(1, local));
            addr.textContent = scrambleAt(STEALTH[cyc], STEALTH[cyc + 1], p, 11 + cyc);
          });
          for (let i = 0; i < 3; i++) {
            const t0 = i * CYCLE;
            tl.set(halves, { scaleX: 0, rotation: 0, y: 0, opacity: 1 }, t0)
              .set(coin, { x: 0, opacity: 1, scale: 1 }, t0)
              .to(halves[0], { scaleX: 1, duration: 0.25 }, t0)
              .to(halves[1], { scaleX: 1, duration: 0.25 }, t0 + 0.2)
              .to(coin, { x: () => track.offsetWidth / 2 - 7, duration: 0.5, ease: 'power1.in' }, t0 + 0.3)
              // snap
              .to(halves[0], { rotation: -14, y: 18, opacity: 0, duration: 0.4, ease: 'power2.in' }, t0 + 0.8)
              .to(halves[1], { rotation: 14, y: 18, opacity: 0, duration: 0.4, ease: 'power2.in' }, t0 + 0.8)
              .fromTo(
                frags,
                { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 },
                { x: (j: number) => FRAGS[j].x, y: (j: number) => FRAGS[j].y, rotation: (j: number) => FRAGS[j].r, opacity: 0, scale: 0.4, duration: 0.6, ease: 'power2.out', immediateRender: false },
                t0 + 0.8,
              )
              .to(coin, { x: () => track.offsetWidth - 7, duration: 0.45, ease: 'power2.out' }, t0 + 0.8)
              .to(coin, { opacity: 0, scale: 0.4, duration: 0.15 }, t0 + 1.2)
              .fromTo(q('.s4-glow'), { opacity: 0 }, { opacity: 1, duration: 0.2, yoyo: true, repeat: 1, immediateRender: false }, t0 + 1.2)
              .to(q('.s4-receipt')[i], { opacity: 1, x: 0, duration: 0.3 }, t0 + 1.5);
          }
          tl.to({}, { duration: 0.4 }, 3 * CYCLE - 0.2);
          addr.textContent = STEALTH[0];
        }

        // 5 — view-key sweep
        {
          const grid = one('.s5-grid');
          const band = one('.s5-band');
          const cells = q('.s5-cell') as HTMLElement[];
          const D = 2;
          gsap.set(cells, { opacity: 0.4 });
          gsap.set(q('.s5-hit'), { opacity: 0, scale: 0.4 });
          gsap.set(q('.s5-found'), { opacity: 0, y: 14 });
          const tl = pinned('#s5', 140);
          tl.fromTo(band, { x: () => -band.offsetWidth }, { x: () => grid.offsetWidth, duration: D }, 0);
          for (let c = 0; c < GRID_COLS; c++) {
            const col = cells.filter((_, k) => k % GRID_COLS === c);
            const at = ((c + 0.5) / GRID_COLS) * D;
            tl.to(col, { opacity: 1, duration: 0.08 }, at - 0.08).to(col, { opacity: 0.4, duration: 0.2 }, at);
          }
          const hitAt = ((HIT.c + 0.5) / GRID_COLS) * D;
          tl.to(q('.s5-hit'), { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2.5)' }, hitAt)
            .to(q('.s5-found'), { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(2)' }, D)
            .to({}, { duration: 0.6 });
        }

        // 6 — spend it
        {
          const bal = one('.s6-bal');
          const lane = one('.s6-lane');
          const coins = q('.s6-coin');
          gsap.set(q('.s6-cta'), { opacity: 0, y: 24 });
          gsap.set(q('.s6-wallet'), { scale: 1 });
          const tl = pinned('#s6', 110, (t) => {
            const p = Math.max(0, Math.min(1, (t - 0.4) / 1.2));
            bal.textContent = (p * 3).toFixed(2);
          });
          tl.fromTo(
            coins,
            { x: 0, opacity: 0 },
            { keyframes: [{ opacity: 1, duration: 0.1 }, { x: () => lane.offsetWidth - 12, duration: 0.7, ease: 'power1.inOut' }, { opacity: 0, duration: 0.1 }], stagger: 0.3 },
            0.2,
          )
            .fromTo(q('.s6-wallet'), { scale: 1 }, { scale: 1.08, duration: 0.15, yoyo: true, repeat: 3 }, 0.9)
            .to(q('.s6-cta'), { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.8)
            .to({}, { duration: 0.4 });
          bal.textContent = '0.00';
        }

        // Under the hood — reveal once, branches draw, PRF hex scrambles
        {
          const sec = one('#under-the-hood');
          const hex = sec.querySelector('.hiw-hex') as HTMLElement | null;
          const finalHex = hex?.textContent ?? '';
          const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 70%', once: true } });
          tl.from(q('.hiw-head'), { y: 30, opacity: 0, duration: 0.6, ease: 'power2.out' })
            .from(q('.hiw-root'), { y: 24, opacity: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out' }, '-=0.3');
          if (hex) {
            const proxy = { p: 0 };
            tl.to(proxy, {
              p: 1,
              duration: 1,
              ease: 'none',
              onUpdate: () => (hex.textContent = scrambleAt('0'.repeat(finalHex.length), finalHex, proxy.p, 21)),
            }, '-=0.2');
          }
          tl.from(q('.hiw-hkdf'), { opacity: 0, scale: 0.8, duration: 0.3 }, '-=0.6')
            .fromTo(q('.hiw-branch'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out' }, '<')
            .from(q('.hiw-leaf'), { y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, '-=0.3')
            .from(q('.hiw-step'), { y: 24, opacity: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out' }, '-=0.2');
        }

        const refresh = () => ScrollTrigger.refresh();
        void document.fonts?.ready.then(refresh);
        window.addEventListener('load', refresh);
        return () => {
          window.removeEventListener('load', refresh);
          gsap.ticker.remove(raf);
          lenis.destroy();
        };
      },
      root,
    );
    return () => mm.revert();
  }, []);

  return (
    <div ref={root} className="relative">
      {/* 1 */}
      <Scene id="s1" title="Every payment leaves a trail." sub="On a public ledger, every transfer links back to you.">
        <svg viewBox="0 0 520 340" className="w-full max-w-[620px]" aria-hidden>
          <defs>
            <clipPath id="s1clip">
              <rect x="150" y="8" width="370" height="312" />
            </clipPath>
            <linearGradient id="s1fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0e0b16" stopOpacity="1" />
              <stop offset="0.14" stopColor="#0e0b16" stopOpacity="0" />
              <stop offset="0.86" stopColor="#0e0b16" stopOpacity="0" />
              <stop offset="1" stopColor="#0e0b16" stopOpacity="1" />
            </linearGradient>
          </defs>
          <g clipPath="url(#s1clip)">
            <g className="s1-rows" transform={`translate(0,${-ROW_SHIFT * ROW_STEP})`}>
              {LEDGER.map((r) => (
                <g key={r.k}>
                  {r.hot && (
                    <rect className="s1-hl" x="158" y={rowY(r.k) - 19} width="356" height="26" rx="6" fill="rgb(131 110 249 / 0.14)" stroke="rgb(131 110 249 / 0.55)" />
                  )}
                  <text x="170" y={rowY(r.k)} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="14" fill="#5e5482">
                    <tspan fill={r.a === YOU ? '#bdb1fd' : undefined}>{r.a}</tspan>
                    <tspan> → </tspan>
                    <tspan fill={r.b === YOU ? '#bdb1fd' : undefined}>{r.b}</tspan>
                  </text>
                  <text x="505" y={rowY(r.k)} textAnchor="end" fontFamily="ui-monospace, Menlo, monospace" fontSize="13" fill="#3b315c">
                    {r.amt}
                  </text>
                </g>
              ))}
            </g>
          </g>
          <rect x="150" y="8" width="370" height="312" fill="url(#s1fade)" pointerEvents="none" />
          {HOT.map((r) => {
            const y = rowY(r.k - ROW_SHIFT) - 6;
            return (
              <path
                key={r.k}
                className="s1-line"
                d={`M92 170 C130 170, 120 ${y}, 160 ${y}`}
                fill="none"
                stroke="#836ef9"
                strokeWidth="1.6"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset="0"
                style={{ filter: 'drop-shadow(0 0 4px rgb(131 110 249 / 0.9))' }}
              />
            );
          })}
          <g className="s1-node">
            <circle cx="62" cy="170" r="40" fill="rgb(131 110 249 / 0.12)" />
            <circle cx="62" cy="170" r="28" fill="#17122a" stroke="#836ef9" strokeWidth="2" />
            <text x="62" y="175" textAnchor="middle" fontSize="14" fontWeight="600" fill="#f6f3ff" fontFamily="Inter, sans-serif">
              you
            </text>
          </g>
          <g className="s1-tag">
            <rect x="12" y="222" width="100" height="26" rx="13" fill="rgb(239 68 68 / 0.12)" stroke="rgb(239 68 68 / 0.5)" />
            <text x="62" y="239" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fca5a5" fontFamily="Inter, sans-serif">
              doxxed
            </text>
          </g>
        </svg>
      </Scene>

      {/* 2 */}
      <Scene id="s2" title="One passkey." sub="Face ID or Touch ID. Nothing to write down." accent>
        <div className="relative grid size-[220px] place-items-center sm:size-[260px]" aria-hidden>
          <div className="s2-halo absolute inset-[8%] rounded-full bg-mon-500/30 blur-3xl" />
          <svg viewBox="0 0 220 220" className="absolute inset-0 size-full -rotate-90">
            <circle cx="110" cy="110" r="96" fill="none" stroke="#2a2243" strokeWidth="6" />
            <circle
              className="s2-ring"
              cx="110"
              cy="110"
              r="96"
              fill="none"
              stroke="#836ef9"
              strokeWidth="6"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset="0"
              style={{ filter: 'drop-shadow(0 0 6px rgb(131 110 249 / 0.8))' }}
            />
          </svg>
          <div className="s2-glyph relative grid size-[120px] place-items-center">
            <Fingerprint className="absolute size-[104px] text-ink-500" strokeWidth={1.25} />
            <Fingerprint className="s2-lit absolute size-[104px] text-mon-300 drop-shadow-[0_0_14px_rgb(131_110_249/0.9)]" strokeWidth={1.25} />
          </div>
          <div className="s2-ok absolute -bottom-14 inline-flex items-center gap-1.5 rounded-full border border-mon-500/50 bg-mon-500/15 px-3 py-1 text-[13px] font-medium text-mon-200">
            <Check className="size-4" /> Verified
          </div>
        </div>
      </Scene>

      {/* Mera */}
      <section id="smera" className="relative z-10 flex flex-col items-center justify-center gap-8 overflow-hidden px-4 py-16 motion-safe:h-[100svh] motion-safe:pb-0 motion-safe:pt-16 sm:px-6">
        <div className="smera-glow pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mon-500/20 blur-[100px]" aria-hidden />
        <div className="relative text-center">
          <div data-rise className="label-eyebrow">The account layer</div>
          <h2 data-rise className="font-display mt-3 text-[32px] font-bold leading-[1.05] tracking-tight text-ink-50 sm:text-[52px]">
            Powered by{' '}
            <a
              href="https://mera.category.xyz"
              target="_blank"
              rel="noreferrer"
              className="smera-word inline-block bg-gradient-to-r from-mon-300 via-mon-400 to-mon-200 bg-clip-text text-[1.6em] tracking-[-0.03em] text-transparent drop-shadow-[0_0_30px_rgb(131_110_249/0.45)]"
            >
              Mera.
            </a>
          </h2>
          <p data-rise className="mx-auto mt-3 max-w-md text-[14px] text-ink-400 sm:text-[16px]">
            Passkey PRF → keys, signing sessions, zero seed phrases.
          </p>
        </div>
        <div className="relative flex flex-col items-center gap-2 sm:flex-row sm:gap-3" aria-label="Mera primitives used by Monadow">
          {['getPasskeyPrfOutput', 'createSecp256k1SigningSession', 'toViemAccount'].map((fn, i) => (
            <div key={fn} className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
              {i > 0 && <ArrowRight className="smera-arrow size-4 rotate-90 text-mon-400 sm:rotate-0" aria-hidden />}
              <code className="smera-chip rounded-xl border border-mon-500/50 bg-ink-850/90 px-3 py-2 font-mono text-[12.5px] text-mon-200 shadow-[0_0_24px_-6px_rgb(131_110_249/0.7)] sm:text-[13px]">
                {fn}()
              </code>
            </div>
          ))}
        </div>
        <a
          href="https://mera.category.xyz"
          target="_blank"
          rel="noreferrer"
          className="smera-link relative inline-flex items-center gap-1 text-[13px] text-ink-400 hover:text-mon-300"
        >
          mera.category.xyz <ArrowUpRight className="size-3.5" />
        </a>
      </section>

      {/* 3 */}
      <Scene id="s3" title="Becomes every key you need." sub="Derived on your device. Never stored.">
        <div className="flex w-full max-w-[720px] flex-col items-center" aria-hidden>
          <div className="s3-root relative z-10 rounded-2xl border border-mon-500/60 bg-ink-850/90 px-4 py-3 text-center shadow-[0_0_40px_-8px_rgb(131_110_249/0.6)]">
            <div className="label-eyebrow mb-1 !text-[10px]">passkey root · 32 bytes</div>
            <div className="font-mono text-[11px] leading-[1.5] text-mon-200 sm:text-[13px]">
              <div className="s3-hex-a">{ROOT_HEX.slice(0, 32)}</div>
              <div className="s3-hex-b">{ROOT_HEX.slice(32)}</div>
            </div>
          </div>
          <div className="s3-branch h-6 w-px bg-gradient-to-b from-mon-500 to-mon-500/20" />
          <div className="s3-hkdf rounded-full border border-ink-600 bg-ink-900 px-3 py-0.5 font-mono text-[11px] text-ink-300">HKDF</div>
          <div className="s3-branch h-6 w-px bg-gradient-to-b from-mon-500/60 to-transparent" />
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            {KEYS.map(({ icon: Icon, name, sub }) => (
              <div key={name} className="s3-card flex flex-col items-center gap-2 rounded-2xl border border-ink-600 bg-ink-850/90 px-3 py-4 text-center">
                <span className="grid size-10 place-items-center rounded-xl bg-mon-500/15 text-mon-300">
                  <Icon className="size-5" />
                </span>
                <span className="font-display text-[16px] font-semibold text-ink-50">{name}</span>
                <span className="text-[12px] text-ink-400">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </Scene>

      {/* 4 */}
      <Scene id="s4" title={<>Paid to a brand-new address.<br />Every time.</>} sub="No link between payments, sender and you.">
        <div className="w-full max-w-[680px]" aria-hidden>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <span className="grid size-12 place-items-center rounded-full border border-ink-600 bg-ink-850 text-ink-200 sm:size-14">
                <Send className="size-5" />
              </span>
              <span className="text-[11px] text-ink-400">sender</span>
            </div>
            <div className="s4-track relative h-16 flex-1">
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2">
                <span className="s4-half h-[2px] flex-1 origin-left bg-mon-500 shadow-[0_0_8px_rgb(131_110_249/0.9)]" />
                <span className="s4-half h-[2px] flex-1 origin-left bg-mon-500 shadow-[0_0_8px_rgb(131_110_249/0.9)]" />
              </div>
              <div className="absolute left-1/2 top-1/2">
                {FRAGS.map((_, i) => (
                  <i key={i} className="s4-frag absolute block h-[2px] w-2 bg-mon-300" style={{ opacity: 0 }} />
                ))}
              </div>
              <span className="s4-coin absolute left-0 top-1/2 -mt-[7px] size-[14px] rounded-full bg-mon-300 shadow-[0_0_12px_rgb(189_177_253/0.9)]" style={{ opacity: 0 }} />
            </div>
            <div className="relative w-[148px] shrink-0 rounded-2xl border border-mon-500/50 bg-ink-850/90 px-3 py-3 sm:w-[190px]">
              <div className="s4-glow absolute -inset-px rounded-2xl ring-2 ring-mon-400 shadow-[0_0_30px_rgb(131_110_249/0.7)]" style={{ opacity: 0 }} />
              <div className="label-eyebrow !text-[9px]">one-time address</div>
              <div className="s4-addr mt-1 font-mono text-[13px] text-mon-200 sm:text-[15px]">{STEALTH[3]}</div>
            </div>
          </div>
          <div className="ml-auto mt-4 w-[148px] space-y-1 sm:w-[190px]">
            {STEALTH.slice(1).map((a) => (
              <div key={a} className="s4-receipt flex items-center justify-between font-mono text-[11px] text-ink-500">
                <span>{a}</span>
                <span className="text-ink-600">used once</span>
              </div>
            ))}
          </div>
        </div>
      </Scene>

      {/* 5 */}
      <Scene id="s5" title="Only you can find it." sub="Your view key scans every announcement, locally.">
        <div className="w-full max-w-[560px]" aria-hidden>
          <div className="s5-grid relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/60 p-2">
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
              {Array.from({ length: GRID_COLS * GRID_ROWS }, (_, k) => {
                const hit = k % GRID_COLS === HIT.c && Math.floor(k / GRID_COLS) === HIT.r;
                return (
                  <div key={k} className="s5-cell relative aspect-square rounded-md border border-ink-700 bg-ink-850">
                    {hit && (
                      <span className="s5-hit absolute -inset-px rounded-md bg-mon-500 shadow-[0_0_24px_rgb(131_110_249/0.95)]" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="s5-band pointer-events-none absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-transparent via-mon-400/30 to-transparent" style={{ transform: 'translateX(-100%)' }} />
          </div>
          <div className="s5-found mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-mon-500/50 bg-mon-500/15 px-3.5 py-1 text-[13px] font-medium text-mon-200">
            <span className="size-1.5 rounded-full bg-mon-400" /> Found in 150 ms
          </div>
        </div>
      </Scene>

      {/* 6 */}
      <Scene id="s6" title={<>Spend it.<br /><span className="text-mon-400">No seed phrase. No extension.</span></>}>
        <div className="flex w-full max-w-[560px] flex-col items-center" aria-hidden={false}>
          <div className="flex w-full items-center gap-3" aria-hidden>
            <div className="w-[120px] shrink-0 rounded-2xl border border-ink-600 bg-ink-850/90 px-3 py-2.5 sm:w-[150px]">
              <div className="label-eyebrow !text-[9px]">one-time address</div>
              <div className="mt-0.5 font-mono text-[12px] text-ink-300">{STEALTH[3]}</div>
            </div>
            <div className="s6-lane relative h-6 flex-1">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-ink-600 via-mon-500/60 to-mon-500" />
              {[0, 1, 2].map((i) => (
                <span key={i} className="s6-coin absolute left-0 top-1/2 -mt-[6px] size-3 rounded-full bg-mon-300 shadow-[0_0_10px_rgb(189_177_253/0.9)]" style={{ opacity: 0 }} />
              ))}
            </div>
            <div className="s6-wallet flex w-[120px] shrink-0 flex-col items-center rounded-2xl border border-mon-500/60 bg-ink-850/90 px-3 py-2.5 sm:w-[150px]">
              <span className="text-[11px] text-ink-400">your wallet</span>
              <span className="font-display text-[20px] font-bold text-ink-50">
                <span className="s6-bal">3.00</span> <span className="text-[12px] text-mon-300">MON</span>
              </span>
            </div>
          </div>

          <div className="s6-cta mt-12 flex w-full max-w-sm flex-col items-center gap-4">
            <Button
              variant="primary"
              size="lg"
              className={`w-full ${busy ? 'animate-m-halo' : ''}`}
              loading={busy}
              disabled={disabled}
              icon={<Fingerprint className="size-5" />}
              onClick={onPasskey}
            >
              {busy ? 'Waiting for passkey…' : 'Continue with passkey'}
            </Button>
            <div className="flex items-center gap-2 text-[12px] text-ink-400">
              <MonadowMark className="size-4 text-mon-500" />
              Built on Monad · Powered by{' '}
              <a href="https://mera.category.xyz" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-mon-300 hover:text-mon-200">
                Mera <ArrowUpRight className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </Scene>

      <section id="under-the-hood" className="relative z-10 mx-auto max-w-[1080px] px-4 pb-24 pt-20 sm:px-6">
        <div className="hiw-head mb-8 text-center">
          <div className="label-eyebrow">Under the hood</div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-ink-50 sm:text-3xl">One passkey, many keys</h2>
          <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed text-ink-400">
            One WebAuthn PRF evaluation gives a 32-byte root. HKDF splits it into independent, purpose-bound keys.
          </p>
        </div>
        <HowItWorksDiagram scripted />
      </section>
    </div>
  );
}

function Scene({
  id,
  title,
  sub,
  accent,
  children,
}: {
  id: string;
  title: ReactNode;
  sub?: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative z-10 flex flex-col items-center justify-center gap-8 overflow-hidden px-4 py-16 sm:gap-10 sm:px-6 motion-safe:h-[100svh] motion-safe:pb-0 motion-safe:pt-16`}
    >
      <div className="max-w-[880px] text-center">
        <h2
          data-rise
          className={`font-display text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[52px] ${accent ? 'text-mon-400' : 'text-ink-50'}`}
        >
          {title}
        </h2>
        {sub && (
          <p data-rise className="mx-auto mt-3 max-w-md text-[14px] text-ink-400 sm:text-[16px]">
            {sub}
          </p>
        )}
      </div>
      <div className="flex w-full justify-center">{children}</div>
    </section>
  );
}
