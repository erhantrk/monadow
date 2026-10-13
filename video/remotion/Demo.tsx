import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion';
import tlJson from './timeline.json';
import { Background, Caption, ChapterCard, IntroCard, OutroCard, BrowserWindow, MeraCard, C } from './ui';

type Cam = { s: number; cx: number; cy: number };
type Seg = {
  type: 'intro' | 'mera' | 'chapter' | 'screen' | 'explorer' | 'outro';
  from: number; dur: number; id?: string; page?: string; enter?: boolean;
  actor?: { name: string; role: string };
  frames?: { f: string; cam: Cam; a?: string; b?: string }[]; mode?: 'solo' | 'split';
  num?: string; title?: string; sub?: string; stills?: string[]; url?: string;
};
const tl = tlJson as unknown as { fps: number; total: number; W: number; H: number; segs: Seg[]; captions: { text: string; from: number; to: number }[]; info: any; wiped?: { before: string[]; after: string[] } };

export const DEMO_FRAMES = tl.total;

// Window geometry (output px)
const WIN_W = 1500; // explorer window
const BAR = 38;
const BASE_X = (1920 - WIN_W) / 2;
const BASE_Y = 172;
type L = { x: number; y: number; B: number; o: number };
const SOLO: L = { x: (1920 - tl.W * 1.06) / 2, y: 165, B: 1.06, o: 1 };
const SPLIT_A: L = { x: 48, y: 205, B: 0.94, o: 1 };
const SPLIT_B: L = { x: 1920 - 48 - tl.W * 0.94, y: 205, B: 0.94, o: 1 };
const HIDDEN_A: L = { x: -700, y: 205, B: 0.94, o: 0 };
const mixL = (p: L, q: L, k: number): L => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, B: p.B + (q.B - p.B) * k, o: p.o + (q.o - p.o) * k });
const layouts = (seg?: Seg) => (seg && seg.mode === 'split' ? { a: SPLIT_A, b: SPLIT_B } : { a: HIDDEN_A, b: SOLO });

