// Records the real Monadow app on Monad testnet: two browser contexts (Bob,
// Alice), each with a CDP virtual authenticator (PRF on), CDP screencast at 2x.
// Output: out/demo/raw/<page>/*.jpg + out/demo/raw/log.json (frames, beats, focus boxes).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';

const ROOT = new globalThis.URL('../../', import.meta.url).pathname;
const RAW = `${ROOT}out/demo/raw/`;
const APP = process.env.APP_URL || 'https://erhantrk.github.io/monadow/';
const ORIGIN = new globalThis.URL(APP).origin;
const W = 960, H = 810, DSF = 2;
// Minimum source length per beat (s). Waits on the chain are wrapped in fast()
// so the editor can compress them; human-paced actions play at 1x.
const HOLD = {};

// --- env (never printed) ---
const env = Object.fromEntries(readFileSync(`${ROOT}../.env`, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
function fund(addr, eth) {
  console.log(`funding ${addr} with ${eth} MON`);
  const out = execFileSync('cast', ['send', '--rpc-url', env.MONAD_RPC_URL, '--private-key', env.DEPLOYER_PRIVATE_KEY, addr, '--value', `${eth}ether`, '--json'], { env: { ...process.env } }).toString();
  const j = JSON.parse(out);
  console.log('fund tx', j.transactionHash, j.status);
  return j.transactionHash;
}

rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });
const log = { url: APP, W, H, DSF, frames: {}, beats: [], focus: [], marks: [], fast: [], cursor: [], info: {} };
const now = () => Date.now() / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR_JS = `
(() => {
  if (window.__cur) return; window.__cur = 1;
  const add = () => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.4 L14.4 20.2 L11.4 13.7 L17.6 13.4 Z" fill="#fff" stroke="#0E0B16" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {position:'fixed',left:'0',top:'0',width:'26px',height:'26px',zIndex:2147483647,pointerEvents:'none',transform:'translate(-200px,-200px)',filter:'drop-shadow(0 0 6px rgba(131,110,249,.9)) drop-shadow(0 2px 3px rgba(0,0,0,.6))'});
    const halo = document.createElement('div');
    Object.assign(halo.style, {position:'fixed',left:'-22px',top:'-22px',width:'44px',height:'44px',borderRadius:'50%',background:'radial-gradient(circle, rgba(131,110,249,.35), rgba(131,110,249,0) 70%)',zIndex:2147483646,pointerEvents:'none',transform:'translate(-200px,-200px)'});
    document.documentElement.appendChild(halo); document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 2) + 'px)'; halo.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      Object.assign(r.style, {position:'fixed',left:(e.clientX-6)+'px',top:(e.clientY-6)+'px',width:'12px',height:'12px',borderRadius:'50%',border:'3px solid #836EF9',boxShadow:'0 0 18px #836EF9',zIndex:2147483646,pointerEvents:'none',transition:'all .55s cubic-bezier(.2,.8,.2,1)',opacity:'1'});
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => requestAnimationFrame(() => { Object.assign(r.style, {left:(e.clientX-30)+'px',top:(e.clientY-30)+'px',width:'60px',height:'60px',opacity:'0'}); }));
      setTimeout(() => r.remove(), 700);
    }, true);
  };
  if (document.documentElement) add(); else addEventListener('DOMContentLoaded', add);
})();`;

const browser = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=2'] });
const AUTH = { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true };

async function makeActor(name) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, colorScheme: 'dark' });
  await ctx.addInitScript(CURSOR_JS);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', (e) => console.log(`[${name} pageerror]`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name} console]`, m.text().slice(0, 300)); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: AUTH });
  mkdirSync(`${RAW}${name}`, { recursive: true });
  const frames = (log.frames[name] = []);
  let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const file = `${name}/${String(n++).padStart(6, '0')}.jpg`;
    writeFileSync(RAW + file, Buffer.from(f.data, 'base64'));
    frames.push({ t: f.metadata.timestamp ?? now(), file });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
  return { name, ctx, page, cdp, authenticatorId, mouse: { x: W / 2, y: H / 2 } };
}

