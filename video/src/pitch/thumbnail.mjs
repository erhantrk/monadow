import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mark = `<svg viewBox="0 0 32 32" width="300" height="300" style="filter:drop-shadow(0 0 16px rgba(131,110,249,.7)) drop-shadow(0 0 50px rgba(131,110,249,.35))"><path d="M16 3.2 27.1 9.6v12.8L16 28.8 4.9 22.4V9.6Z" fill="none" stroke="#836EF9" stroke-width="2" stroke-linejoin="round"/><mask id="m"><rect width="32" height="32" fill="#fff"/><circle cx="19.4" cy="13.4" r="5.7" fill="#000"/></mask><circle cx="16" cy="16" r="6.8" fill="#836EF9" mask="url(#m)"/></svg>`;
let hex = '';
for (let r = -1; r < 14; r++) for (let c = -1; c < 24; c++) { const R = 34, w = Math.sqrt(3) * R, x = c * w + (r & 1 ? w / 2 : 0), y = r * R * 1.5; hex += `<path d="${[0,1,2,3,4,5].map(k => { const a = Math.PI / 180 * (60 * k - 30); return (k ? 'L' : 'M') + (x + R * Math.cos(a)).toFixed(1) + ' ' + (y + R * Math.sin(a)).toFixed(1); }).join(' ')}Z"/>`; }
const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=Space+Grotesk:wght@700&display=block" rel="stylesheet"></head>
<body style="margin:0;width:1280px;height:720px;overflow:hidden;background:#0E0B16;font-family:Inter;color:#F4F1FF;position:relative">
<svg width="1280" height="720" style="position:absolute;inset:0" fill="none" stroke="rgba(131,110,249,.07)" stroke-width="1.2">${hex}</svg>
<div style="position:absolute;inset:0;background:radial-gradient(circle at 26% 50%,rgba(131,110,249,.30),rgba(131,110,249,.06) 35%,transparent 60%),radial-gradient(ellipse at center,transparent 55%,rgba(5,3,10,.6))"></div>
<div style="position:absolute;left:90px;top:210px">${mark}</div>
<div style="position:absolute;left:470px;top:200px">
<div style="display:inline-flex;align-items:center;gap:10px;padding:8px 18px;border-radius:999px;border:1.5px solid rgba(94,230,168,.6);background:rgba(94,230,168,.08);font:600 22px Inter;color:#5EE6A8"><span style="width:10px;height:10px;border-radius:50%;background:#5EE6A8;box-shadow:0 0 10px #5EE6A8"></span>Live on Monad testnet</div>
<div style="font:700 140px 'Space Grotesk';letter-spacing:-.03em;line-height:1;margin-top:22px">Monadow</div>
<div style="font:600 46px Inter;margin-top:22px;line-height:1.25">Private payments.<br><span style="color:#A898FF;text-shadow:0 0 24px rgba(131,110,249,.6)">One passkey.</span></div>
</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: path.join(root, 'thumbnail-pitch.png') });
await b.close();
