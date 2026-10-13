// Turns the raw recording log into a per-frame timeline for the Remotion Demo
// composition: which source frame to show, camera (zoom/pan) per frame,
// transitions between actors, kinetic captions, chapter cards, intro/outro.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url).pathname;
const RAW = `${ROOT}out/demo/raw/`;
const log = JSON.parse(readFileSync(`${RAW}log.json`, 'utf8'));
const FPS = 60;
const CW = log.W, CH = log.H; // CSS px of the app viewport
const SPEED = 1.12; // human-paced footage, slightly tightened
const FAST = 6; // chain waits
const MIN_FAST_OUT = 0.6; // s

const info = log.info || {};
const scanMs = (info.scan || '').match(/in ([\d,]+) ms/)?.[1];

// ---------- edit decision list ----------
// chapter cards come before the first beat of their step.
const chapters = {
  a_onboard: { num: '01', title: 'Pay privately.', sub: 'Alice → Bob, live on Monad.' },
  s_wipe: { num: '02', title: 'Wipe everything.', sub: 'Nothing is stored.' },
  explorer: { num: '03', title: 'Real. On-chain.', sub: 'Monad testnet.' },
};
const SPEEDS = { story: 1.45 };
// captions: [text, startFraction]; each lasts until the next one (or beat end).
const captions = {
  b_create: [['1 Mera passkey ceremony.', 0.0]],
  b_home: [['Wallet. Spend. View. Vault.', 0.0], ['Mera signing session · no prompts.', 0.5]],
  b_publish: [['Publish to the ERC-6538 registry.', 0.0], ['Signed by the session · no prompt.', 0.55]],
  b_inbox: [["Bob's private inbox.", 0.0]],
  a_onboard: [['Alice: 1 Mera passkey ceremony.', 0.0], ['Mint 100 mUSD · no prompt.', 0.5]],
  a_recipient: [["Paste Bob's plain 0x address.", 0.0], ['Resolved via the registry.', 0.6]],
  a_send_mon: [['Send 0.1 MON privately.', 0.0], ['A brand-new one-time address.', 0.55]],
  b_scan1: [['Bob scans. Found.', 0.0]],
  a_send_musd: [['Then 25 mUSD.', 0.0], ['Mera signing session · no prompts.', 0.55]],
  b_scan2: [[scanMs ? `Found in ${scanMs} ms.` : 'Found instantly.', 0.0]],
  b_note: [['A private note.', 0.0], ['Encrypted with the vault key.', 0.5]],
  b_withdraw: [['Withdraw · short-lived Mera session.', 0.0], ['No prompt. Gas tip swept too.', 0.65]],
  b_balance: [['25 mUSD, home.', 0.0]],
  s_wipe: [['Lock ends every Mera session.', 0.0], ['Then clear all site data.', 0.45]],
  s_unlock: [['1 Mera passkey ceremony.', 0.0], ['Same passkey → same keys.', 0.45]],
  s_inbox: [['Payments rebuilt from chain.', 0.0]],
  explorer: [['25 mUSD → a one-time address.', 0.0], ['ERC-5564 Announcement, on-chain.', 0.5]],
};
const actors = { bob: { name: 'Bob', role: 'recipient' }, alice: { name: 'Alice', role: 'sender' } };

// ---------- helpers ----------
const frames = log.frames;
function frameAt(page, t) {
  const fs = frames[page];
  let lo = 0, hi = fs.length - 1;
  if (t <= fs[0].t) return fs[0].file;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (fs[m].t <= t) lo = m; else hi = m - 1; }
  return fs[lo].file;
}
// Camera follows the live cursor: gentle zoom toward the last cursor target,
// easing back out when the cursor rests for a while.
function camAt(page, t, beatId) {
  if (beatId === 'story') return { s: 1.18, cx: CW / 2, cy: CH / 2 };
  let cur = null;
  for (const c of log.cursor) if (c.page === page && c.t <= t) cur = c;
  if (!cur || t - cur.t > 4) return { s: 1.04, cx: CW / 2, cy: CH / 2 };
  return { s: 1.16, cx: cur.x, cy: cur.y };
}
function clampCam(c) {
  const hw = CW / 2 / c.s, hh = CH / 2 / c.s;
  return { s: c.s, cx: Math.min(Math.max(c.cx, hw), CW - hw), cy: Math.min(Math.max(c.cy, hh), CH - hh) };
}
// piecewise time map for a beat: output seconds -> source time
function warp(beat) {
  const pieces = [];
  let t = beat.t0;
  const fast = log.fast.filter((f) => f.page === beat.page && f.t1 > beat.t0 && f.t0 < beat.t1)
    .map((f) => ({ t0: Math.max(f.t0, beat.t0), t1: Math.min(f.t1 ?? beat.t1, beat.t1) })).sort((a, b) => a.t0 - b.t0);
  for (const f of fast) {
    if (f.t0 > t) pieces.push({ s0: t, s1: f.t0, speed: SPEEDS[beat.id] ?? SPEED });
    const len = f.t1 - Math.max(f.t0, t);
    if (len > 0) pieces.push({ s0: Math.max(f.t0, t), s1: f.t1, speed: Math.max(1, Math.min(FAST, len / MIN_FAST_OUT)) });
    t = Math.max(t, f.t1);
  }
  if (t < beat.t1) pieces.push({ s0: t, s1: beat.t1, speed: SPEEDS[beat.id] ?? SPEED });
  let o = 0;
  for (const p of pieces) { p.o0 = o; o += (p.s1 - p.s0) / p.speed; p.o1 = o; }
  return { pieces, out: o, map: (ot) => { const p = pieces.find((q) => ot <= q.o1) || pieces[pieces.length - 1]; return p.s0 + Math.min(ot - p.o0, p.o1 - p.o0) * p.speed; } };
}

