import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { TOPICS, TOPIC_BY_KEY } from './lib/topics.js';
import { refresh, ensureTopic, ensureAll, topicStories, story, frontPage, builtAt } from './lib/news.js';
import { extract } from './lib/article.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Simple password lock. Set APP_USER and APP_PASS (Fly secrets, below) to turn
// it on; leave them unset and the app runs open, which is fine for localhost
// but not for anything with a public URL.
const AUTH_USER = process.env.APP_USER;
const AUTH_PASS = process.env.APP_PASS;

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

if (AUTH_USER && AUTH_PASS) {
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
      if (user && pass && timingSafeEqual(user, AUTH_USER) && timingSafeEqual(pass, AUTH_PASS)) {
        return next();
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="Reading room"');
    res.status(401).send('Password required.');
  });
} else {
  console.warn('APP_USER / APP_PASS not set — running with no password. Fine for localhost, not for a public URL.');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Nothing refreshes on a timer. The reader decides, and every request carries
// a version stamp `v` that changes only when Refresh is pressed.
//
// Because `v` sits in the URL, a new stamp is an address the CDN has never
// seen: the request reaches the server and re-pulls the feeds. An unchanged
// stamp is served straight from the edge. That keeps a refresh sticky — the
// next visit sees the refreshed copy rather than falling back to an older one.
const seenVersion = {};

// True the first time this instance sees a given stamp for a given scope.
// Has a side effect, so call it exactly once per request.
function isNewVersion(scope, v) {
  if (!v || seenVersion[scope] === v) return false;
  seenVersion[scope] = v;
  return true;
}

function cacheFor(req, res) {
  // A stamped URL is safe to keep for a long time: the stamp changes when the
  // content should. An unstamped one gets a short window instead.
  res.set('Cache-Control', req.query.v
    ? 'public, s-maxage=604800, stale-while-revalidate=604800'
    : 'public, s-maxage=300, stale-while-revalidate=3600');
}

app.get('/api/topics', (req, res) => {
  cacheFor(req, res);
  res.json({
    topics: TOPICS.map(({ key, name, colour }) => ({ key, name, colour })),
    builtAt: builtAt(),
  });
});

app.get('/api/front', wrap(async (req, res) => {
  const complete = await ensureAll(isNewVersion('front', req.query.v), 8000);
  cacheFor(req, res);
  res.json({ stories: frontPage(Number(req.query.limit) || 14), builtAt: builtAt(), complete });
}));

app.get('/api/topic/:key', wrap(async (req, res) => {
  const { key } = req.params;
  if (!TOPIC_BY_KEY[key]) return res.status(404).json({ error: 'unknown topic' });
  await ensureTopic(key, isNewVersion(key, req.query.v));   // only this subject's feeds
  cacheFor(req, res);
  res.json({ stories: topicStories(key), builtAt: builtAt() });
}));

// Full text, pulled live and cached in memory by lib/article.js.
//
// Normally the story is still in the current window and we look it up by id.
// If a refresh rotated it out while it was open on screen, the client sends
// the link it already has, so an open article never dies mid-read.
app.get('/api/article/:id', wrap(async (req, res) => {
  const meta = story(req.params.id);
  const link = meta?.link || (typeof req.query.link === 'string' ? req.query.link : null);

  if (!link || !/^https?:\/\//i.test(link)) {
    return res.status(404).json({ error: 'story not in the current window' });
  }

  const result = await extract(link);

  // Published text doesn't change; cache a success hard, never cache a failure.
  res.set('Cache-Control', result.ok
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'no-store');

  res.json({
    ...(meta || {}),
    ok: result.ok,
    tier: result.tier || null,
    reason: result.reason || null,
    byline: result.byline || null,
    paragraphs: result.ok ? result.paragraphs : [],
    finalUrl: result.url,
  });
}));

app.get('/healthz', (req, res) => res.send('ok'));

// Only listen when run directly (`npm start`). When a serverless host imports
// this file it just takes the app and handles the socket itself.
const runDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (runDirectly) {
  app.listen(PORT, () => {
    console.log(`Reading room on http://localhost:${PORT}`);
    refresh().catch((e) => console.error('First refresh failed:', e.message));
  });
}

export default app;
