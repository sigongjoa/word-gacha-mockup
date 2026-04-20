import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const srv = spawn('python3', ['-m', 'http.server', '8774'], { cwd: process.cwd(), stdio: 'ignore' });
await wait(400);

try {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:8774/baseball-pvp.html', { waitUntil: 'networkidle' });
  await p.waitForSelector('.choice:not([disabled])', { timeout: 8000 });

  // Pick first option
  await p.click('.choice:nth-child(1)');
  // Review should appear within ~2s
  await p.waitForSelector('#review:not([hidden])', { timeout: 4000 });
  const review = await p.evaluate(() => ({
    badge: document.querySelector('#reviewBadge').textContent,
    result: document.querySelector('#reviewResult').textContent,
    prompt: document.querySelector('#reviewPrompt').textContent,
    answer: document.querySelector('#reviewAnswer').textContent,
    myPick: document.querySelector('#reviewYourPick').textContent,
    nextBtn: !!document.querySelector('#nextBtn'),
  }));
  console.log('review:', review);

  // Confirm no auto-pitch: after 3s no new .choice should appear (ball should not be flying)
  await p.waitForTimeout(3000);
  const ballFlying = await p.$eval('#ball', el => el.className.includes('flying'));
  const reviewStillShown = await p.$eval('#review', el => !el.hidden);
  console.log('after 3s wait → ballFlying:', ballFlying, '| reviewShown:', reviewStillShown);

  // Click next button → new pitch starts
  await p.click('#nextBtn');
  await p.waitForSelector('.choice:not([disabled])', { timeout: 4000 });
  const reviewAfterNext = await p.$eval('#review', el => el.hidden);
  console.log('after nextBtn → review.hidden:', reviewAfterNext);

  await b.close();
} finally {
  srv.kill('SIGTERM');
}
