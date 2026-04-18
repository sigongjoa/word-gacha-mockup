// Load the actual live index.html to verify no console errors / uncaught exceptions.
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [], warnings = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  if (msg.type() === 'warning') warnings.push(msg.text());
});

await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForLoadState('networkidle');

const info = await page.evaluate(() => ({
  title: document.title,
  screen: document.body.dataset.screen,
  hasMascot: !!document.querySelector('[class*="mascot"], svg use[href="#mascot"]'),
  screens: [...document.querySelectorAll('[data-screen-content], .screen, section')].length,
  nav: !!document.querySelector('nav, [role="tablist"], .tabs'),
}));

console.log('=== index.html load ===');
console.log('Title:', info.title);
console.log('Initial screen:', info.screen);
console.log('Section count:', info.screens);
console.log('Has mascot:', info.hasMascot);
console.log('Has nav:', info.nav);
console.log('Errors:', errors.length, errors);
console.log('Warnings:', warnings.length);

await browser.close();
server.close();
if (errors.length) process.exit(1);
