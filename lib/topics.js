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

const siteFeed = (site, query = '') => {
  const domain = site.split('/')[0];
  return gnews(`site:${domain}${query ? ` ${query}` : ''}`);
};

export const TOPICS = [
  {
    key: 'fin',
    name: 'Finance',
    colour: '#C98B3A',
    feeds: [
      ...['ft.com', 'bloomberg.com', 'wsj.com', 'reuters.com/business/finance', 'cnbc.com', 'barrons.com', 'financialpost.com', 'investopedia.com/financial-news-4769738'].map((site) => siteFeed(site, 'finance when:3d')),
    ],
  },
  {
    key: 'quant',
    name: 'Quantitative Finance',
    colour: '#3ED0D6',
    feeds: [
      ...['risk.net/topics/quantitative-finance', 'quantstart.com', 'quantivity.wordpress.com', 'alphaarchitect.com/blog', 'quantocracy.com', 'wilmott.com', 'risk.net/journal-of-computational-finance', 'ssrn.com/en/index.cfm/finance-academic-research-net'].map((site) => siteFeed(site, 'quant OR trading OR finance when:30d')),
    ],
  },
  {
    key: 'phy',
    name: 'Physics',
    colour: '#7C8CFF',
    feeds: [
      ...['phys.org', 'physicsworld.com', 'physics.aps.org', 'quantamagazine.org/physics', 'nature.com/nphys', 'cerncourier.com', 'scitechdaily.com/news/physics', 'physicstoday.org'].map((site) => siteFeed(site, 'physics when:14d')),
    ],
  },
  {
    key: 'pf',
    name: 'Physics & Finance',
    colour: '#A96CFF',
    feeds: [
      ...['arxiv.org/archive/q-fin', 'santafe.edu/news', 'iopscience.iop.org/journal/1742-5468', 'sciencedirect.com/journal/physica-a', 'informaconnect.com/quant-finance/articles', 'quantecon.org', 'journals.aps.org/pre', 'epjdatascience.springeropen.com'].map((site) => siteFeed(site, 'quantitative finance OR econophysics when:14d')),
    ],
  },
  {
    key: 'hf',
    name: 'Healthcare & Fitness',
    colour: '#45D67A',
    feeds: [
      ...['statnews.com', 'fiercehealthcare.com', 'medicalxpress.com', 'healthline.com/health-news', 'menshealth.com/health', 'barbend.com', 'strongerbyscience.com/articles', 'examine.com'].map((site) => siteFeed(site, 'health OR fitness when:7d')),
    ],
  },
  {
    key: 'biz',
    name: 'Business World',
    colour: '#FF9147',
    feeds: [
      ...['hbr.org', 'fortune.com', 'forbes.com', 'inc.com', 'fastcompany.com', 'bloomberg.com/industry', 'economist.com/business', 'mckinsey.com/featured-insights'].map((site) => siteFeed(site, 'business when:7d')),
    ],
  },
  {
    key: 'stk',
    name: 'Stock Market',
    colour: '#FF4F6E',
    feeds: [
      ...['seekingalpha.com', 'marketwatch.com', 'finance.yahoo.com', 'fool.com', 'finviz.com/news.ashx', 'stocktwits.com', 'zacks.com', 'morningstar.com'].map((site) => siteFeed(site, 'stock market when:3d')),
    ],
  },
  {
    key: 'env',
    name: 'Environment',
    colour: '#A8D84A',
    feeds: [
      ...['insideclimatenews.org', 'carbonbrief.org', 'news.mongabay.com', 'grist.org', 'e360.yale.edu', 'theguardian.com/environment', 'enn.com', 'cleantechnica.com'].map((site) => siteFeed(site, 'environment OR climate when:14d')),
    ],
  },
  {
    key: 'gk',
    name: 'General Knowledge',
    colour: '#F06AC0',
    feeds: [
      ...['bbc.com/news', 'apnews.com', 'npr.org', 'theatlantic.com', 'bigthink.com', 'smithsonianmag.com', 'aeon.co', 'realclearworld.com'].map((site) => siteFeed(site, 'world OR science when:7d')),
    ],
  },
  {
    key: 'ma',
    name: 'Mergers & Acquisitions',
    colour: '#4FB3FF',
    feeds: [
      ...['nytimes.com/section/business/dealbook', 'pitchbook.com/news', 'mergermarket.com', 'thedeal.com', 'globalmanetwork.com', 'pehub.com', 'spglobal.com/marketintelligence', 'reuters.com/business/deals'].map((site) => siteFeed(site, 'merger OR acquisition OR deal when:14d')),
    ],
  },
  {
    key: 'ai',
    name: 'Artificial Intelligence',
    colour: '#EDDD5E',
    feeds: [
      ...['technologyreview.com/topic/artificial-intelligence', 'venturebeat.com/category/ai', 'arxiv.org/list/cs.AI/recent', 'deeplearning.ai/the-batch', 'techcrunch.com/category/artificial-intelligence', 'importai.substack.com', 'huggingface.co/blog', 'artificialintelligence-news.com'].map((site) => siteFeed(site, 'artificial intelligence when:7d')),
    ],
  },
];

export const TOPIC_BY_KEY = Object.fromEntries(TOPICS.map((t) => [t.key, t]));
