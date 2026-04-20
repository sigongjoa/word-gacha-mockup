import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const srv = spawn('python3', ['-m', 'http.server', '8772'], { cwd: process.cwd(), stdio: 'ignore' });
await wait(400);

try {
  const b = await chromium.launch();

  // Pass 1: batter — verify timer bar appears and choice is clickable during flight
  {
    const p = await b.newPage();
    await p.goto('http://localhost:8772/baseball-pvp.html', { waitUntil: 'networkidle' });
    await p.waitForSelector('.choice:not([disabled])', { timeout: 8000 });
    // Check timer bar is on
    const timerOn = await p.$eval('#timerBar', el => el.classList.contains('on'));
    // Check ball is visible (still flying)
    const ballDisplay = await p.$eval('#ball', el => getComputedStyle(el).display);
    console.log('[batter] timerBar.on:', timerOn, '| ball.display:', ballDisplay);
    // Click mid-flight
    const t0 = Date.now();
    await p.click('.choice:nth-child(1)');
    console.log('[batter] clicked at', Date.now() - t0, 'ms after panel ready');
    await p.waitForTimeout(2400);
    await p.close();
  }

  // Pass 2: pitcher — verify pitcher-info panel shows answer
  {
    const p = await b.newPage();
    await p.goto('http://localhost:8772/baseball-pvp.html', { waitUntil: 'networkidle' });
    await p.click('[data-role="pitcher"]');
    await p.click('#newGameBtn');
    await p.waitForSelector('.pcard:not([disabled])', { timeout: 8000 });
    // Throw a fastball
    await p.click('.pcard.fastball');
    // Wait for PITCH_INFO to arrive
    await p.waitForFunction(() => !document.querySelector('#pitcherInfo').hidden, { timeout: 4000 });
    const info = await p.evaluate(() => ({
      tag: document.querySelector('#piTag').textContent,
      prompt: document.querySelector('#piPrompt').textContent,
      answer: document.querySelector('#piAnswer').textContent,
      status: document.querySelector('#piStatus').textContent,
    }));
    console.log('[pitcher] info:', info);
    // Wait for AI to answer and status to update
    await p.waitForTimeout(3200);
    const finalStatus = await p.$eval('#piStatus', el => el.textContent);
    console.log('[pitcher] status after AI answer:', finalStatus);
    await p.close();
  }

  // Pass 3: measure ball flight duration
  {
    const p = await b.newPage();
    await p.goto('http://localhost:8772/baseball-pvp.html', { waitUntil: 'networkidle' });
    await p.waitForSelector('#ball', { timeout: 8000 });
    // Record when ball becomes visible, and when it disappears
    const stats = await p.evaluate(() => new Promise(resolve => {
      const el = document.querySelector('#ball');
      let startAt = 0;
      const mo = new MutationObserver(() => {
        const isFlying = el.className.includes('flying');
        const now = performance.now();
        if (isFlying && !startAt) startAt = now;
        else if (!isFlying && startAt) {
          mo.disconnect();
          resolve({ durationMs: Math.round(now - startAt) });
        }
      });
      mo.observe(el, { attributes: true, attributeFilter: ['class'] });
      setTimeout(() => { mo.disconnect(); resolve({ durationMs: -1 }); }, 6000);
    }));
    console.log('[timing] ball flight duration ms:', stats.durationMs);
    await p.close();
  }

  await b.close();
} finally {
  srv.kill('SIGTERM');
}
