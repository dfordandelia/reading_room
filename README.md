# Reading room

A personalised news aggregator for eleven fixed subjects. It pulls RSS feeds,
works out which stories the most outlets are running, and extracts the real
article text so you can read it in place.

No AI service, no API keys, no accounts, nothing written to disk. Node and four
npm packages.

## Run it

```bash
npm install
npm start
```

Open http://localhost:3000.

The first pull takes ten to twenty seconds. After that nothing changes on its
own: headlines stay put until you press **Refresh** in the sidebar, which
re-pulls the feeds and updates the "Pulled …" stamp beneath the signature.

## How it decides what's "most talked about"

For each subject it pulls every feed, then groups items whose headlines overlap
enough to be the same story (Jaccard similarity over meaningful words, above
0.32). A story's score is:

```
outlets × 3  +  recency × 4  +  min(articles, 6) × 0.5
```

where recency halves every twenty hours. So three outlets covering something two
hours ago beats one outlet covering something yesterday. The front page takes the
best stories overall but caps each subject at two, so a busy day in one area
can't swallow the page. Clicking a subject in the sidebar gives you that
subject's top ten, busiest first.

## Reading

Tapping a headline fetches the page with a browser-like User-Agent and runs it
through Readability, the same extractor behind Firefox Reader View. If the
normal HTTP request fails or returns no article text, an optional Playwright
Firefox browser renders the page before Readability tries again. A back arrow
at the top of the article returns you to the list you came from; Escape does the
same.

Publishers that block both requests or sit behind a paywall will still fail;
you get the feed summary and a link to the source instead. This app does not
attempt to bypass anti-bot challenges, retain challenge cookies, or circumvent
paywalls. The browser tier is disabled with `PLAYWRIGHT_ENABLED=0`.

The container image installs Firefox for Playwright automatically. For local
use, run `npx playwright install firefox` once after `npm install`; deployments
that cannot ship a browser continue using the HTTP tier.

On Vercel, the article reader uses a bundled serverless Chromium runtime, so
you do not need to install a browser manually. Redeploy after pulling changes
that update the article fallback dependencies.

The sidebar's **Search the web** field uses Google's Programmable Search JSON
API. Set `GOOGLE_API_KEY` and `GOOGLE_CSE_ID` in the environment before
starting the app. Search results can be opened in the same in-app reader, or
opened directly at the source when a publisher blocks automated reading.

Create a Programmable Search Engine at `programmablesearchengine.google.com`,
enable the Custom Search JSON API in Google Cloud, and use its API key plus
the engine's ID as those two environment variables.

## Changing the subjects and sources

Everything lives in `lib/topics.js`. Each subject is a key, a display name, a hex
colour, and a list of feed URLs. A feed that 404s or times out is skipped with a
warning, so you can paste in anything and see what sticks. The colour you set is
what tints that subject's heading, sidebar entry and article kicker.

For niche subjects with no dedicated publication, `gnews('your query')` builds a
Google News search feed. It returns many outlets at once, which is exactly what
the ranking wants. Google News supports `when:3d` for a time window and quoted
phrases.

## Installing it as an app

The app ships a web manifest, icons and a service worker, so both laptop and
phone can install it to the dock or home screen and run it without browser
chrome. It also keeps an offline copy: the shell is cached, and the last set of
headlines you loaded is shown if the network is gone.

To change the name that appears under the icon, edit `name` and `short_name` in
`public/manifest.webmanifest` and `apple-mobile-web-app-title` in
`public/index.html`. The icons in `public/icons/` are plain black rules — swap
the PNGs for anything you prefer, keeping the same filenames and sizes.

## Hosting on Vercel

The app runs as a single serverless function (`api/index.js` re-exports the
Express app) with `public/` served from the CDN. Two details make this work:

- **Nothing persists between requests.** Each subject is pulled lazily, so
  opening one subject fetches its three or four feeds, not all thirty-eight.
- **The CDN does the caching the long-lived process used to do.** Every request
  carries a version stamp `v`, kept in `localStorage` and changed only by the
  Refresh button. A stamped response is cached at the edge for a week, so
  ordinary visits never re-run the function; a new stamp is an address the CDN
  has never seen, so it reaches the server and re-pulls. Keeping the stamp on
  disk is what makes a refresh stick — without it the next visit would fall
  back to the older cached copy. Article text is fetched without a stamp and
  cached for a day, since published text doesn't change.

```bash
npm i -g vercel
vercel
vercel --prod
```

Hobby functions allow 300s and 2 GB, well past what this needs; `vercel.json`
caps it at 60s so a hung feed can't run up usage.

Note that on Vercel the page itself is served by the CDN rather than Express, so
`APP_USER` / `APP_PASS` only guards `/api/*`. To lock the whole thing, turn on
**Settings → Deployment Protection → Vercel Authentication**, which is free on
Hobby and covers the production domain. Password Protection is a paid plan
feature and isn't available on Hobby.

## Hosting on a long-running server

`Dockerfile` and `fly.toml` are still here and still work. A persistent process
is the better fit: subjects stay pulled in memory between visits, so pages are
warm rather than fetched on demand.

```bash
fly launch --no-deploy          # accept the Dockerfile it finds
fly deploy
fly secrets set APP_USER=harshit APP_PASS=something-long
```

Here `APP_USER` / `APP_PASS` does protect everything, because Express serves the
page as well as the API.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/api/topics` | subject list with colours |
| GET | `/api/front?limit=14` | top stories across subjects |
| GET | `/api/topic/:key` | that subject's top ten |
| GET | `/api/search?q=...` | web search results |
| GET | `/api/article/:id` | extracted article text |

All list endpoints accept `?v=` — any value the server hasn't seen forces a
fresh pull of that subject, which is exactly what the Refresh button sends.
