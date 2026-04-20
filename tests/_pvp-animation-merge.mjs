import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const srv = spawn('python3', ['-m', 'http.server', '8771'], { cwd: process.cwd(), stdio: 'ignore' });
await wait(400);

try {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:8771/baseball-pvp.html', { waitUntil: 'networkidle' });

  let sawBallText = false;
  let sawMega = false;
  let megaTexts = [];
  let ballSamples = [];

  // Observe ball text mutations on the page so we catch it during flight.
  await p.evaluate(() => {
    window.__ballSeen = [];
    const el = document.querySelector('#ball');
    const mo = new MutationObserver(() => {
      const t = (el.textContent || '').trim();
      if (t) window.__ballSeen.push(t);
    });
    mo.observe(el, { childList: true, characterData: true, subtree: true });
  });

  for (let i = 0; i < 20; i++) {
    try { await p.waitForSelector('.choice:not([disabled])', { timeout: 8000 }); } catch { break; }
    // Check ball text mid-flight (the window is short, sample right at prompt reveal the prompt text matches ball seed)
    const ballText = (await p.$eval('#ball', el => el.textContent)) || '';
    if (ballText.trim().length > 0) sawBallText = true;

    // Click first choice (often wrong for non-direct matches, which is fine)
    await p.click('.choice:nth-child(1)');

    // After click, mega-callout should flash briefly; poll for the show class
    for (let t = 0; t < 30; t++) {
      const cls = await p.$eval('#megaCallout', el => el.className);
      if (cls.includes('show')) {
        sawMega = true;
        const txt = (await p.$eval('#megaCallout', el => el.textContent)).trim();
        if (txt) megaTexts.push(txt);
        break;
      }
      await p.waitForTimeout(70);
    }
    await p.waitForTimeout(1200);
  }

  ballSamples = await p.evaluate(() => window.__ballSeen || []);
  sawBallText = ballSamples.length > 0;
  console.log('sawBallText:', sawBallText, 'samples:', [...new Set(ballSamples)].slice(0, 8));
  console.log('sawMega:', sawMega);
  console.log('megaTexts sample:', [...new Set(megaTexts)].slice(0, 10));
  await b.close();
} finally {
  srv.kill('SIGTERM');
}
