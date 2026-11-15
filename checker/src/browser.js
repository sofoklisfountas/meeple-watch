import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { PROFILE_DIR } from './config.js';

// Your installed Firefox, with a separate profile just for the checker (your normal Firefox is untouched).
const CANDIDATES = [
  process.env.FIREFOX_PATH,
  'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
  'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
  `${process.env.LOCALAPPDATA}\\Mozilla Firefox\\firefox.exe`,
].filter(Boolean);

function firefoxPath() {
  const p = CANDIDATES.find((c) => fs.existsSync(c));
  if (!p) throw new Error('Firefox not found. Install Firefox, or set FIREFOX_PATH in checker/.env');
  return p;
}

export async function launch({ headless }) {
  try {
    return await puppeteer.launch({
      browser: 'firefox',
      executablePath: firefoxPath(),
      headless,
      userDataDir: PROFILE_DIR,
      defaultViewport: { width: 1280, height: 1000 },
      extraPrefsFirefox: { 'dom.webdriver.enabled': false },
    });
  } catch (e) {
    if (/already running|lock|in use/i.test(e.message)) {
      throw new Error('Browser profile is busy (is the Facebook login window open?)');
    }
    throw new Error(`Could not start Firefox: ${e.message}`);
  }
}

export async function firstPage(browser) {
  const page = (await browser.pages())[0] || (await browser.newPage());
  // Look like a normal browser (automation sets navigator.webdriver = true).
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  });
  return page;
}

export async function hasFacebookLogin(browser) {
  const cookies = await browser.cookies();
  return cookies.some((c) => c.name === 'c_user' && /facebook\.com$/.test(c.domain.replace(/^\./, '')));
}