function Win({ l, file, cam, actor, dim = 0, glow = 0, children }: { l: L; file: string; cam?: Cam; actor: { name: string; role: string }; dim?: number; glow?: number; children?: React.ReactNode }) {
  const c = cam ?? { s: 1, cx: tl.W / 2, cy: tl.H / 2 };
  const w = tl.W * l.B, h = tl.H * l.B;
  // camera: scale the whole window about the cursor focus, nudging it toward screen centre
  const p = { x: c.cx * l.B, y: BAR + c.cy * l.B };
  const F1 = { x: l.x + p.x, y: l.y + p.y };
  const k = Math.min(1, (c.s - 1) / 0.3) * 0.55;
  const D = { x: F1.x + (960 - F1.x) * k, y: F1.y + (600 - F1.y) * k };
  const tx = D.x - l.x - p.x * c.s, ty = D.y - l.y - p.y * c.s;
  if (l.o <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', left: l.x, top: l.y, width: w, height: h + BAR, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${c.s})`, opacity: l.o }}>
      <div style={{ position: 'absolute', inset: -2, borderRadius: 20, boxShadow: `0 0 ${60 * glow}px ${C.mon}${Math.round(0x66 * glow).toString(16).padStart(2, '0')}, 0 0 0 ${2 * glow}px ${C.mon}${Math.round(0xaa * glow).toString(16).padStart(2, '0')}` }} />
      <BrowserWindow width={w} height={h + BAR} bar={BAR} url="erhantrk.github.io/monadow" actor={actor}>
        <div style={{ position: 'relative' }}>
          <Img src={staticFile(`raw/${file}`)} style={{ width: w, height: h, display: 'block' }} />
          {dim > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(8,6,14,${dim})` }} />}
        </div>
      </BrowserWindow>
      {children}
    </div>
  );
}

const ALICE = { name: 'Alice', role: 'sender' };
const BOB = { name: 'Bob', role: 'recipient' };

function ScreenSeg({ seg, local, prev, next }: { seg: Seg; local: number; prev?: Seg; next?: Seg }) {
  const { fps } = useVideoConfig();
  const fr = seg.frames![Math.min(local, seg.frames!.length - 1)];
  const prevScreen = prev && prev.type === 'screen' ? prev : undefined;
  // layout transition between solo and split
  const to = layouts(seg);
  const from = prevScreen && !seg.enter ? layouts(prevScreen) : to;
  const km = spring({ frame: local, fps, config: { damping: 20, stiffness: 90, mass: 1 } });
  let la = mixL(from.a, to.a, km), lb = mixL(from.b, to.b, km);
  // enter / exit (chapter cards, intro, explorer)
  const enter = seg.enter ? spring({ frame: local, fps, config: { damping: 18, stiffness: 110, mass: 0.9 } }) : 1;
  const exitNeeded = !next || next.type !== 'screen';
  const ex = exitNeeded ? interpolate(local, [seg.dur - 16, seg.dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) }) : 0;
  const shift = (l: L): L => ({ ...l, x: l.x + (1 - enter) * 160 - ex * 140, o: l.o * Math.min(1, enter * 1.3) * (1 - ex) });
  la = shift(la); lb = shift(lb);
  // active emphasis in split
  const isSplit = seg.mode === 'split';
  const prevActive = prevScreen && prevScreen.mode === 'split' && !seg.enter ? prevScreen.page : seg.page;
  const ka = interpolate(local, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const act = (who: string) => (prevActive === who ? 1 - ka : 0) + (seg.page === who ? ka : 0);
  const aAct = isSplit ? act('alice') : 0, bAct = isSplit ? act('bob') : 1;
  const isWipe = seg.id === 's_wipe';
  return (
    <AbsoluteFill>
      <Win l={la} file={isSplit ? fr.a! : (prevScreen?.frames?.[prevScreen.frames.length - 1].a ?? fr.f)} actor={ALICE} dim={isSplit ? 0.38 * (1 - aAct) : 0} glow={isSplit ? aAct : 0} />
      <Win l={lb} file={isSplit ? fr.b! : fr.f} cam={isSplit ? undefined : fr.cam} actor={BOB} dim={isSplit ? 0.38 * (1 - bAct) : 0} glow={isSplit ? bAct : 0} />
      {isWipe && tl.wiped && <WipeBadge local={local} dur={seg.dur} />}
    </AbsoluteFill>
  );
}

function WipeBadge({ local, dur }: { local: number; dur: number }) {
  const { fps } = useVideoConfig();
  const start = Math.round(dur * 0.42);
  const s = spring({ frame: local - start, fps, config: { damping: 16 } });
  const before = tl.wiped!.before.length;
  const after = tl.wiped!.after.length;
  const flip = local - start > 16;
  return (
    <div style={{ position: 'absolute', right: 120, bottom: 110, opacity: s, transform: `translateY(${(1 - s) * 30}px) scale(${0.9 + 0.1 * s})`, background: 'rgba(20,16,32,0.92)', border: `1.5px solid ${C.mon}88`, borderRadius: 18, padding: '18px 26px', boxShadow: `0 20px 60px rgba(0,0,0,.5), 0 0 40px ${C.mon}44`, fontFamily: 'Inter', color: '#fff' }}>
      <div style={{ fontSize: 15, letterSpacing: 2, color: C.ink400, textTransform: 'uppercase', fontWeight: 600 }}>Site data · this origin</div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 30, marginTop: 8, fontWeight: 500 }}>
        localStorage: <span style={{ color: flip ? C.ok : C.monLight }}>{flip ? after : before} keys</span>
      </div>
      <div style={{ fontSize: 17, color: C.ink400, marginTop: 6 }}>{flip ? 'cleared · IndexedDB, cookies, cache too' : 'credential hint + note ciphertext'}</div>
    </div>
  );
}

function ExplorerSeg({ seg, local }: { seg: Seg; local: number }) {
  const { fps } = useVideoConfig();
  const stills = seg.stills || [];
  const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 110 } });
  const ex = interpolate(local, [seg.dur - 9, seg.dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const half = seg.dur * 0.5;
  const H = 1500 * (694 / 1440);
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - ex) }}>
      <div style={{ position: 'absolute', left: BASE_X, top: BASE_Y, transform: `translateX(${(1 - enter) * 140}px) scale(${0.94 + 0.06 * enter})`, transformOrigin: '50% 0' }}>
        <BrowserWindow width={WIN_W} height={H + BAR} bar={BAR} url={seg.url || 'testnet.monadvision.com'} actor={{ name: 'MonadVision', role: 'explorer' }}>
          <div style={{ position: 'relative', width: WIN_W, height: H, overflow: 'hidden', background: '#111' }}>
            {stills.map((s, i) => {
              const o = stills.length === 1 ? 1 : i === 0 ? interpolate(local, [half - 8, half + 8], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : interpolate(local, [half - 8, half + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const pr = i === 0 ? Math.min(1, local / (half + 8)) : Math.max(0, (local - half + 8) / (seg.dur - half + 8));
              const z = 1 + 0.16 * Easing.inOut(Easing.cubic)(pr);
              return <Img key={s} src={staticFile(`explorer/${s}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: o, transform: `scale(${z})`, transformOrigin: i === 0 ? '28% 74%' : '30% 66%' }} />;
            })}
          </div>
        </BrowserWindow>
      </div>
    </AbsoluteFill>
  );
}

export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = tl.segs.findIndex((s) => frame >= s.from && frame < s.from + s.dur);
  const seg = tl.segs[idx] ?? tl.segs[tl.segs.length - 1];
  const local = frame - seg.from;
  const cap = tl.captions.find((c) => frame >= c.from && frame < c.to);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Background frame={frame / 2} />
      {seg.type === 'intro' && <IntroCard local={local / 2} dur={seg.dur / 2} />}
            {seg.type === 'chapter' && <ChapterCard local={local / 2} dur={seg.dur / 2} num={seg.num!} title={seg.title!} sub={seg.sub!} />}
      {seg.type === 'screen' && <ScreenSeg seg={seg} local={local} prev={tl.segs[idx - 1]} next={tl.segs[idx + 1]} />}
      {seg.type === 'explorer' && <ExplorerSeg seg={seg} local={local} />}
      {seg.type === 'outro' && <OutroCard local={local / 2} dur={seg.dur / 2} />}
      {cap && <Caption key={cap.from} text={cap.text} local={(frame - cap.from) / 2} dur={(cap.to - cap.from) / 2} />}
    </AbsoluteFill>
  );
};
