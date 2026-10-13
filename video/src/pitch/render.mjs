// Monadow pitch video renderer (music-only kinetic-typography launch film).
//   node src/pitch/render.mjs                    -> video/monadow-pitch.mp4
//   node src/pitch/render.mjs --stills 5,30,60   -> PNG stills only (out/pitch/stills)
//   node src/pitch/render.mjs --music some.wav   -> use an existing soundtrack instead of generating one
// The page (src/pitch/index.html) exposes window.seek(t); every frame is set deterministically and screenshotted.
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..'); // video/
const OUT = path.join(ROOT, 'out/pitch');
const FPS = 30;
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const stills = arg('--stills') ? arg('--stills').split(',').map(Number) : null;
fs.mkdirSync(OUT, { recursive: true });
const probe = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// images: prefer assets/app/<name>.png, else generated placeholders
const images = {}, real = {};
for (const n of ['home', 'send', 'inbox', 'withdraw', 'inbox-restored']) {
  const r = path.join(ROOT, 'assets/app', n + '.png');
  let ph = path.join(OUT, 'app-placeholder', n + '.png');
  if (!fs.existsSync(ph)) ph = path.join(OUT, 'app-placeholder', n === 'inbox-restored' ? 'inbox.png' : 'landing.png');
  const f = fs.existsSync(r) ? r : ph;
  images[n] = pathToFileURL(f).href; real[n] = f === r;
  console.log(`  image ${n.padEnd(15)} ${path.relative(ROOT, f)}`);
}

