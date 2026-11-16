import { launch, hasFacebookLogin, firstPage } from './browser.js';
import { sleep } from './config.js';
import { extractPostTimes } from '../../shared/facebook.js';

/**
 * Opens each group (newest posts first), scrolls a bit, and returns the raw posts.
 * onResult(group, { title, posts } | { error }) may return 'stop' to end early.
 */
export async function scanGroups(groups, { scrolls, onStart, onResult }) {
  const browser = await launch({ headless: true });
  try {
    if (!(await hasFacebookLogin(browser))) {
      await onResult?.(groups[0], { error: 'LOGIN' });
      return;
    }
    const page = await firstPage(browser);
    // Read real post times from Facebook's own data as it loads (API responses while scrolling).
    await page.evaluateOnNewDocument(`(() => {
      const extractPostTimes = ${extractPostTimes.toString()};
      window.__mwFound = { times: {}, listings: {} };
      window.__mwExtract = extractPostTimes;
      const keep = (t) => { try { extractPostTimes(t, window.__mwFound); } catch {} };
      const open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (...a) {
        this.addEventListener('load', () => { try { if (typeof this.responseText === 'string') keep(this.responseText); } catch {} });
        return open.apply(this, a);
      };
      const f = window.fetch;
      window.fetch = async (...a) => {
        const r = await f(...a);
        try { r.clone().text().then(keep, () => {}); } catch {}
        return r;
      };
    })();`);
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      await onStart?.(g, i);
      let res;
      try {
        await page.goto(`${g.url}?sorting_setting=${g.sorting || 'CHRONOLOGICAL_LISTINGS'}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        const n = typeof scrolls === 'function' ? scrolls(g) : scrolls;
        res = await withTimeout(page.evaluate(pageScrape, { scrolls: n }), 60_000 + n * 10_000);
      } catch (e) {
        res = { error: e.message === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED', detail: e.message };
      }
      if ((await onResult?.(g, res)) === 'stop') break;
      if (i < groups.length - 1) await sleep(4000 + Math.random() * 6000); // be gentle
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms))]);
}

// Runs inside the Facebook page.
async function pageScrape({ scrolls }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SEE_MORE = /^(see more|δείτε περισσότερα|περισσότερα)$/i;

  let feed = null;
  for (let i = 0; i < 40; i++) {
    if (/^\/(login|checkpoint)/.test(location.pathname)) return { error: 'LOGIN' };
    feed = document.querySelector('[role="feed"]');
    if (feed && feed.children.length > 1) break;
    await sleep(500);
  }
  const title = document.title.replace(/^\(\d+\+?\)\s*/, '').replace(/\s*[|·]\s*Facebook\s*$/i, '').trim();
  if (!feed) {
    const login = document.querySelector('input[name="email"], form#login_form');
    return { error: login ? 'LOGIN' : 'NO_FEED', title };
  }

  const expand = () =>
    document.querySelectorAll('[role="feed"] [role="button"]').forEach((b) => {
      if (SEE_MORE.test((b.innerText || '').trim())) {
        try { b.click(); } catch {}
      }
    });

  // Facebook pads posts with junk ("Facebook" repeated, single scrambled letters). Keep real lines only.
  const JUNK = /^((Facebook\s*)+|Follow|Message again|Message|Comment as .*|Like|Comment|Share|Send|Reply|Write a comment.*|See more|See less|Δείτε περισσότερα|Λιγότερα)$/i;
  const HEADER = /^(sort group feed by|new listings|featured)\b/i; // feed headers, not posts
  const clean = (t) =>
    t.split('\n').map((l) => l.replace(/͏/g, '').replace(/…\s*See more$/i, '…').trim())
      .filter((l) => l.length > 2 && !JUNK.test(l)).join('\n');
  const POST_ID = /\/(?:posts|permalink)\/(\d+)|multi_permalinks=(\d+)|set=(?:pcb|gm)\.(\d+)|story_fbid=(\d+)|\/commerce\/listing\/(\d+)|\/marketplace\/item\/(\d+)/;

  // Facebook only fills in a post while it is on screen (and its link only on hover), and empties
  // posts far away again. So scroll down step by step and collect every post while it is visible.
  const seen = new Map(); // key -> post (longest version wins)
  const harvest = async () => {
    expand();
    const near = [...feed.children].filter((u) => {
      const r = u.getBoundingClientRect();
      return r.bottom > -innerHeight && r.top < innerHeight * 2;
    });
    for (const u of near)
      for (const a of u.querySelectorAll('a')) {
        const h = a.getAttribute('href');
        if (!h || h.startsWith('#')) {
          a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          try { a.focus({ preventScroll: true }); } catch {}
        }
      }
    await sleep(350);
    for (const u of near) {
      const text = clean(u.innerText || '');
      if (text.length < 20 || HEADER.test(text)) continue;
      const links = [...u.querySelectorAll('a[href]')].map((a) => a.href);
      const idLink = links.map((l) => (l.match(POST_ID) || []).slice(1).find(Boolean)).find(Boolean);
      const key = idLink ? `id:${idLink}` : `t:${text.slice(0, 80)}`;
      const post = {
        text: text.slice(0, 5000),
        alts: [...u.querySelectorAll('img[alt]')].map((i) => i.alt).filter((a) => a && a.length > 3).slice(0, 10),
        // Post photos (skip avatars/emoji: only big images from Facebook's photo servers).
        images: [...new Set([...u.querySelectorAll('img')]
          .filter((i) => /scontent|fbcdn/.test(i.src) && (i.naturalWidth >= 160 || i.width >= 160))
          .map((i) => i.src))].slice(0, 6),
        links: links.slice(0, 80),
        order: seen.get(key)?.order ?? seen.size,
      };
      const old = seen.get(key);
      if (!old || post.text.length > old.text.length || (post.text.length === old.text.length && post.images.length > old.images.length)) seen.set(key, post);
    }
  };

  const steps = scrolls * 4;
  let still = 0;
  for (let s = 0; s < steps && seen.size < 100; s++) {
    await harvest();
    const y = window.scrollY;
    const before = feed.children.length;
    window.scrollBy(0, Math.round(innerHeight * 0.8));
    for (let w = 0; w < 6 && feed.children.length === before && window.scrollY + innerHeight >= document.documentElement.scrollHeight - 50; w++) await sleep(400);
    await sleep(500 + Math.random() * 500);
    feed = document.querySelector('[role="feed"]') || feed;
    still = window.scrollY === y ? still + 1 : 0;
    if (still >= 3) break; // end of the feed
  }
  await harvest();

  const posts = [...seen.values()].sort((a, b) => a.order - b.order).map(({ order, ...p }) => p);
  // Real post times: first batch is in <script> tags, later batches were caught from API responses.
  const found = window.__mwFound || { times: {}, listings: {} };
  const extract = window.__mwExtract;
  for (const s of document.querySelectorAll('script')) {
    const t = s.textContent || '';
    if (t.includes('creation_time')) extract?.(t, found);
  }
  return { title, posts, found };
}
