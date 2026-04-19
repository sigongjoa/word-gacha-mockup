// r2 — dex detail + playroom E2E
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

function seededInit() {
  localStorage.setItem('wg.v1.creature', JSON.stringify({
    id: 'c-r2', name: '테스트', speciesKey: 'sprout', personality: 'brave',
    stage: 1, hunger: 50, bond: 10, mood: 'neutral',
    bornAt: '2026-04-19T10:00:00.000Z',
    lastInteractionAt: '2026-04-19T10:00:00.000Z',
    lastTickedAt: '2026-04-19T10:00:00.000Z',
  }));
  // Set one seeded word to box 5 to test unlocked state
  const now = new Date().toISOString();
  const words = [
    { id: 'w001', word: 'identity',   meaning: '정체성',  pos: 'noun', example: '',  box: 5, wrongCount: 0, addedAt: now },
    { id: 'w002', word: 'friendship', meaning: '우정',    pos: 'noun', example: '',  box: 3, wrongCount: 0, addedAt: now },
    { id: 'w003', word: 'nature',     meaning: '자연',    pos: 'noun', example: '',  box: 1, wrongCount: 0, addedAt: now },
    { id: 'w005', word: 'explore',    meaning: '탐험하다', pos: 'verb', example: '', box: 5, wrongCount: 0, addedAt: now },
  ];
  localStorage.setItem('wg.v1.words', JSON.stringify(words));
  localStorage.setItem('wg.v1.seen', JSON.stringify(['w002']));
  localStorage.setItem('wg.v1.quizHistory', JSON.stringify([
    { wordId: 'w001', correct: true,  ts: now },
    { wordId: 'w001', correct: true,  ts: now },
    { wordId: 'w001', correct: false, ts: now },
  ]));
  localStorage.setItem('wg.v1.profile', JSON.stringify({ lv: 1, exp: 0, coin: 0, streak: 0, lastActiveDate: null }));
  localStorage.setItem('wg.v1.badges', JSON.stringify([]));
  localStorage.setItem('wg.v1.schemaVersion', '1');
  localStorage.setItem('wg.v1.lastVisitDate', '2026-04-19');
}

// --- Dex drilldown scenario ---
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await ctx.addInitScript(seededInit);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await check('dex: click noun type-case → type view shows', async () => {
    await page.click('.tabbar button[data-to="dex"]');
    await page.waitForTimeout(100);
    await page.click('.type-case[data-t="noun"]');
    const hidden = await page.getAttribute('#dex-type-view', 'hidden');
    assert(hidden === null, 'type view should not be hidden');
    const title = await page.textContent('#dex-type-title');
    assert(title === '명사', `expected 명사 got ${title}`);
  });

  await check('dex: grid shows 3 noun cards with correct states', async () => {
    const cards = await page.$$('#dex-cards-grid .dex-card');
    assert(cards.length === 3, `expected 3 cards, got ${cards.length}`);
    const w001 = await page.getAttribute('.dex-card[data-wid="w001"]', 'data-state');
    const w002 = await page.getAttribute('.dex-card[data-wid="w002"]', 'data-state');
    const w003 = await page.getAttribute('.dex-card[data-wid="w003"]', 'data-state');
    assert(w001 === 'unlocked', `w001 state ${w001}`);
    assert(w002 === 'seen',     `w002 state ${w002}`);
    assert(w003 === 'locked',   `w003 state ${w003}`);
  });

  await check('dex: locked card → toast, no modal', async () => {
    await page.click('.dex-card[data-wid="w003"]');
    await page.waitForTimeout(100);
    const dlgOpen = await page.evaluate(() => document.getElementById('dlg-card-detail').open);
    assert(!dlgOpen, 'detail modal should not open for locked card');
  });

  await check('dex: unlocked card → detail modal with stats', async () => {
    await page.click('.dex-card[data-wid="w001"]');
    await page.waitForTimeout(100);
    const open = await page.evaluate(() => document.getElementById('dlg-card-detail').open);
    assert(open, 'detail modal not open');
    const word = await page.textContent('#cd-word');
    assert(word === 'identity', `word=${word}`);
    const correct = await page.textContent('#cd-correct');
    const wrong = await page.textContent('#cd-wrong');
    const acc = await page.textContent('#cd-acc');
    assert(correct === '2', `correct=${correct}`);
    assert(wrong === '1', `wrong=${wrong}`);
    assert(acc === '67', `acc=${acc}`);
  });

  await check('dex: card memory shows "오늘 처음 만났어요"', async () => {
    const mem = await page.textContent('#cd-memory');
    assert(mem.includes('오늘'), `memory=${mem}`);
  });

  await check('dex: back button returns to type tiles', async () => {
    await page.click('#btn-cd-close');
    await page.click('#btn-dex-back');
    const typesHidden = await page.getAttribute('#dex-grid-types', 'hidden');
    assert(typesHidden === null, 'types grid should be visible again');
  });

  await check('dex: no page errors', async () => {
    assert(errs.length === 0, `errors: ${errs.join(' | ')}`);
  });

  await ctx.close();
}