// Smooth eased cursor move + click.
async function moveTo(a, x, y, ms = 650) {
  const { x: x0, y: y0 } = a.mouse;
  const start = Date.now();
  for (;;) {
    const k = Math.min(1, (Date.now() - start) / ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    await a.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
    if (k >= 1) break;
    await sleep(12);
  }
  a.mouse = { x, y };
  log.cursor.push({ t: now(), page: a.name, x, y });
}
async function boxOf(loc) {
  // (no scrollIntoView: animated elements never become 'stable')
  const b = await loc.boundingBox({ timeout: 2500 });
  if (!b) throw new Error('no box');
  return b;
}
async function reveal(a, loc) {
  for (let i = 0; i < 40; i++) {
    const b = await loc.boundingBox({ timeout: 2500 }).catch(() => null);
    if (!b) return;
    const top = 90, bottom = H - 60;
    if (b.y >= top && b.y + b.height <= bottom) return;
    const want = b.y < top ? b.y - top - 40 : b.y + b.height - bottom + 60;
    const step = Math.sign(want) * Math.min(Math.abs(want), 60);
    await a.page.mouse.wheel(0, step);
    await sleep(16);
  }
}
async function hover(a, loc, ms) {
  await reveal(a, loc);
  const b = await boxOf(loc);
  await moveTo(a, b.x + b.width / 2, b.y + b.height / 2, ms);
}
async function click(a, loc, ms = 650) {
  await loc.waitFor({ state: 'visible', timeout: 30000 });
  await hover(a, loc, ms);
  await sleep(140);
  await a.page.mouse.down();
  await sleep(70);
  await a.page.mouse.up();
}
async function type(a, loc, text, delay = 38) {
  await click(a, loc);
  await loc.pressSequentially(text, { delay });
}
// Ask the compositor to zoom onto an element (box in CSS px) from now on.
async function focus(a, loc, scale = 1.6, pad = 40) {
  const b = await boxOf(loc);
  log.focus.push({ t: now(), page: a.name, box: { x: b.x - pad, y: b.y - pad, w: b.width + 2 * pad, h: b.height + 2 * pad }, scale });
}
function unfocus(a) { log.focus.push({ t: now(), page: a.name, box: null }); }
function mark(name, extra = {}) { log.marks.push({ t: now(), name, ...extra }); }
// Wrap a wait (tx confirmation, scan) so the editor fast-forwards it.
async function fast(a, p) {
  const e = { page: a.name, t0: now(), t1: null };
  log.fast.push(e);
  try { return await p; } finally { e.t1 = now(); }
}

// beat(id, actor, fn): run actions, then idle until the beat lasts >= narration + PAD.
async function beat(id, a, fn, opts = {}) {
  const target = HOLD[id] ?? 3;
  const t0 = now();
  console.log(`▶ ${id} (${target.toFixed(1)}s)`);
  const entry = { id, page: a?.name ?? null, split: !!opts.split, t0, t1: null };
  log.beats.push(entry);
  if (fn) await fn();
  const el = now() - t0;
  if (el < target) await sleep((target - el) * 1000);
  entry.t1 = now();
  console.log(`  ${id} took ${(entry.t1 - t0).toFixed(1)}s`);
  save();
}
function save() { writeFileSync(`${RAW}log.json`, JSON.stringify(log)); }
async function shot(a, name) {
  mkdirSync(`${ROOT}assets/app`, { recursive: true });
  await a.page.screenshot({ path: `${ROOT}assets/app/${name}.png` }).catch(() => {});
}
async function accountAddress(a) {
  const href = await a.page.locator('a[href*="/address/0x"]').first().getAttribute('href');
  return href.match(/0x[0-9a-fA-F]{40}/)[0];
}
async function waitBalance(a, symbol, pred, timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const txt = await a.page.locator(`text=${symbol}`).first().locator('xpath=..').innerText().catch(() => '');
    const v = parseFloat((txt.match(/[\d.,]+/g) || ['0']).pop().replace(/,/g, ''));
    if (pred(v)) return v;
    await sleep(700);
  }
  throw new Error(`balance ${symbol} timeout`);
}
const btn = (p, name) => p.getByRole('button', { name }).first();

async function wheelScroll(a, total, pxPerSec = 620) {
  // Constant-speed wheel scroll so Lenis + ScrollTrigger scrub smoothly.
  const t0 = Date.now();
  let done = 0;
  while (done < total) {
    const target = Math.min(total, ((Date.now() - t0) / 1000) * pxPerSec);
    const d = target - done;
    if (d >= 1) { await a.page.mouse.wheel(0, d); done += d; }
    await sleep(16);
  }
}

