// Playwright-driven browser smoke test — opens browser-smoke.html and reads results.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer((req, res) => {
  try {
    const path = join(ROOT, req.url.split('?')[0]);
    const body = readFileSync(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('404');
  }
});

const port = await new Promise((r) => server.listen(0, () => r(server.address().port)));
const url = `http://127.0.0.1:${port}/browser-smoke.html`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

await page.goto(url);
await page.waitForFunction(() => window.__smokeResults !== undefined, { timeout: 5000 });
const r = await page.evaluate(() => window.__smokeResults);
const title = await page.title();

console.log(`\n=== Browser Smoke (${url}) ===`);
console.log(`Title: ${title}`);
for (const t of r.results) {
  console.log(`  ${t.ok ? '✓' : '✗'} ${t.name}${t.err ? ' — ' + t.err : ''}`);
}
console.log(`Summary: ${r.passed}/${r.results.length} passed, ${r.failed} failed`);
if (errors.length) {
  console.log(`\nPage errors:`);
  errors.forEach(e => console.log('  ' + e));
}

await browser.close();
server.close();

if (r.failed > 0 || errors.length > 0) process.exit(1);
