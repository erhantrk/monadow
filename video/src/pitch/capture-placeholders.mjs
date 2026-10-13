import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'out/pitch/app-placeholder');
const base = 'http://localhost:5173/monadow/';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
await p.goto(base); await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(out, 'landing.png') });
await p.evaluate(() => window.__monadowDevUnlock(7));
for (const [name, hash] of [['home', '#/home'], ['send', '#/send'], ['inbox', '#/inbox'], ['withdraw', '#/inbox']]) {
  await p.goto(base + hash); await p.waitForTimeout(500);
  await p.evaluate(() => window.__monadowDevUnlock(7)).catch(() => {});
  await p.waitForTimeout(3500);
  await p.screenshot({ path: path.join(out, name + '.png') });
  console.log(name, p.url());
}
await b.close();
