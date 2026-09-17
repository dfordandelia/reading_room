// Fetches a story's page through a small, respectful fallback pipeline.
// Results are cached in memory so a second read is instant.
//
// Some publishers block scripted requests or hide everything behind a
// paywall. When that happens we say so and fall back to the feed summary
// rather than pretending we have the article.

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const cache = new Map();
const MAX_CACHE = 400;
const domainGates = new Map();
let browserPromise;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDomain(url) {
  const domain = new URL(url).hostname;
  const previous = domainGates.get(domain) || Promise.resolve();
  const current = previous.then(async () => {
    await sleep(2000 + Math.random() * 3000);
  });
  domainGates.set(domain, current.catch(() => {}));
  await previous;
}

function parseArticle(html, finalUrl) {
  const dom = new JSDOM(html, { url: finalUrl });
  const parsed = new Readability(dom.window.document).parse();
  const paragraphs = (parsed?.textContent || '')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 40);

  return parsed && paragraphs.length
    ? { ok: true, byline: parsed.byline || null, siteName: parsed.siteName || null, paragraphs, url: finalUrl }
    : { ok: false, reason: 'no-text', url: finalUrl };
}

async function resolveStandard(url, depth = 0) {
  await waitForDomain(url);
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Google News links are an interstitial around the publisher URL. Resolve
  // that wrapper before asking Readability to parse the article.
  if (/news\.google\.com/.test(res.url) && depth < 2) {
    const dom = new JSDOM(html, { url: res.url });
    const link = dom.window.document.querySelector('a[href^="http"]:not([href*="google."])');
    if (link) return resolveStandard(link.href, depth + 1);
  }

  return { ...parseArticle(html, res.url), tier: 'http' };
}

async function getBrowser() {
  if (process.env.PLAYWRIGHT_ENABLED === '0') return null;
  if (!browserPromise) {
    browserPromise = import('playwright')
      .then(({ firefox }) => firefox.launch({ headless: true }))
      .catch((err) => {
        browserPromise = null;
        console.warn(`  browser tier unavailable: ${err.message}`);
        return null;
      });
  }
  return browserPromise;
}

async function resolveRendered(url) {
  const browser = await getBrowser();
  if (!browser) throw new Error('browser tier unavailable');

  await waitForDomain(url);
  const page = await browser.newPage({ userAgent: UA });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const finalUrl = page.url();
    return { ...parseArticle(await page.content(), finalUrl), tier: 'browser' };
  } finally {
    await page.close();
  }
}

export async function extract(url) {
  if (cache.has(url)) return cache.get(url);

  let result = null;
  try {
    result = await resolveStandard(url);
    if (result.ok) return cacheResult(url, result);
  } catch (err) {
    console.warn(`  HTTP tier skipped: ${url} (${err.message})`);
  }

  try {
    result = await resolveRendered(url);
    if (result.ok) return cacheResult(url, result);
  } catch (err) {
    console.warn(`  browser tier skipped: ${url} (${err.message})`);
    result = { ok: false, reason: err.message, url };
  }

  return cacheResult(url, result || { ok: false, reason: 'no-text', url });
}

function cacheResult(url, result) {
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(url, result);
  return result;
}
