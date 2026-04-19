// r1 — alive character: onboarding + add-word + vitals E2E
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

// --- Scenario 1: fresh storage → onboarding flow ---
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await check('onboard: dialog opens on fresh storage', async () => {
    const open = await page.evaluate(() => document.getElementById('dlg-onboard').open);
    assert(open, 'onboarding dialog not open');
  });

  await check('onboard step1: requires species selection', async () => {
    await page.click('#btn-onboard-next');
    const err = await page.textContent('#err-species');
    assert(err && err.includes('선택'), `expected species error, got "${err}"`);
  });

  await check('onboard step1: pick sprout → advances to step2', async () => {
    await page.click('.egg-pick[data-species="sprout"]');
    await page.click('#btn-onboard-next');
    const step = await page.getAttribute('#dlg-onboard', 'data-step');
    assert(step === '2', `expected step 2, got ${step}`);
  });

  await check('onboard step2: empty name blocks advance', async () => {
    await page.click('#btn-onboard-next');
    const err = await page.textContent('#err-name');
    assert(err && err.includes('이름'), `expected name error, got "${err}"`);
  });

  await check('onboard step2: type name → step3', async () => {
    await page.fill('#inp-name', '초싹이');
    await page.click('#btn-onboard-next');
    const step = await page.getAttribute('#dlg-onboard', 'data-step');
    assert(step === '3', `expected step 3, got ${step}`);
  });

  await check('onboard step3: pick personality + finish → creature saved', async () => {
    await page.click('.per-pick[data-personality="brave"]');
    await page.click('#btn-onboard-next');
    await page.waitForTimeout(200);
    const c = await page.evaluate(() => window.__wg.readCreature());
    assert(c && c.name === '초싹이', `creature not saved: ${JSON.stringify(c)}`);
    assert(c.speciesKey === 'sprout', `species=${c.speciesKey}`);
    assert(c.personality === 'brave', `personality=${c.personality}`);
    assert(c.stage === 1 && c.hunger === 100 && c.bond === 0, `initial vitals wrong`);
  });

  await check('onboard: body data-creature=ready after completion', async () => {
    const v = await page.getAttribute('body', 'data-creature');
    assert(v === 'ready', `data-creature=${v}`);
  });

  await check('vitals: HUD renders bond + hunger badges', async () => {
    const badges = await page.$$('#hud-vitals .vitals-badge');
    assert(badges.length >= 2, `expected 2 vitals badges, got ${badges.length}`);
  });

  await check('onboard: no page errors in flow', async () => {
    assert(errs.length === 0, `errors: ${errs.join(' | ')}`);
  });

  await ctx.close();
}

// --- Scenario 2: creature exists → add-word flow ---
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  // Pre-seed creature so we skip onboarding
  await page.addInitScript(() => {
    localStorage.setItem('wg.v1.creature', JSON.stringify({
      id: 'c-test', name: '테스트', speciesKey: 'sprout', personality: 'brave',
      stage: 1, hunger: 100, bond: 10, mood: 'happy',
      bornAt: '2026-04-19T10:00:00.000Z',
      lastInteractionAt: '2026-04-19T10:00:00.000Z',
      lastTickedAt: '2026-04-19T10:00:00.000Z',
    }));
  });

  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await check('addword: no onboarding when creature exists', async () => {
    const open = await page.evaluate(() => document.getElementById('dlg-onboard').open);
    assert(!open, 'onboarding dialog should not open');
  });

  await check('addword: navigate to mywords subpane → FAB visible', async () => {
    await page.click('.tabbar button[data-to="learn"]');
    await page.click('#tab-learn-mywords');
    await page.waitForTimeout(100);
    const fab = await page.$('#btn-add-word');
    assert(fab, 'FAB missing');
    const visible = await fab.isVisible();
    assert(visible, 'FAB not visible');
  });

  await check('addword: click FAB → dialog opens', async () => {
    await page.click('#btn-add-word');
    const open = await page.evaluate(() => document.getElementById('dlg-add-word').open);
    assert(open, 'add-word dialog not open');
  });

  await check('addword: submit valid word → list updates + bond +2', async () => {
    await page.fill('#aw-word', 'wonderful');
    await page.fill('#aw-meaning', '훌륭한');
    await page.selectOption('#aw-pos', 'adj');
    await page.click('#btn-add-submit');
    await page.waitForTimeout(200);
    const open = await page.evaluate(() => document.getElementById('dlg-add-word').open);
    assert(!open, 'dialog did not close');
    const html = await page.innerHTML('#word-list-dyn');
    assert(html.includes('wonderful'), `word not in list: ${html.slice(0,200)}`);
    const bond = await page.evaluate(() => window.__wg.readCreature().bond);
    assert(bond >= 12, `bond should be >=12 (was 10 + 2), got ${bond}`);
  });

  await check('addword: duplicate rejected with error', async () => {
    await page.click('#btn-add-word');
    await page.fill('#aw-word', 'wonderful');
    await page.fill('#aw-meaning', '중복');
    await page.selectOption('#aw-pos', 'adj');
    await page.click('#btn-add-submit');
    await page.waitForTimeout(100);
    const err = await page.textContent('#err-add-word');
    assert(err && err.includes('이미'), `expected duplicate error, got "${err}"`);
    await page.click('#btn-add-cancel');
  });

  await check('addword: invalid (non-letter) rejected', async () => {
    await page.click('#btn-add-word');
    await page.fill('#aw-word', '한글단어');
    await page.fill('#aw-meaning', '뜻');
    await page.selectOption('#aw-pos', 'noun');
    await page.click('#btn-add-submit');
    await page.waitForTimeout(100);
    const err = await page.textContent('#err-add-word');
    assert(err && err.length > 0, `expected error, got "${err}"`);
    await page.click('#btn-add-cancel');
  });

  await check('addword: no page errors', async () => {
    assert(errs.length === 0, `errors: ${errs.join(' | ')}`);
  });

  await ctx.close();
}

const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;
console.log('=== r1 Alive E2E ===');
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.err ? ' — ' + r.err : ''}`);
}
console.log(`Summary: ${passed}/${results.length} passed, ${failed} failed`);

await browser.close();
server.close();
if (failed > 0) process.exit(1);
