// Pulls every topic's feeds, groups items that are clearly the same story,
// and scores each story by how much noise it is making.
//
// The ranking has two ingredients:
//   1. how many distinct outlets are running the story  (the "talked about" part)
//   2. how recent it is                                  (an exponential decay)
// Nothing here calls out to an AI service. It is arithmetic over RSS.

import Parser from 'rss-parser';
import crypto from 'node:crypto';
import { TOPICS, TOPIC_BY_KEY } from './topics.js';

const parser = new Parser({
  timeout: 12000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; personal-news-reader/1.0)' },
});

const MAX_AGE_HOURS = 96;            // stories older than this are dropped
const HALF_LIFE_HOURS = 20;          // recency decay

const STOP = new Set(
  ('the a an and or of in on at to for with from by as is are was were be been will '
   + 'says say said new after over into its his her their this that than but not you '
   + 'your how why what when who which more most up down out about against amid can '
   + 'could may might would should has have had it they them we us our').split(' ')
);

// Each subject caches independently, so opening one subject only pulls that
// subject's three or four feeds instead of all forty. That matters on
// serverless hosts, where every cold start begins with an empty cache.
let topicCache = {};   // key -> { builtAt, stories }
let idIndex = {};      // story id -> story

/* ---------- helpers ---------- */

const id = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

function tokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

function sourceOf(item, feedTitle) {
  // Google News puts the outlet in the title after a trailing dash.
  const m = item.title && item.title.match(/\s-\s([^-]{2,40})$/);
  if (m) return m[1].trim();
  if (item.creator) return item.creator;
  try {
    return new URL(item.link).hostname.replace(/^www\./, '');
  } catch {
    return feedTitle || 'Unknown';
  }
}

function cleanTitle(t) {
  return (t || '').replace(/\s-\s[^-]{2,40}$/, '').trim();
}

function stripHtml(s) {
  return (s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- fetching ---------- */

async function pullFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).map((it) => ({
      title: cleanTitle(it.title),
      link: it.link,
      source: sourceOf(it, feed.title),
      published: it.isoDate || it.pubDate || null,
      summary: stripHtml(it.contentSnippet || it.content || it.summary || '').slice(0, 420),
    }));
  } catch (err) {
    console.warn(`  feed skipped: ${url} (${err.message})`);
    return [];
  }
}

/* ---------- clustering and scoring ---------- */

export function buildTopic(topic, rawItems) {
  const now = Date.now();
  const items = rawItems
    .filter((i) => i.title && i.link)
    .map((i) => ({ ...i, ts: i.published ? Date.parse(i.published) : now }))
    .filter((i) => Number.isFinite(i.ts) && (now - i.ts) / 3.6e6 < MAX_AGE_HOURS);

  // drop exact duplicate links
  const seen = new Set();
  const unique = items.filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true)));

  // greedy clustering on title similarity
  const clusters = [];
  for (const item of unique.sort((a, b) => b.ts - a.ts)) {
    const tk = tokens(item.title);
    const hit = clusters.find((c) => jaccard(c.tokens, tk) > 0.32);
    if (hit) {
      hit.members.push(item);
      for (const w of tk) hit.tokens.add(w);
    } else {
      clusters.push({ tokens: tk, members: [item] });
    }
  }

  const stories = clusters.map((c) => {
    // the member with the longest summary usually reads best as the lead
    const lead = c.members.slice().sort((a, b) => (b.summary || '').length - (a.summary || '').length)[0];
    const outlets = [...new Set(c.members.map((m) => m.source))];
    const newest = Math.max(...c.members.map((m) => m.ts));
    const ageHours = (now - newest) / 3.6e6;
    const recency = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);

    const buzz = outlets.length * 3 + recency * 4 + Math.min(c.members.length, 6) * 0.5;

    return {
      id: id(lead.link),
      topic: topic.key,
      title: lead.title,
      link: lead.link,
      source: outlets[0],
      outlets,
      published: new Date(newest).toISOString(),
      summary: lead.summary,
      buzz: Math.round(buzz * 100) / 100,
      alsoAt: c.members
        .filter((m) => m.link !== lead.link)
        .slice(0, 5)
        .map((m) => ({ source: m.source, link: m.link, title: m.title })),
    };
  });

  return stories.sort((a, b) => b.buzz - a.buzz).slice(0, 10);
}

/* ---------- public surface ---------- */

// Concurrent requests for the same subject share one pull rather than each
// hitting the feeds, which matters when a refresh arrives from two tabs at once.
const inFlight = {};

function startPull(topic) {
  if (inFlight[topic.key]) return inFlight[topic.key];
  const p = pullTopic(topic).finally(() => { delete inFlight[topic.key]; });
  inFlight[topic.key] = p;
  return p;
}

async function pullTopic(topic) {
  const batches = await Promise.all(topic.feeds.map(pullFeed));
  const stories = buildTopic(topic, batches.flat());
  topicCache[topic.key] = { builtAt: Date.now(), stories };
  for (const s of stories) idIndex[s.id] = s;
  return stories;
}

// Pull one subject. Nothing expires on a timer: a cached subject is reused
// for as long as the process lives, and only a deliberate refresh re-pulls it.
export async function ensureTopic(key, force = false) {
  const topic = TOPIC_BY_KEY[key];
  if (!topic) return [];
  if (inFlight[key]) return inFlight[key];   // join a pull already running
  const held = topicCache[key];
  if (!force && held) return held.stories;
  return startPull(topic);
}

// Pull every subject. Needed for the front page, which ranks across all of them.
export async function ensureAll(force = false, maxWaitMs = 0) {
  const all = Promise.all(TOPICS.map((t) => ensureTopic(t.key, force)));
  if (!maxWaitMs) {
    await all;
    return true;
  }

  return Promise.race([
    all.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), maxWaitMs)),
  ]);
}

export async function refresh() {
  console.log('Refreshing feeds…');
  await ensureAll(true);
  const total = Object.values(topicCache).reduce((n, c) => n + c.stories.length, 0);
  console.log(`Ready: ${total} stories across ${TOPICS.length} subjects.`);
}

export function topicStories(key) {
  return topicCache[key]?.stories || [];
}

export function story(storyId) {
  return idIndex[storyId] || null;
}

// The front page: best stories overall, but never more than two from any one
// subject, so a busy news day in one area can't swallow the whole page.
export function frontPage(limit = 14) {
  const all = Object.values(topicCache)
    .flatMap((c) => c.stories)
    .sort((a, b) => b.buzz - a.buzz);
  const count = {};
  const out = [];
  const selectedTokens = [];
  for (const s of all) {
    count[s.topic] = (count[s.topic] || 0) + 1;
    if (count[s.topic] > 2) continue;

    const storyTokens = tokens(s.title);
    if (selectedTokens.some((existing) => jaccard(existing, storyTokens) > 0.5)) continue;

    selectedTokens.push(storyTokens);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

// The oldest subject in the cache, so the date stamp never overstates freshness.
export function builtAt() {
  const times = Object.values(topicCache).map((c) => c.builtAt);
  return times.length ? Math.min(...times) : 0;
}
