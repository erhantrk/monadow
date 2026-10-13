// Records the landing page's scroll story frame-by-frame under a virtual clock (deterministic, smooth).
//   node src/pitch/record-story.mjs [--probe] [--url http://localhost:5173/monadow/]
// Output: out/pitch/story/f00000.jpg ... + out/pitch/story/marks.json
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'out/pitch/story');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:5173/monadow/');
const probe = process.argv.includes('--probe');
const FPS = 30, SPEED = +arg('--speed', 380), PAUSE = +arg('--pause', 0.9);

const clock = () => {
  let now = 0; const T0 = 1760000000000; let q = new Map(), id = 0;
  performance.now = () => now; Date.now = () => T0 + now;
  window.requestAnimationFrame = (cb) => { q.set(++id, cb); return id; };
  window.cancelAnimationFrame = (i) => q.delete(i);
  window.__step = (dt) => { now += dt; const cbs = [...q.values()]; q = new Map(); for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } } };
};
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'dark' });
page.on('pageerror', (e) => console.error('PAGE', e.message));
await page.addInitScript(clock);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
for (let i = 0; i < 90; i++) await page.evaluate(() => window.__step(16.667));
const info = await page.evaluate(() => {
  const vh = innerHeight;
  const pins = [...document.querySelectorAll('.pin-spacer')].map((s) => {
    const r = s.getBoundingClientRect(); const id = s.firstElementChild?.id;
    return { id, top: Math.round(r.top + scrollY), h: Math.round(r.height), len: Math.round(r.height - vh) };
  });
  return { vh, total: document.documentElement.scrollHeight, pins };
});
console.log(JSON.stringify(info, null, 1));
if (probe) { await page.screenshot({ path: path.join(OUT, 'probe.jpg'), type: 'jpeg' }); await b.close(); process.exit(0); }

// scroll plan: constant speed; hold PAUSE s at ~92% of each pin
const stops = info.pins.map((p) => p.top + p.len * 0.92);
const endY = Math.min(info.total - info.vh, +arg('--end', info.total));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
let target = 0, frame = 0, hold = 0, si = 0; const marks = [];
const shot = async () => { const buf = await page.screenshot({ type: 'jpeg', quality: 90 }); fs.writeFileSync(path.join(OUT, `f${String(frame).padStart(5, '0')}.jpg`), buf); frame++; };
// lead-in: 1s on the hero
for (let i = 0; i < FPS; i++) { await page.evaluate(() => { window.__step(16.667); window.__step(16.667); }); await shot(); }
while (target < endY) {
  let dy = 0;
  if (hold > 0) hold--;
  else {
    dy = SPEED / FPS;
    if (si < stops.length && target + dy >= stops[si]) { dy = stops[si] - target; hold = Math.round(PAUSE * FPS); marks.push({ id: info.pins[si].id, frame, t: frame / FPS }); si++; }
  }
  target += dy;
  await page.evaluate((d) => { if (d > 0) window.dispatchEvent(new WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true })); window.__step(16.667); window.__step(16.667); }, dy);
  await shot();
  if (frame % 300 === 0) console.log('frame', frame, 'y', Math.round(target));
}
for (let i = 0; i < FPS * 1.5; i++) { await page.evaluate(() => { window.__step(16.667); window.__step(16.667); }); await shot(); }
// record scene starts too
const starts = info.pins.map((p) => ({ id: p.id, y: p.top }));
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ fps: FPS, frames: frame, speed: SPEED, pauses: marks, starts, info }, null, 1));
console.log('frames', frame, (frame / FPS).toFixed(1) + 's', marks);
await b.close();