// --- Playroom scenario ---
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await ctx.addInitScript(seededInit);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await check('playroom: home tile visible & clickable', async () => {
    const tile = await page.$('.item.playroom-entry');
    assert(tile, 'playroom entry tile missing');
    assert(await tile.isVisible(), 'tile not visible');
  });

  await check('playroom: tile → navigates to playroom screen', async () => {
    await page.click('.item.playroom-entry');
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => document.body.dataset.screen);
    assert(s === 'playroom', `screen=${s}`);
    const bub = await page.textContent('#mascot-speech');
    assert(bub && bub.length > 0, `speech empty: ${bub}`);
  });

  await check('playroom: vitals badges render in stage', async () => {
    const badges = await page.$$('#pr-vitals .vitals-badge');
    assert(badges.length === 2, `expected 2 badges, got ${badges.length}`);
  });

  await check('playroom: pet button → bond +3', async () => {
    const before = await page.evaluate(() => window.__wg.readCreature().bond);
    await page.click('#btn-play-pet');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__wg.readCreature().bond);
    assert(after === before + 3, `bond ${before} → ${after}`);
  });

  await check('playroom: pet immediately again → disabled (cooldown)', async () => {
    const btn = await page.$('#btn-play-pet');
    const disabled = await btn.isDisabled();
    assert(disabled, 'pet should be disabled during cooldown');
  });

  await check('playroom: feed → hunger +30', async () => {
    const before = await page.evaluate(() => window.__wg.readCreature().hunger);
    await page.click('#btn-play-feed');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__wg.readCreature().hunger);
    assert(after === Math.min(100, before + 30), `hunger ${before} → ${after}`);
  });

  await check('playroom: feed when full (>=80) → disabled', async () => {
    // hunger is now 80, feed should be disabled
    const btn = await page.$('#btn-play-feed');
    const disabled = await btn.isDisabled();
    assert(disabled, 'feed should be disabled when not hungry');
  });

  await check('playroom: mascot tap → bond +0.5', async () => {
    const before = await page.evaluate(() => window.__wg.readCreature().bond);
    await page.click('#btn-mascot-tap');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__wg.readCreature().bond);
    assert(after > before, `bond should increase; ${before} → ${after}`);
  });

  await check('playroom: back to home via ← button', async () => {
    await page.click('.screen[data-s="playroom"] .btn-back-pr');
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => document.body.dataset.screen);
    assert(s === 'home', `screen=${s}`);
  });

  await check('playroom: no page errors', async () => {
    assert(errs.length === 0, `errors: ${errs.join(' | ')}`);
  });

  await ctx.close();
}

const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;
console.log('=== r2 Dex + Playroom E2E ===');
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.err ? ' — ' + r.err : ''}`);
}
console.log(`Summary: ${passed}/${results.length} passed, ${failed} failed`);

await browser.close();
server.close();
if (failed > 0) process.exit(1);
