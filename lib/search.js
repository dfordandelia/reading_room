function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export async function searchWeb(query) {
  const trimmed = cleanText(query).slice(0, 160);
  if (!trimmed) return [];
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !searchEngineId) {
    throw new Error('Google search is not configured. Set GOOGLE_API_KEY and GOOGLE_CSE_ID.');
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', searchEngineId);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('num', '10');
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `Google search HTTP ${response.status}`);

  return (payload.items || []).map((item) => ({
    id: `search-${Buffer.from(item.link).toString('base64url').slice(0, 24)}`,
    title: cleanText(item.title),
    link: item.link,
    source: cleanText(item.displayLink) || new URL(item.link).hostname,
    summary: cleanText(item.snippet),
    published: new Date().toISOString(),
  }));
}
