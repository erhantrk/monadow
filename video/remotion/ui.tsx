import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, interpolate, spring, useVideoConfig, Easing } from 'remotion';

export const C = {
  bg: '#0E0B16',
  mon: '#836EF9',
  monLight: '#A898FF',
  monPale: '#C9BFFF',
  ink400: '#8B84A3',
  ink300: '#B4AECB',
  ok: '#4ADE80',
  alice: '#F0ABFC',
};

// ---------- fonts ----------
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=block';
export const FontLoader: React.FC = () => {
  const [h] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_CSS;
    link.onload = () => {
      Promise.all([
        document.fonts.load('700 40px "Space Grotesk"'),
        document.fonts.load('600 40px "Space Grotesk"'),
        document.fonts.load('500 40px "Inter"'),
        document.fonts.load('600 40px "Inter"'),
        document.fonts.load('500 40px "JetBrains Mono"'),
      ]).then(() => continueRender(h), () => continueRender(h));
    };
    link.onerror = () => continueRender(h);
    document.head.appendChild(link);
  }, [h]);
  return null;
};

// ---------- logo ----------
export const Mark: React.FC<{ size: number; draw?: number; eclipse?: number; glow?: number }> = ({ size, draw = 1, eclipse = 1, glow = 1 }) => {
  const len = 80;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ overflow: 'visible', filter: `drop-shadow(0 0 ${size * 0.08 * glow}px ${C.mon}cc)` }}>
      <path d="M16 3.2 27.1 9.6v12.8L16 28.8 4.9 22.4V9.6Z" fill="none" stroke={C.mon} strokeWidth={2} strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
      <mask id="mk">
        <rect width="32" height="32" fill="#fff" />
        <circle cx={19.4 + (1 - eclipse) * 9} cy={13.4 - (1 - eclipse) * 7} r={5.7} fill="#000" />
      </mask>
      <circle cx={16} cy={16} r={6.8 * Math.min(1, draw * 1.2)} fill={C.mon} mask="url(#mk)" />
    </svg>
  );
};

// ---------- background ----------
const HEX = (() => {
  const r = 46, w = Math.sqrt(3) * r;
  const pts = [];
  for (let row = -1; row < 1080 / (1.5 * r) + 2; row++)
    for (let col = -1; col < 1920 / w + 2; col++) pts.push({ x: col * w + (row % 2 ? w / 2 : 0), y: row * 1.5 * r, i: row * 97 + col * 31 });
  return { r, pts };
})();
const hexPath = (x: number, y: number, r: number) => {
  let d = '';
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    d += `${k ? 'L' : 'M'}${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
};
export const Background: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame / 30;
  const drift = (t * 6) % (HEX.r * 3);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at ${50 + 12 * Math.sin(t / 7)}% ${38 + 8 * Math.cos(t / 9)}%, rgba(131,110,249,0.20), rgba(131,110,249,0) 60%), radial-gradient(900px 600px at 85% 110%, rgba(240,171,252,0.07), rgba(0,0,0,0) 60%), ${C.bg}` }} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, transform: `translateY(${-drift}px)` }}>
        {HEX.pts.map((p) => {
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.8 + p.i * 0.37);
          return <path key={p.i} d={hexPath(p.x, p.y, HEX.r - 3)} fill="none" stroke={C.mon} strokeOpacity={0.035 + 0.04 * pulse * pulse * pulse} strokeWidth={1.2} />;
        })}
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};

