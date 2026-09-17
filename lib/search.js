import { JSDOM } from 'jsdom';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function resultUrl(href) {
  try {
    const url = new URL(href, 'https://html.duckduckgo.com');
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : url.href;
  } catch {
    return null;
  }
}

function parseResults(html, lite = false) {
  const dom = new JSDOM(html);
  const items = lite
    ? [...dom.window.document.querySelectorAll('.result-link')].map((anchor) => ({
        anchor,
        container: anchor.closest('tr') || anchor.parentElement,
      }))
    : [...dom.window.document.querySelectorAll('.result')].map((container) => ({
        anchor: container.querySelector('.result__a'),
        container,
      }));

  return items
    .map(({ anchor, container }) => {
      const link = anchor && resultUrl(anchor.getAttribute('href'));
      if (!link || !/^https?:\/\//i.test(link)) return null;
      const snippet = lite
        ? container?.querySelector('.result-snippet')?.textContent
        : container?.querySelector('.result__snippet')?.textContent;
      return {
        id: `search-${Buffer.from(link).toString('base64url').slice(0, 24)}`,
        title: cleanText(anchor.textContent),
        link,
        source: new URL(link).hostname.replace(/^www\./, ''),
        summary: cleanText(snippet),
        published: new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

export async function searchWeb(query) {
  const trimmed = cleanText(query).slice(0, 160);
  if (!trimmed) return [];

  const encoded = encodeURIComponent(trimmed);
  const headers = { 'User-Agent': UA, Accept: 'text/html' };
  const liteResponse = await fetch(`https://lite.duckduckgo.com/lite/?q=${encoded}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (liteResponse.ok) {
    const results = parseResults(await liteResponse.text(), true);
    if (results.length) return results;
  }

  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
  return parseResults(await response.text());
}
