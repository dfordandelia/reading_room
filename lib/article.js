// Fetches a story's page and pulls out the readable body, using the same
// extractor Firefox Reader View uses. Results are cached in memory so a
// second read is instant.
//
// Some publishers block scripted requests or hide everything behind a
// paywall. When that happens we say so and fall back to the feed summary
// rather than pretending we have the article.

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const cache = new Map();
const MAX_CACHE = 400;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

async function resolve(url) {
  // Google News links bounce through news.google.com; follow to the real page.
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url };
}

export async function extract(url) {
  if (cache.has(url)) return cache.get(url);

  let result;
  try {
    const { html, finalUrl } = await resolve(url);
    const dom = new JSDOM(html, { url: finalUrl });

    // Google News interstitial: find the outbound link and follow it once.
    if (/news\.google\.com/.test(finalUrl)) {
      const a = dom.window.document.querySelector('a[href^="http"]:not([href*="google."])');
      if (a) return extract(a.href);
    }

    const parsed = new Readability(dom.window.document).parse();
    const text = (parsed?.textContent || '')
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 40);

    result = text.length
      ? { ok: true, byline: parsed.byline || null, siteName: parsed.siteName || null, paragraphs: text, url: finalUrl }
      : { ok: false, reason: 'no-text', url: finalUrl };
  } catch (err) {
    result = { ok: false, reason: err.message, url };
  }

  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(url, result);
  return result;
}
