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

export async function searchWeb(query) {
  const trimmed = cleanText(query).slice(0, 160);
  if (!trimmed) return [];

  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
  const dom = new JSDOM(await response.text());
  return [...dom.window.document.querySelectorAll('.result')]
    .map((item) => {
      const anchor = item.querySelector('.result__a');
      const link = anchor && resultUrl(anchor.getAttribute('href'));
      if (!link || !/^https?:\/\//i.test(link)) return null;
      return {
        id: `search-${Buffer.from(link).toString('base64url').slice(0, 24)}`,
        title: cleanText(anchor.textContent),
        link,
        source: cleanText(item.querySelector('.result__url')?.textContent) || new URL(link).hostname,
        summary: cleanText(item.querySelector('.result__snippet')?.textContent),
        published: new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}
