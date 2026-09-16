// Topics, their colours, and where their stories come from.
//
// Every topic has a list of feed URLs. A feed that dies just gets skipped,
// so you can add and remove sources freely without breaking anything.
//
// `gnews(query)` builds a Google News RSS search feed. It's the easiest way
// to cover a narrow subject that has no dedicated publication, and it returns
// links from many outlets at once, which is exactly what the "most talked
// about" ranking needs.

const gnews = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;

export const TOPICS = [
  {
    key: 'fin',
    name: 'Finance',
    colour: '#C98B3A',
    feeds: [
      'https://www.cnbc.com/id/10000664/device/rss/rss.html',      // CNBC Finance
      'https://feeds.content.dowjones.io/public/rss/mw_topstories', // MarketWatch
      'https://economictimes.indiatimes.com/wealth/rssfeeds/837555174.cms',
      gnews('central bank OR "interest rates" OR inflation when:3d'),
    ],
  },
  {
    key: 'quant',
    name: 'Quantitative Finance',
    colour: '#3ED0D6',
    feeds: [
      'http://export.arxiv.org/rss/q-fin',
      gnews('"quant fund" OR "systematic trading" OR "hedge fund" quant when:7d'),
      gnews('"algorithmic trading" OR "statistical arbitrage" when:7d'),
    ],
  },
  {
    key: 'phy',
    name: 'Physics',
    colour: '#7C8CFF',
    feeds: [
      'https://phys.org/rss-feed/physics-news/',
      'https://www.sciencedaily.com/rss/matter_energy/physics.xml',
      'https://physics.aps.org/feed',
      'https://www.sci.news/physics/feed',
    ],
  },
  {
    key: 'pf',
    name: 'Physics & Finance',
    colour: '#A96CFF',
    feeds: [
      'http://export.arxiv.org/rss/q-fin.ST',   // statistical finance
      'http://export.arxiv.org/rss/q-fin.CP',   // computational finance
      gnews('econophysics OR "quantum finance" OR "quantum computing" finance when:14d'),
    ],
  },
  {
    key: 'hf',
    name: 'Healthcare & Fitness',
    colour: '#45D67A',
    feeds: [
      'https://www.sciencedaily.com/rss/health_medicine.xml',
      'https://www.sciencedaily.com/rss/health_medicine/fitness.xml',
      'https://feeds.bbci.co.uk/news/health/rss.xml',
      gnews('exercise OR nutrition OR longevity study when:5d'),
    ],
  },
  {
    key: 'biz',
    name: 'Business World',
    colour: '#FF9147',
    feeds: [
      'https://feeds.bbci.co.uk/news/business/rss.xml',
      'https://www.cnbc.com/id/10001147/device/rss/rss.html',       // CNBC Business
      'https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms',
    ],
  },
  {
    key: 'stk',
    name: 'Stock Market',
    colour: '#FF4F6E',
    feeds: [
      'https://www.cnbc.com/id/20910258/device/rss/rss.html',        // CNBC Markets
      'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
      'https://www.moneycontrol.com/rss/marketreports.xml',
      gnews('Sensex OR Nifty OR "S&P 500" when:2d'),
    ],
  },
  {
    key: 'env',
    name: 'Environment',
    colour: '#A8D84A',
    feeds: [
      'https://www.theguardian.com/environment/rss',
      'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
      'https://www.sciencedaily.com/rss/earth_climate.xml',
    ],
  },
  {
    key: 'gk',
    name: 'General Knowledge',
    colour: '#F06AC0',
    feeds: [
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://www.sciencedaily.com/rss/top/science.xml',
      'https://feeds.npr.org/1004/rss.xml',
    ],
  },
  {
    key: 'ma',
    name: 'Mergers & Acquisitions',
    colour: '#4FB3FF',
    feeds: [
      gnews('acquisition OR merger OR takeover billion when:5d'),
      gnews('"private equity" buyout deal when:5d'),
      'https://economictimes.indiatimes.com/news/company/corporate-trends/rssfeeds/1977021501.cms',
    ],
  },
  {
    key: 'ai',
    name: 'Artificial Intelligence',
    colour: '#EDDD5E',
    feeds: [
      'https://techcrunch.com/category/artificial-intelligence/feed/',
      'https://www.artificialintelligence-news.com/feed/',
      'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
      gnews('"artificial intelligence" OR "large language model" when:2d'),
    ],
  },
];

export const TOPIC_BY_KEY = Object.fromEntries(TOPICS.map((t) => [t.key, t]));
