// UI E2E — tests the static mockup's existing interactions (goto/selectSub/pickMove/toggleFilter).
// This validates the mockup still works after introducing js/ modules alongside it.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  try {
    const body = readFileSync(join(ROOT, req.url.split('?')[0]));
    res.writeHead(200, { 'Content-Type': MIME[extname(req.url)] ?? 'text/plain' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
const port = await new Promise((r) => server.listen(0, () => r(server.address().port)));
const url = `http://127.0.0.1:${port}/index.html`;

const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: String(e?.message ?? e) }); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

await page.goto(url);
await page.waitForLoadState('networkidle');

// 1. Initial state — home
await check('initial screen is home', async () => {
  const s = await page.evaluate(() => document.body.dataset.screen);
  assert(s === 'home', `expected home, got ${s}`);
});

// 2. Tabbar navigation — all 5 screens switch correctly
for (const target of ['learn', 'practice', 'dex', 'me', 'home']) {
  await check(`tabbar: click → ${target}`, async () => {
    await page.click(`.tabbar button[data-to="${target}"]`);
    const s = await page.evaluate(() => document.body.dataset.screen);
    assert(s === target, `expected ${target}, got ${s}`);
    const current = await page.getAttribute(`.tabbar button[data-to="${target}"]`, 'aria-current');
    assert(current === 'page', `aria-current not set on ${target}`);
  });
}

// 3. Home shortcut — shelf button goes to learn/mywords
await check('home shortcut: shelf → learn/mywords', async () => {
  await page.click('.tabbar button[data-to="home"]');
  await page.click('.item.shelf');
  const s = await page.evaluate(() => document.body.dataset.screen);
  assert(s === 'learn', `screen=${s}`);
  const selected = await page.getAttribute('#tab-learn-mywords', 'aria-selected');
  assert(selected === 'true', `mywords tab not selected, got ${selected}`);
});

// 4. Subnav within learn — quiz / mywords / textbook
await check('learn subnav: switch to textbook', async () => {
  await page.click('#tab-learn-textbook');
  const selected = await page.getAttribute('#tab-learn-textbook', 'aria-selected');
  assert(selected === 'true');
  const visible = await page.evaluate(() => {
    const p = document.querySelector('.screen[data-s="learn"] .subpane[data-sub="textbook"]');
    return p?.classList.contains('active');
  });
  assert(visible, 'textbook pane not active');
});

// 5. Quiz pickMove — radio behavior (only one selected at a time)
await check('quiz pickMove: selecting a move unchecks others', async () => {
  await page.click('#tab-learn-quiz');
  await page.waitForTimeout(100);
  const moves = await page.$$('.moves .move');
  assert(moves.length >= 2, `expected >= 2 moves, got ${moves.length}`);
  await moves[0].click();
  const checked0 = await moves[0].getAttribute('aria-checked');
  const checked1 = await moves[1].getAttribute('aria-checked');
  assert(checked0 === 'true', 'clicked move not checked');
  assert(checked1 === 'false', 'other move still checked');
});

// 6. mywords toggleFilter (필터 버튼은 learn/mywords 서브팬 안에 있음)
await check('mywords filter: toggling sets aria-pressed exclusively', async () => {
  await page.click('.tabbar button[data-to="learn"]');
  await page.click('#tab-learn-mywords');
  await page.waitForTimeout(100);
  const filters = await page.$$('.screen[data-s="learn"] .subpane[data-sub="mywords"] .filter');
  assert(filters.length >= 2, `expected >= 2 filters, got ${filters.length}`);
  await filters[1].click();
  const p0 = await filters[0].getAttribute('aria-pressed');
  const p1 = await filters[1].getAttribute('aria-pressed');
  assert(p1 === 'true', 'clicked filter not pressed');
  assert(p0 === 'false', 'other filter still pressed');
});

// 7. Practice subnav
await check('practice subnav: writing tab', async () => {
  await page.click('.tabbar button[data-to="practice"]');
  await page.click('#tab-practice-writing');
  const selected = await page.getAttribute('#tab-practice-writing', 'aria-selected');
  assert(selected === 'true');
});

// 8. No console errors throughout session
await check('no page errors during full session', async () => {
  assert(errors.length === 0, `errors: ${errors.join(' | ')}`);
});

const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;
console.log('=== UI Interactions E2E ===');
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.err ? ' — ' + r.err : ''}`);
}
console.log(`Summary: ${passed}/${results.length} passed, ${failed} failed`);

await browser.close();
server.close();
if (failed > 0) process.exit(1);
