// Opens a browser window so you can log into Facebook. Closes by itself when done.
import fs from 'node:fs';
import { launch, hasFacebookLogin, firstPage } from './browser.js';
import { makeDb } from './db.js';
import { LOGIN_LOCK, sleep } from './config.js';

fs.writeFileSync(LOGIN_LOCK, String(process.pid));
const unlock = () => { try { fs.unlinkSync(LOGIN_LOCK); } catch {} };
process.on('exit', unlock);

console.log('\nA browser window is opening. Log into Facebook there.');
console.log('It closes by itself when you are logged in.\n');

let browser;
try {
  browser = await launch({ headless: false });
} catch (e) {
  console.log(`Could not open the browser: ${e.message}`);
  console.log('If the checker is scanning right now, wait a minute and try again.');
  process.exit(1);
}

let closed = false;
browser.on('disconnected', () => (closed = true));
const page = await firstPage(browser);
await page.goto('https://www.facebook.com/').catch(() => {});

let ok = false;
while (!closed) {
  const pages = await browser.pages().catch(() => []);
  if (!pages.length) break;
  const url = pages[0].url();
  if ((await hasFacebookLogin(browser).catch(() => false)) && !/checkpoint|two_step|two_factor/i.test(url)) {
    ok = true;
    break;
  }
  await sleep(1500);
}

if (ok) {
  console.log('Connected to Facebook ✓');
  await sleep(2000);
  try {
    const db = makeDb();
    const { data } = await db.from('settings').select('checker_status').eq('id', 1).single();
    await db.from('settings').update({
      checker_status: { ...(data?.checker_status || {}), fbConnected: true, lastError: null },
      check_requested_at: new Date().toISOString(), // run a check right away
    }).eq('id', 1);
  } catch {}
} else {
  console.log('Window closed before logging in. Run this again any time.');
}
await browser.close().catch(() => {});
process.exit(0);
