import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on('pageerror', e => errors.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type()==='error') errors.push('console.error: '+m.text()); });
await p.goto('http://localhost:8765/baseball-pvp.html');
await p.waitForTimeout(1200);
// wait for an AI pitch to arrive then answer
await p.waitForSelector('.choice', { timeout: 5000 });
const prompt = await p.textContent('#promptText');
const ptype = await p.textContent('#ptype');
console.log('first pitch prompt:', prompt, '|', ptype);
await p.click('.choice:first-child');
await p.waitForTimeout(1500);
const logCount = await p.$$eval('.log .row', rs => rs.length);
console.log('log rows:', logCount);
const inning = await p.textContent('#inningLabel');
console.log('inning label:', inning);
if (errors.length) { console.log('ERRORS:', errors); process.exit(1); }
console.log('OK');
await b.close();