// recorded landing story (node src/pitch/record-story.mjs)
let story = null;
{
  const dir = path.join(OUT, 'story'), mf = path.join(dir, 'marks.json');
  if (fs.existsSync(mf)) {
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    const p = Object.fromEntries(m.pauses.map((x) => [x.id, x.t]));
    const first = 30, last = Math.min(m.frames - 1, Math.round(((p.s6 ?? 37) + 1.5) * 30));
    story = { dir: pathToFileURL(dir).href, first, last, dur: (last - first) / 30, trail: (p.s1 ?? 5) - 1 - 1.2, passkey: (p.s2 ?? 10) - 1 - 3, pauses: p };
    console.log(`  story: frames ${first}-${last} (${story.dur.toFixed(1)}s)`);
  }
}
// live app clips from assets/clips/*.mp4 -> jpeg sequences (cached); fall back to stills
const CLIPDIR = path.join(ROOT, 'assets/clips');
const okClip = (f) => { try { return fs.existsSync(f) && probe(f) > 0.5; } catch { return false; } };
const has = (n) => okClip(path.join(CLIPDIR, n + '.mp4'));
const plan = [   // [in, out] seconds inside each clip
  { name: 'create', title: 'One passkey. *Your whole account.*', in: 1.0, out: 5.5, still: 'home', url: 'erhantrk.github.io/monadow/#/home' },
  has('split') ? { name: 'split', title: 'Alice pays. *Only Bob can find it.*', in: 0.0, out: 10.2, still: 'send', url: 'Alice  ·  Bob', badge: 'LIVE ON MONAD TESTNET' }
    : { name: 'send-musd', title: 'Send. *Privately.*', in: 6.0, out: 13.4, still: 'send', url: 'erhantrk.github.io/monadow/#/send' },
  { name: 'withdraw', title: 'Withdraw. *No popups.*', in: 5.5, out: 13.0, still: 'withdraw', url: 'erhantrk.github.io/monadow/#/inbox' },
  { name: 'unlock', title: 'Lock. Unlock. *Same account.*', in: 9.0, out: 14.5, still: 'inbox-restored', url: 'erhantrk.github.io/monadow' },
];
const clips = [];
for (const c of plan) {
  const src = path.join(CLIPDIR, c.name + '.mp4');
  if (okClip(src)) {
    const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).toString().trim().split(',').map(Number);
    const dur = probe(src);
    const dir = path.join(OUT, 'clips', c.name);
    const stamp = path.join(dir, '.src-mtime');
    const mt = String(fs.statSync(src).mtimeMs);
    if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== mt) {
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-vf', `fps=30,scale=${w / h > 2 ? 1800 : 1400}:-2:flags=lanczos`, '-q:v', '3', path.join(dir, 'f%05d.jpg')]);
      fs.writeFileSync(stamp, mt);
    }
    const n = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
    const last = Math.min(n - 1, Math.round(c.out * 30)), first = Math.max(0, Math.min(Math.round(c.in * 30), last - 60));
    const slot = (last - first) / 30;
    clips.push({ ...c, frames: n, first, last, slot: +slot.toFixed(3), aspect: w / h, dir: pathToFileURL(dir).href });
    console.log(`  clip ${c.name.padEnd(10)} ${w}x${h} ${dur.toFixed(1)}s -> slot ${slot.toFixed(1)}s`);
  } else {
    clips.push({ ...c, slot: 4, aspect: 16 / 9, still: images[c.still] });
    console.log(`  clip ${c.name.padEnd(10)} MISSING -> still ${c.still}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.addInitScript((d) => { window.__TL = d; }, { images, real, story, clips });
await page.goto(pathToFileURL(path.join(HERE, 'index.html')).href, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
const fontsOk = await page.evaluate(() => document.fonts.check('700 40px "Space Grotesk"') && document.fonts.check('600 30px Inter') && document.fonts.check('600 30px "JetBrains Mono"'));
const marks = await page.evaluate(() => window.__MARKS);
fs.writeFileSync(path.join(OUT, 'pitch-marks.json'), JSON.stringify({ ...marks, storyInfo: story, clips: clips.map(({ name, slot }) => ({ name, slot })) }, null, 1));
const total = marks.total;
const nFrames = Math.round(total * FPS);
console.log(`  fonts ok: ${fontsOk}   total ${total.toFixed(2)}s, ${nFrames} frames`);
console.log('  scene starts: ' + [0, ...marks.scenes].map((s) => s.toFixed(1) + 's').join(' '));

if (stills) {
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of stills) { await page.evaluate((x) => window.seek(x), s); await page.screenshot({ path: path.join(dir, `s-${s}.png`) }); }
  console.log('  stills -> ' + dir);
  await browser.close(); process.exit(0);
}

// soundtrack
let music = arg('--music');
if (!music) {
  music = path.join(OUT, 'music.wav');
  const gen = path.join(ROOT, 'src/music/make.mjs');
  if (fs.existsSync(gen)) {
    const a = [gen, String(Math.ceil(total + 1)), music, `--build=${marks.story.toFixed(2)}`, `--kick=${marks.solution.toFixed(2)}`, `--drop=${marks.cta.toFixed(2)}`, `--duck=${marks.boom.toFixed(2)}`];
    console.log('  music: node ' + a.map((x) => (x.startsWith('/') ? path.relative(ROOT, x) : x)).join(' '));
    execFileSync('node', a, { cwd: ROOT, stdio: 'inherit' });
  } else {
    // fallback: simple generated pad
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `aevalsrc='0.2*(0.5+0.5*sin(2*PI*t/19.2))*(sin(2*PI*110*t)+0.6*sin(2*PI*164.81*t)+0.5*sin(2*PI*261.63*t))+0.2*(0.5-0.5*sin(2*PI*t/19.2))*(sin(2*PI*87.31*t)+0.6*sin(2*PI*130.81*t)+0.5*sin(2*PI*220*t))':s=48000:d=${total + 1}`, '-af', 'tremolo=f=0.2:d=0.3,lowpass=f=1200', music]);
  }
}
const audio = path.join(OUT, 'pitch-audio.m4a');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', music, '-af',
  `atrim=0:${total},asetpts=N/SR/TB,loudnorm=I=-18:TP=-1.5:LRA=11,aresample=48000,afade=t=in:d=0.6,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5`,
  '-ac', '2', '-c:a', 'aac', '-b:a', '192k', audio]);

// frames -> ffmpeg
const outMp4 = path.join(ROOT, 'monadow-pitch.mp4');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', audio,
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
  '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-color_range', 'tv', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'copy', '-t', String(total), '-movflags', '+faststart', outMp4], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
const t0 = Date.now();
for (let i = 0; i < nFrames; i++) {
  await page.evaluate((x) => window.seek(x), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 300 === 0) console.log(`  frame ${i}/${nFrames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await done;
await browser.close();
console.log(`\nwrote ${outMp4} (${probe(outMp4).toFixed(2)}s) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