// ---------- browser window ----------
export const BrowserWindow: React.FC<{ width: number; height: number; bar: number; url: string; actor?: { name: string; role: string }; children: React.ReactNode }> = ({ width, height, bar, url, actor, children }) => {
  const col = actor?.name === 'Alice' ? C.alice : actor?.name === 'Bob' ? C.monLight : '#7dd3fc';
  return (
    <div style={{ width, height, borderRadius: 18, overflow: 'hidden', background: '#0b0912', border: '1px solid rgba(255,255,255,0.10)', boxShadow: `0 50px 140px rgba(0,0,0,0.65), 0 0 0 1px rgba(131,110,249,0.10), 0 0 120px rgba(131,110,249,0.16)` }}>
      <div style={{ height: bar, display: 'flex', alignItems: 'center', padding: '0 16px', background: 'linear-gradient(#1a1626,#141020)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.85 }} />)}
        </div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', height: 24, padding: '0 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter', fontSize: 13.5, color: C.ink300 }}>
          <svg width="11" height="12" viewBox="0 0 11 12"><rect x="1" y="5" width="9" height="7" rx="1.5" fill={C.ink400} /><path d="M3 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke={C.ink400} strokeWidth="1.4" fill="none" /></svg>
          {url}
        </div>
        {actor && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter', fontSize: 14, fontWeight: 600, color: '#fff', padding: '3px 12px', borderRadius: 999, background: `${col}1f`, border: `1px solid ${col}66` }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: col, boxShadow: `0 0 10px ${col}` }} />
            {actor.name}
            <span style={{ fontWeight: 500, color: C.ink300 }}>· {actor.role}</span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
};

// ---------- kinetic caption ----------
export const Caption: React.FC<{ text: string; local: number; dur: number; y?: number; size?: number }> = ({ text, local, dur, y = 50, size = 50 }) => {
  const fps = 30; // cards are authored in 30fps frame units
  const words = text.split(' ');
  const exit = interpolate(local, [dur - 8, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  return (
    <div style={{ position: 'absolute', top: y, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', gap: size * 0.26, padding: '14px 34px', borderRadius: 999, background: 'rgba(14,11,22,0.9)', border: '1px solid rgba(131,110,249,0.35)', boxShadow: '0 12px 40px rgba(0,0,0,0.55)', opacity: 1 - exit, transform: `translateY(${-exit * 14}px)`, filter: `blur(${exit * 6}px)` }}>
        {words.map((w, i) => {
          const s = spring({ frame: local - i * 3, fps, config: { damping: 15, stiffness: 140, mass: 0.7 } });
          const last = i === words.length - 1;
          return (
            <span key={i} style={{ display: 'inline-block', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: size, letterSpacing: -0.5, lineHeight: 1.1, color: '#fff', opacity: s, transform: `translateY(${(1 - s) * 26}px)`, filter: `blur(${(1 - s) * 8}px)`, ...(last ? { background: `linear-gradient(90deg, ${C.monPale}, ${C.mon})`, WebkitBackgroundClip: 'text', color: 'transparent' } : {}) }}>
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------- cards ----------
const Words: React.FC<{ text: string; local: number; delay?: number; size: number; color?: string; weight?: number; font?: string; gradientLast?: boolean }> = ({ text, local, delay = 0, size, color = '#fff', weight = 700, font = 'Space Grotesk', gradientLast }) => {
  const fps = 30; // cards are authored in 30fps frame units
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', gap: size * 0.25, justifyContent: 'center', flexWrap: 'wrap' }}>
      {words.map((w, i) => {
        const s = spring({ frame: local - delay - i * 4, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
        const g = gradientLast && i === words.length - 1;
        return (
          <span key={i} style={{ display: 'inline-block', fontFamily: font, fontWeight: weight, fontSize: size, letterSpacing: size > 80 ? -2 : -0.5, lineHeight: 1.05, color, opacity: s, transform: `translateY(${(1 - s) * size * 0.5}px)`, filter: `blur(${(1 - s) * 10}px)`, ...(g ? { background: `linear-gradient(90deg, ${C.monPale}, ${C.mon})`, WebkitBackgroundClip: 'text', color: 'transparent' } : {}) }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};
const fadeOut = (local: number, dur: number, n = 9) => interpolate(local, [dur - n, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const ChapterCard: React.FC<{ local: number; dur: number; num: string; title: string; sub: string }> = ({ local, dur, num, title, sub }) => {
  const fps = 30; // cards are authored in 30fps frame units
  const o = fadeOut(local, dur);
  const line = spring({ frame: local - 2, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o, transform: `scale(${1 + (1 - o) * 0.04})` }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, letterSpacing: 6, color: C.monLight, opacity: line, marginBottom: 26 }}>
        {num} <span style={{ display: 'inline-block', width: 120 * line, height: 1.5, background: C.mon, verticalAlign: 'middle', margin: '0 14px', boxShadow: `0 0 12px ${C.mon}` }} /> MONADOW
      </div>
      <Words text={title} local={local} size={124} gradientLast />
      <div style={{ height: 26 }} />
      <Words text={sub} local={local} delay={10} size={40} weight={500} font="Inter" color={C.ink300} />
    </AbsoluteFill>
  );
};

export const IntroCard: React.FC<{ local: number; dur: number }> = ({ local, dur }) => {
  const fps = 30; // cards are authored in 30fps frame units
  const draw = interpolate(local, [0, 22], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const ecl = spring({ frame: local - 14, fps, config: { damping: 16 } });
  const o = fadeOut(local, dur, 10);
  const word = spring({ frame: local - 18, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o, transform: `scale(${1 + (1 - o) * 0.06})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
        <Mark size={150} draw={draw} eclipse={ecl} glow={1.4} />
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 128, letterSpacing: -4, color: '#fff', opacity: word, transform: `translateX(${(1 - word) * -30}px)`, filter: `blur(${(1 - word) * 10}px)` }}>Monadow</div>
      </div>
      <div style={{ height: 30 }} />
      <Words text="Private payments on Monad." local={local} delay={30} size={46} weight={500} font="Inter" color={C.ink300} />
      <div style={{ height: 22 }} />
      <div style={{ opacity: spring({ frame: local - 50, fps }), fontFamily: 'Inter', fontSize: 20, fontWeight: 600, color: C.monLight, padding: '7px 18px', borderRadius: 999, border: `1px solid ${C.mon}66`, background: `${C.mon}14`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: C.ok, boxShadow: `0 0 10px ${C.ok}` }} /> Technical demo · real transactions on Monad testnet
      </div>
    </AbsoluteFill>
  );
};

export const OutroCard: React.FC<{ local: number; dur: number }> = ({ local, dur }) => {
  const fps = 30; // cards are authored in 30fps frame units
  const m = spring({ frame: local, fps, config: { damping: 15 } });
  const o = interpolate(local, [dur - 12, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const links = [
    ['App', 'erhantrk.github.io/monadow'],
    ['Code', 'github.com/erhantrk/monadow'],
    ['SDK', 'npm i monadow-sdk'],
  ];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o }}>
      <div style={{ transform: `scale(${0.7 + 0.3 * m})`, opacity: m }}>
        <Mark size={120} glow={1.6} />
      </div>
      <div style={{ height: 26 }} />
      <Words text="Get paid, not tracked." local={local} delay={6} size={100} gradientLast />
      <div style={{ height: 50 }} />
      <div style={{ display: 'flex', gap: 22 }}>
        {links.map(([k, v], i) => {
          const s = spring({ frame: local - 22 - i * 5, fps, config: { damping: 16 } });
          return (
            <div key={k} style={{ opacity: s, transform: `translateY(${(1 - s) * 20}px)`, padding: '14px 24px', borderRadius: 14, border: '1px solid rgba(131,110,249,0.35)', background: 'rgba(131,110,249,0.08)' }}>
              <div style={{ fontFamily: 'Inter', fontSize: 14, letterSpacing: 2.5, color: C.ink400, fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 25, color: '#fff', marginTop: 4 }}>{v}</div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 34 }} />
      <div style={{ opacity: spring({ frame: local - 40, fps }), fontFamily: 'Inter', fontSize: 19, color: C.ink400 }}>Built on Monad with Mera passkeys · ERC-5564 · ERC-6538 · MIT</div>
    </AbsoluteFill>
  );
};

export const MeraCard: React.FC<{ local: number; dur: number }> = ({ local, dur }) => {
  const fps = 30; // cards are authored in 30fps frame units
  const o = fadeOut(local, dur, 10);
  const big = spring({ frame: local - 4, fps, config: { damping: 14, stiffness: 90 } });
  const prims = ['getPasskeyPrfOutput', 'createSecp256k1SigningSession', 'toViemAccount'];
  const sub = ['1 passkey ceremony', 'prompt-free signing', 'a normal viem account'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o, transform: `scale(${1 + (1 - o) * 0.04})` }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 24, letterSpacing: 8, color: C.ink300, opacity: spring({ frame: local, fps }) }}>POWERED BY</div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 230, letterSpacing: -6, lineHeight: 1, marginTop: 4, background: `linear-gradient(100deg, #fff 10%, ${C.monPale} 45%, ${C.mon} 90%)`, WebkitBackgroundClip: 'text', color: 'transparent', opacity: big, transform: `translateY(${(1 - big) * 40}px) scale(${0.92 + 0.08 * big})`, filter: `blur(${(1 - big) * 12}px) drop-shadow(0 0 40px ${C.mon}66)` }}>Mera</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginTop: 44 }}>
        {prims.map((p, i) => {
          const s = spring({ frame: local - 16 - i * 8, fps, config: { damping: 16 } });
          const a = spring({ frame: local - 20 - i * 8, fps, config: { damping: 20 } });
          return (
            <React.Fragment key={p}>
              {i > 0 && <div style={{ alignSelf: 'center', marginTop: -26, width: 50 * a, height: 2, background: `linear-gradient(90deg, ${C.mon}00, ${C.mon})`, boxShadow: `0 0 10px ${C.mon}`, position: 'relative' }}><span style={{ position: 'absolute', right: -6, top: -6, color: C.mon, fontSize: 14, opacity: a }}>▶</span></div>}
              <div style={{ opacity: s, transform: `translateY(${(1 - s) * 24}px)`, textAlign: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 27, color: '#fff', padding: '14px 22px', borderRadius: 14, border: `1.5px solid ${C.mon}77`, background: `${C.mon}16`, boxShadow: `0 0 30px ${C.mon}22` }}>{p}()</div>
                <div style={{ fontFamily: 'Inter', fontSize: 19, color: C.ink400, marginTop: 12 }}>{sub[i]}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
