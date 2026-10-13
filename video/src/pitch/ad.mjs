// 30-second ad cut assembled from the rendered pitch (run render.mjs first).
//   node src/pitch/ad.mjs  -> video/monadow-ad-30s.mp4
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(ROOT, 'monadow-pitch.mp4');
// [start, end] in pitch seconds: problem explosion -> doxxes, passkey -> privately, send+inbox, CTA
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/pitch/pitch-marks.json'), 'utf8'));
const st = (p) => M.story + (M.storyInfo.pauses[p] - 1.0);   // pitch time of a landing-story pause
let pt = M.story + M.storyInfo.dur; const clipAt = {};
for (const c of M.clips) { clipAt[c.name] = [pt, pt + c.slot]; pt += c.slot; }
const split = clipAt.split || clipAt['send-musd'];
const segs = [
  [st('s1') - 3.5, st('s1') + 0.7],          // every payment leaves a trail
  [st('s2') - 2.9, st('s2') + 0.7],          // one passkey
  [st('s4') - 2.6, st('s4') + 0.6],          // paid to a brand-new address
  [split[0], split[1] - 0.2],                // Alice pays, Bob finds it
  [clipAt.withdraw[0], clipAt.withdraw[0] + 5.4],
  [M.cta, M.cta + 7.5],
];
const X = 0.5; // crossfade
let fc = segs.map(([a, b], i) => `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[v${i}]`).join(';');
let prev = 'v0', off = 0;
for (let i = 1; i < segs.length; i++) {
  off += segs[i - 1][1] - segs[i - 1][0] - X;
  fc += `;[${prev}][v${i}]xfade=transition=fade:duration=${X}:offset=${off.toFixed(3)}[x${i}]`;
  prev = `x${i}`;
}
const total = segs.reduce((s, [a, b]) => s + b - a, 0) - X * (segs.length - 1);
fc += `;[${prev}]fade=t=out:st=${(total - 1).toFixed(2)}:d=1,format=yuv420p[v]`;
const music = path.join(ROOT, 'out/pitch/ad-music.wav');
const gen = path.join(ROOT, 'src/music/make.mjs');
if (fs.existsSync(gen)) execFileSync('node', [gen, String(Math.ceil(total + 1)), music, '--build=0', `--kick=${(segs[0][1] - segs[0][0] - X).toFixed(2)}`, `--drop=${(total - 7.5).toFixed(2)}`], { cwd: ROOT, stdio: 'inherit' });
fc += `;[1:a]atrim=0:${total.toFixed(3)},asetpts=N/SR/TB,loudnorm=I=-18:TP=-1.5:LRA=11,aresample=48000,afade=t=in:d=0.3,afade=t=out:st=${(total - 2).toFixed(2)}:d=2[a]`;
const out = path.join(ROOT, 'monadow-ad-30s.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-i', music, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-movflags', '+faststart', '-t', total.toFixed(3), out], { stdio: 'inherit' });
console.log(`wrote ${out} (${total.toFixed(2)}s)`);
