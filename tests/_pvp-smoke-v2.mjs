import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on('pageerror', e => errors.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type()==='error') errors.push('console.error: '+m.text()); });
await p.goto('http://localhost:8765/baseball-pvp.html');
await p.waitForTimeout(1000);
// Ball should be invisible initially, but pitch:thrown should make it fly.
await p.waitForSelector('.choice', { timeout: 6000 }); // choices appear only after ball animation completes
const ptype = await p.textContent('#ptype');
console.log('first pitch:', ptype);
// Check ball element exists
const ballExists = await p.$eval('#ball', el => !!el);
console.log('ball present:', ballExists);
// Check confetti canvas
const cvExists = await p.$eval('#confetti', el => !!el);
console.log('confetti canvas present:', cvExists);
// Click correct vs wrong? click first choice
await p.click('.choice:nth-child(1)');
await p.waitForTimeout(2500); // allow play:result animation + next pitch flight
const logCount = await p.$$eval('.log .row', rs => rs.length);
console.log('log rows after one full turn:', logCount);
// switch to pitcher role
await p.click('[data-role="pitcher"]');
await p.waitForTimeout(500);
await p.click('.pcard:nth-child(1)');
await p.waitForTimeout(2500);
const logCount2 = await p.$$eval('.log .row', rs => rs.length);
console.log('log rows after pitcher turn:', logCount2);
if (errors.length) { console.log('ERRORS:', errors); process.exit(1); }
console.log('OK');
await b.close();
