// Cuts real app clips (60fps CFR H.264) out of the raw recording for reuse in
// the pitch and ad: video/assets/clips/<name>.mp4
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../../', import.meta.url).pathname;
const RAW = `${ROOT}out/demo/raw/`;
const OUT = `${ROOT}assets/clips/`;
mkdirSync(OUT, { recursive: true });
const log = JSON.parse(readFileSync(`${RAW}log.json`, 'utf8'));
const beat = (id) => log.beats.find((b) => b.id === id);

function concatList(page, t0, t1, file) {
  const fs = log.frames[page];
  let i = fs.findLastIndex((f) => f.t <= t0);
  if (i < 0) i = 0;
  const lines = [];
  for (; i < fs.length && fs[i].t < t1; i++) {
    const start = Math.max(fs[i].t, t0);
    const end = Math.min(fs[i + 1]?.t ?? t1, t1);
    lines.push(`file '${RAW}${fs[i].file}'`, `duration ${Math.max(0.001, end - start).toFixed(4)}`);
  }
  lines.push(lines[lines.length - 2]);
  writeFileSync(file, lines.join('\n'));
}
const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
function clip(name, page, ids) {
  const t0 = beat(ids[0]).t0, t1 = beat(ids[ids.length - 1]).t1;
  const list = `${ROOT}out/demo/${name}.txt`;
  concatList(page, t0, t1, list);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=60,scale=1920:1620:flags=lanczos', ...enc, `${OUT}${name}.mp4`]);
  console.log(name, (t1 - t0).toFixed(1) + 's');
}
function split(name, ids) {
  const t0 = beat(ids[0]).t0, t1 = beat(ids[ids.length - 1]).t1;
  concatList('alice', t0, t1, `${ROOT}out/demo/${name}-a.txt`);
  concatList('bob', t0, t1, `${ROOT}out/demo/${name}-b.txt`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${ROOT}out/demo/${name}-a.txt`, '-f', 'concat', '-safe', '0', '-i', `${ROOT}out/demo/${name}-b.txt`,
    '-filter_complex', '[0]fps=60,scale=1920:1620[a];[1]fps=60,scale=1920:1620[b];[a][b]hstack,trim=duration=' + (t1 - t0).toFixed(3), ...enc, `${OUT}${name}.mp4`]);
  console.log(name, (t1 - t0).toFixed(1) + 's');
}
clip('story', 'bob', ['story']);
clip('create', 'bob', ['b_create', 'b_home']);
clip('send-mon', 'alice', ['a_recipient', 'a_send_mon']);
clip('send-musd', 'alice', ['a_send_musd']);
clip('scan', 'bob', ['b_scan2']);
clip('withdraw', 'bob', ['b_note', 'b_withdraw', 'b_balance']);
clip('unlock', 'bob', ['s_wipe', 's_unlock', 's_inbox']);
split('split', ['a_send_mon', 'b_scan1', 'a_send_musd', 'b_scan2']);
