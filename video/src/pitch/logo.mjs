import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = `<!doctype html><html><body style="margin:0;background:#0E0B16;width:1024px;height:1024px;overflow:hidden">
<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(131,110,249,0.28) 0%, rgba(131,110,249,0.08) 32%, rgba(14,11,22,0) 60%)"></div>
<svg viewBox="0 0 32 32" width="680" height="680" style="position:absolute;left:172px;top:172px;filter:drop-shadow(0 0 18px rgba(131,110,249,0.65)) drop-shadow(0 0 60px rgba(131,110,249,0.35))">
<path d="M16 3.2 27.1 9.6v12.8L16 28.8 4.9 22.4V9.6Z" fill="none" stroke="#836EF9" stroke-width="2" stroke-linejoin="round"/>
<mask id="m"><rect width="32" height="32" fill="#fff"/><circle cx="19.4" cy="13.4" r="5.7" fill="#000"/></mask>
<circle cx="16" cy="16" r="6.8" fill="#836EF9" mask="url(#m)"/></svg></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(html);
await p.screenshot({ path: path.join(root, 'logo.png') });
await b.close();