try {
  const bob = await makeActor('bob');
  const alice = await makeActor('alice');

  // ---------------- Alice pre-setup (off camera) ----------------
  await alice.page.goto(APP);
  await btn(alice.page, /Create new passkey/).click();
  await alice.page.waitForURL(/home/, { timeout: 30000 });
  const aliceAddr = await accountAddress(alice);
  log.info.alice = aliceAddr;
  fund(aliceAddr, process.env.ALICE_MON || '0.45');
  await btn(alice.page, /Lock/).click();
  await alice.page.waitForTimeout(800);
  await alice.page.evaluate(() => window.scrollTo(0, 0));

  // ---------------- Bob: landing story -> create ----------------
  await bob.page.goto(APP);
  await bob.page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1500);
  await moveTo(bob, W * 0.62, H * 0.55, 600);
  await beat('story', bob, async () => {
    await sleep(1200);
    const total = await bob.page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await wheelScroll(bob, total, Number(process.env.STORY_PXS || 640));
    await sleep(1500);
  });
  await beat('b_create', bob, async () => {
    await click(bob, bob.page.getByRole('button', { name: /Create new passkey/ }).last(), 900);
    await bob.page.waitForURL(/home/, { timeout: 30000 });
    await sleep(1200);
  });
  const bobAddr = await accountAddress(bob);
  log.info.bob = bobAddr;
  await beat('b_home', bob, async () => {
    await hover(bob, bob.page.locator('text=/0x[0-9a-fA-F]{6}…/').first(), 800);
    await sleep(1400);
    await hover(bob, bob.page.locator('text=/Signing session active/').first(), 800);
    await sleep(1600);
  });
  await shot(bob, 'home-fresh');
  fund(bobAddr, process.env.BOB_MON || '0.1');
  await bob.page.locator('button:has-text("Refresh")').click();
  await sleep(2500);
  await beat('b_publish', bob, async () => {
    await sleep(400);
    await click(bob, btn(bob.page, /Publish meta-address on-chain/), 800);
    await fast(bob, bob.page.locator('text=Published').first().waitFor({ timeout: 45000 }));
    await sleep(1400);
  });
  await shot(bob, 'home');
  await beat('b_inbox', bob, async () => {
    await click(bob, bob.page.getByRole('link', { name: /Inbox/ }).first(), 800);
    await bob.page.waitForURL(/inbox/);
    await fast(bob, bob.page.locator('text=/Scanned \\d/').first().waitFor({ timeout: 30000 }).catch(() => {}));
    await sleep(800);
    await moveTo(bob, W * 0.86, 160, 700); // rest near "Scan again"
  });

  // ---------------- Split: Alice sends, Bob receives ----------------
  const S = { split: true };
  await beat('a_onboard', alice, async () => {
    await sleep(500);
    await click(alice, btn(alice.page, /Continue with passkey/), 900);
    await alice.page.waitForURL(/home/, { timeout: 30000 });
    await sleep(700);
    await click(alice, btn(alice.page, /Mint 100 mUSD/), 800);
    await fast(alice, alice.page.locator('text=/Minted 100/').first().waitFor({ timeout: 40000 }).catch(() => sleep(3000)));
    await sleep(900);
  }, S);
  await beat('a_recipient', alice, async () => {
    await click(alice, alice.page.getByRole('link', { name: /Send/ }).first(), 700);
    await alice.page.waitForURL(/send/);
    await sleep(400);
    await type(alice, alice.page.getByPlaceholder(/st:monad/), bobAddr, 22);
    await fast(alice, alice.page.locator('text=/Registered/').first().waitFor({ timeout: 20000 }));
    await sleep(900);
  }, S);
  const sentHashes = {};
  await beat('a_send_mon', alice, async () => {
    await type(alice, alice.page.getByPlaceholder('0.0'), '0.1', 110);
    await sleep(300);
    await click(alice, btn(alice.page, /Send privately/), 600);
    await fast(alice, alice.page.locator('text=/Sent privately/').waitFor({ timeout: 45000 }));
    await sleep(2600); // success animation: sever + scramble
    sentHashes.mon = (await alice.page.locator('a[href*="/tx/0x"]').first().getAttribute('href')).match(/0x[0-9a-f]{64}/i)[0];
  }, S);
  await beat('b_scan1', bob, async () => {
    await click(bob, btn(bob.page, /Scan again/), 600);
    await fast(bob, bob.page.locator('li', { hasText: 'MON' }).first().waitFor({ timeout: 30000 }));
    await sleep(1600);
  }, S);
  await beat('a_send_musd', alice, async () => {
    await click(alice, btn(alice.page, /Send another/), 600);
    await sleep(400);
    const rec = alice.page.getByPlaceholder(/st:monad/);
    if (!(await rec.inputValue())) await type(alice, rec, bobAddr, 6);
    await fast(alice, alice.page.locator('text=/Registered/').first().waitFor({ timeout: 20000 }));
    await click(alice, alice.page.getByRole('button', { name: /^mUSD/ }).first(), 500);
    const amt = alice.page.getByPlaceholder('0.0');
    await amt.fill('');
    await type(alice, amt, '25', 120);
    await fast(alice, sleep(1500));
    await click(alice, btn(alice.page, /Send privately/), 600);
    await fast(alice, alice.page.locator('text=/Sent privately/').waitFor({ timeout: 60000 }));
    await sleep(2600);
  }, S);
  sentHashes.musd = (await alice.page.locator('a[href*="/tx/0x"]').first().getAttribute('href')).match(/0x[0-9a-f]{64}/i)[0];
  log.info.sent = sentHashes;
  log.info.stealth = await alice.page.locator('a[href*="/address/0x"]').first().innerText().catch(() => null);
  await shot(alice, 'send');
  await beat('b_scan2', bob, async () => {
    await click(bob, btn(bob.page, /Scan again/), 600);
    await fast(bob, bob.page.locator('li', { hasText: 'mUSD' }).first().waitFor({ timeout: 30000 }));
    log.info.scan = await bob.page.locator('text=/Scanned \\d/').first().innerText().catch(() => null);
    await sleep(1800);
  }, S);
  await shot(bob, 'inbox');

  // ---------------- Bob: note + withdraw ----------------
  const musdRow = bob.page.locator('li', { hasText: 'mUSD' }).first();
  await beat('b_note', bob, async () => {
    await click(bob, musdRow.locator('text=Add private note'), 700);
    await type(bob, musdRow.locator('input'), 'Invoice #12 from Alice', 45);
    await click(bob, musdRow.locator('button:has-text("Encrypt")'), 500);
    await sleep(1300);
  });
  await beat('b_withdraw', bob, async () => {
    await click(bob, musdRow.getByRole('button', { name: /^Withdraw$/ }), 700);
    await sleep(500);
    await click(bob, musdRow.locator('button:has-text("My account")'), 600);
    await click(bob, musdRow.getByRole('button', { name: /Withdraw 25/ }), 600);
    await fast(bob, (async () => {
      await musdRow.locator('text=/Withdrawn to/').waitFor({ timeout: 90000 });
      await musdRow.locator('text=/Leftover MON/').waitFor({ timeout: 60000 }).catch(() => console.log('no sweep line'));
    })());
    await sleep(1600);
  });
  log.info.withdraw = await musdRow.locator('a[href*="/tx/0x"]').evaluateAll((as) => as.map((a) => a.href));
  await shot(bob, 'withdraw');
  await beat('b_balance', bob, async () => {
    await click(bob, bob.page.getByRole('link', { name: /Home/ }).first(), 700);
    await bob.page.waitForURL(/home/);
    await sleep(600);
    await hover(bob, bob.page.locator('text=MUSD').first(), 700);
    await sleep(2200);
  });

  // ---------------- Stateless test ----------------
  await beat('s_wipe', bob, async () => {
    await hover(bob, bob.page.locator('text=/Signing session active/').first(), 700);
    await sleep(800);
    await click(bob, btn(bob.page, /Lock/), 600);
    await sleep(1200);
    const before = await bob.page.evaluate(() => Object.keys(localStorage));
    await bob.cdp.send('Storage.clearDataForOrigin', { origin: ORIGIN, storageTypes: 'all' });
    await bob.ctx.clearCookies();
    const after = await bob.page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); return Object.keys(localStorage); });
    mark('wiped', { before, after });
    console.log('localStorage before', before, 'after', after);
    await bob.page.reload();
    await sleep(1800);
  });
  await beat('s_unlock', bob, async () => {
    await click(bob, btn(bob.page, /Continue with passkey/), 900);
    await bob.page.waitForURL(/home/, { timeout: 30000 });
    await sleep(800);
    await bob.page.locator('text=Published').first().waitFor({ timeout: 20000 }).catch(() => console.log('published badge missing'));
    const addr2 = await accountAddress(bob);
    log.info.bobAfter = addr2;
    console.log('same account?', addr2 === bobAddr);
    await hover(bob, bob.page.locator('text=/0x[0-9a-fA-F]{6}…/').first(), 700);
    await sleep(1200);
    await hover(bob, bob.page.locator('text=Published').first(), 700);
    await sleep(1400);
  });
  await beat('s_inbox', bob, async () => {
    await click(bob, bob.page.getByRole('link', { name: /Inbox/ }).first(), 800);
    await fast(bob, bob.page.locator('text=/withdrawn/').first().waitFor({ timeout: 45000 }));
    await sleep(2200);
  });
  await shot(bob, 'inbox-restored');
  mark('end');
  save();
  console.log('INFO', JSON.stringify(log.info));
  await bob.cdp.send('Page.stopScreencast').catch(() => {});
  await alice.cdp.send('Page.stopScreencast').catch(() => {});
} catch (e) {
  console.error('RECORD FAILED', e);
  save();
  process.exitCode = 1;
} finally {
  await browser.close();
}