// ---------- build ----------
const segs = []; // {type, from, dur, ...}
let cursor = 0; // frames
const add = (seg) => { seg.from = cursor; segs.push(seg); cursor += seg.dur; return seg; };
const sec = (s) => Math.round(s * FPS);

add({ type: 'intro', dur: sec(2.8) });
const capList = [];
let prevMode = null;
for (const beat of log.beats) {
  if (!beat.t1) continue;
  if (chapters[beat.id]) add({ type: 'chapter', dur: sec(1.5), ...chapters[beat.id] });
  const w = warp(beat);
  const mode = beat.split ? 'split' : 'solo';
  const seg = add({ type: 'screen', id: beat.id, page: beat.page, mode, actor: actors[beat.page], dur: Math.round(w.out * FPS), enter: !!chapters[beat.id] || prevMode === null });
  seg.frames = [];
  for (let i = 0; i < seg.dur; i++) {
    const st = w.map(i / FPS);
    const fr = { f: frameAt(beat.page, st), target: clampCam(mode === 'split' ? { s: 1, cx: CW / 2, cy: CH / 2 } : camAt(beat.page, st, beat.id)) };
    if (mode === 'split') { fr.a = frameAt('alice', st); fr.b = frameAt('bob', st); }
    seg.frames.push(fr);
  }
  for (const [k, [text, frac]] of (captions[beat.id] || []).entries()) {
    const list = captions[beat.id];
    const next = list[k + 1];
    capList.push({ text, from: seg.from + Math.round(frac * seg.dur), to: next ? seg.from + Math.round(next[1] * seg.dur) : seg.from + seg.dur });
  }
  prevMode = mode;
}
// explorer stills (captured from a real browser after the run)
const stills = ['explorer-1.png', 'explorer-2.png'].filter((f) => existsSync(`${ROOT}out/demo/explorer/${f}`));
add({ type: 'chapter', dur: sec(1.5), ...chapters.explorer });
const ex = add({ type: 'explorer', dur: sec(stills.length ? 5.5 : 0.1), stills, url: info.sent?.musd ? `testnet.monadvision.com/tx/${info.sent.musd.slice(0, 10)}…${info.sent.musd.slice(-6)}` : 'testnet.monadvision.com' });
for (const [k, [text, frac]] of captions.explorer.entries()) {
  const next = captions.explorer[k + 1];
  capList.push({ text, from: ex.from + Math.round(frac * ex.dur), to: next ? ex.from + Math.round(next[1] * ex.dur) : ex.from + ex.dur });
}
add({ type: 'outro', dur: sec(5.5) });

// camera spring per screen segment (critically damped), snapped at entry
for (const seg of segs.filter((s) => s.type === 'screen')) {
  let c = { ...seg.frames[0].target }, v = { s: 0, cx: 0, cy: 0 };
  const w0 = 3.2, dt = 1 / FPS;
  for (const fr of seg.frames) {
    for (const k of ['s', 'cx', 'cy']) {
      const a = w0 * w0 * (fr.target[k] - c[k]) - 2 * w0 * v[k];
      v[k] += a * dt; c[k] += v[k] * dt;
    }
    fr.cam = { s: +c.s.toFixed(4), cx: +c.cx.toFixed(2), cy: +c.cy.toFixed(2) };
    delete fr.target;
  }
}
// carry camera across contiguous same-page segments: start where previous ended
const total = cursor;
const wm = log.marks.find((m) => m.name === 'wiped');
const tl = { fps: FPS, total, W: CW, H: CH, segs, captions: capList, info: { ...info, scanMs }, url: log.url, wiped: wm ? { before: wm.before, after: wm.after } : undefined };
writeFileSync(`${ROOT}remotion/timeline.json`, JSON.stringify(tl));
console.log('timeline', (total / FPS).toFixed(1), 's,', segs.length, 'segments');
for (const s of segs) console.log(String((s.from / FPS).toFixed(1)).padStart(6), s.type.padEnd(8), s.id || s.title || '', (s.dur / FPS).toFixed(1));
