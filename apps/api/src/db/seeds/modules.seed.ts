import { db } from '../../config/db';

const MODULES = [
  {
    slug: 'intro-to-stocks',
    title: 'Introduction to Stocks',
    description: 'Learn what stocks are, how the stock market works, and why companies issue shares.',
    assetType: 'stock',
    difficulty: 'beginner',
    xpReward: 200,
    sortOrder: 1,
    lessons: [
      {
        slug: 'what-is-a-stock',
        title: 'What Is a Stock?',
        estimatedMinutes: 5,
        xpReward: 30,
        content: [
          { type: 'text', content: 'A stock (also called a share or equity) represents partial ownership in a company. When you buy a stock, you become a part-owner — called a shareholder — of that company.' },
          { type: 'key_term', term: 'Stock', definition: 'A financial instrument representing an ownership stake in a company. Each share equals a fractional claim on the company\'s assets and earnings.' },
          { type: 'text', content: 'Companies issue stocks to raise money for growth. Instead of taking on debt, they sell pieces of the company to the public. If the company grows and becomes more valuable, your shares become more valuable too.' },
          { type: 'callout', variant: 'tip', content: 'On this platform, you trade with virtual money — so you can practice and learn without any real financial risk!' },
        ],
        quiz: { question: 'What does owning a stock represent?', options: [{ id: 'a', text: 'A loan to the company', isCorrect: false }, { id: 'b', text: 'Partial ownership in the company', isCorrect: true }, { id: 'c', text: 'A guaranteed payment each year', isCorrect: false }, { id: 'd', text: 'A bond issued by the company', isCorrect: false }], explanation: 'A stock represents partial ownership (equity) in a company. Bondholders are lenders, not owners.' },
      },
      {
        slug: 'how-stock-prices-work',
        title: 'How Stock Prices Work',
        estimatedMinutes: 7,
        xpReward: 35,
        content: [
          { type: 'text', content: 'Stock prices are determined by supply and demand. When more people want to buy a stock than sell it, the price goes up. When more people want to sell, the price goes down.' },
          { type: 'key_term', term: 'Market Price', definition: 'The current price at which a stock is trading on the exchange — the last price at which a buyer and seller agreed to transact.' },
          { type: 'callout', variant: 'info', content: 'Stock prices on this platform are pulled from real market data, so you can see how actual stocks perform in real time.' },
          { type: 'text', content: 'Many factors influence stock prices: company earnings, economic data, news events, investor sentiment, and broader market conditions.' },
        ],
        quiz: { question: 'What primarily determines a stock\'s price?', options: [{ id: 'a', text: 'The government sets it', isCorrect: false }, { id: 'b', text: 'Supply and demand from buyers and sellers', isCorrect: true }, { id: 'c', text: 'The company decides the price each day', isCorrect: false }, { id: 'd', text: 'It never changes once set', isCorrect: false }], explanation: 'Stock prices are set by supply and demand in the marketplace. When buyers outnumber sellers, prices rise.' },
      },
      {
        slug: 'reading-a-stock-quote',
        title: 'Reading a Stock Quote',
        estimatedMinutes: 6,
        xpReward: 30,
        content: [
          { type: 'text', content: 'A stock quote shows you key information about a stock at a glance. Understanding how to read one is a core investing skill.' },
          { type: 'key_term', term: 'Ticker Symbol', definition: 'A unique abbreviation used to identify a publicly traded company\'s stock. For example, AAPL for Apple, TSLA for Tesla.' },
          { type: 'key_term', term: 'Change %', definition: 'The percentage by which a stock\'s price has changed compared to the previous trading day\'s close.' },
          { type: 'text', content: 'On your trade page, you can look up any ticker symbol to see its current price, daily change, and historical chart.' },
        ],
        quiz: { question: 'What is the ticker symbol for Apple Inc.?', options: [{ id: 'a', text: 'APLE', isCorrect: false }, { id: 'b', text: 'APPL', isCorrect: false }, { id: 'c', text: 'AAPL', isCorrect: true }, { id: 'd', text: 'APL', isCorrect: false }], explanation: 'Apple\'s ticker symbol is AAPL on the NASDAQ exchange.' },
      },
    ],
  },
  {
    slug: 'intro-to-etfs',
    title: 'Introduction to ETFs',
    description: 'Discover how Exchange-Traded Funds provide instant diversification and are a favorite of long-term investors.',
    assetType: 'etf',
    difficulty: 'beginner',
    xpReward: 200,
    sortOrder: 2,
    lessons: [
      {
        slug: 'what-is-an-etf',
        title: 'What Is an ETF?',
        estimatedMinutes: 6,
        xpReward: 35,
        content: [
          { type: 'text', content: 'An ETF (Exchange-Traded Fund) is like a basket of investments that trades on a stock exchange. Instead of buying individual stocks, you buy one ETF that holds many stocks at once.' },
          { type: 'key_term', term: 'ETF (Exchange-Traded Fund)', definition: 'A fund that holds a collection of assets (stocks, bonds, etc.) and trades on an exchange like a single stock. Provides instant diversification.' },
          { type: 'callout', variant: 'tip', content: 'SPY is one of the most famous ETFs — it tracks the S&P 500 index, giving you exposure to the 500 largest US companies with one purchase.' },
        ],
        quiz: { question: 'What is the main benefit of buying an ETF over a single stock?', options: [{ id: 'a', text: 'ETFs always go up in value', isCorrect: false }, { id: 'b', text: 'Instant diversification across many companies', isCorrect: true }, { id: 'c', text: 'ETFs pay higher dividends', isCorrect: false }, { id: 'd', text: 'No risk of loss', isCorrect: false }], explanation: 'ETFs provide instant diversification — one purchase gives you exposure to many companies, reducing the impact if any single company performs poorly.' },
      },
    ],
  },
  {
    slug: 'intro-to-crypto',
    title: 'Introduction to Cryptocurrency',
    description: 'Explore the world of digital currencies, blockchain technology, and how crypto fits into an investment portfolio.',
    assetType: 'crypto',
    difficulty: 'beginner',
    xpReward: 200,
    sortOrder: 3,
    lessons: [
      {
        slug: 'what-is-cryptocurrency',
        title: 'What Is Cryptocurrency?',
        estimatedMinutes: 8,
        xpReward: 35,
        content: [
          { type: 'text', content: 'Cryptocurrency is digital money that uses cryptography to secure transactions and control the creation of new units. Unlike traditional currencies, crypto is decentralized — no government or bank controls it.' },
          { type: 'key_term', term: 'Blockchain', definition: 'A distributed digital ledger that records all transactions across a network of computers. Each "block" contains transaction data and is chained to previous blocks.' },
          { type: 'callout', variant: 'warning', content: 'Crypto is highly volatile. Prices can swing 20-50% in a single day. Always invest only what you can afford to lose — which is why practicing with virtual money first is so valuable!' },
        ],
        quiz: { question: 'What makes cryptocurrency "decentralized"?', options: [{ id: 'a', text: 'It\'s controlled by one large bank', isCorrect: false }, { id: 'b', text: 'No central authority (like a government or bank) controls it', isCorrect: true }, { id: 'c', text: 'It can only be used in one country', isCorrect: false }, { id: 'd', text: 'Transactions require government approval', isCorrect: false }], explanation: 'Cryptocurrencies operate on decentralized networks — no single entity controls them, unlike traditional currencies controlled by central banks.' },
      },
    ],
  },
  {
    slug: 'intro-to-bonds',
    title: 'Introduction to Bonds',
    description: 'Understand fixed-income securities and why bonds play an important role in a balanced portfolio.',
    assetType: 'bond',
    difficulty: 'beginner',
    xpReward: 200,
    sortOrder: 4,
    lessons: [
      {
        slug: 'what-is-a-bond',
        title: 'What Is a Bond?',
        estimatedMinutes: 7,
        xpReward: 35,
        content: [
          { type: 'text', content: 'A bond is essentially a loan you make to a company or government. In return, they promise to pay you regular interest (called a coupon) and return your principal when the bond matures.' },
          { type: 'key_term', term: 'Bond', definition: 'A fixed-income instrument where an investor lends money to a borrower (company or government) in exchange for regular interest payments and the return of principal at maturity.' },
          { type: 'key_term', term: 'Yield', definition: 'The annual return earned on a bond, expressed as a percentage of the bond\'s price.' },
          { type: 'callout', variant: 'info', content: 'Bonds are generally less risky than stocks, which is why many investors hold both to balance their portfolio.' },
        ],
        quiz: { question: 'When you buy a bond, you are essentially doing what?', options: [{ id: 'a', text: 'Buying part ownership in a company', isCorrect: false }, { id: 'b', text: 'Lending money to the issuer', isCorrect: true }, { id: 'c', text: 'Buying a commodity like gold', isCorrect: false }, { id: 'd', text: 'Speculating on currency exchange rates', isCorrect: false }], explanation: 'Bonds are debt instruments. You lend money to the issuer (government or company) and receive interest in return.' },
      },
    ],
  },
  {
    slug: 'diversification',
    title: 'Diversification & Risk',
    description: 'Learn why "don\'t put all your eggs in one basket" is the most important rule in investing.',
    difficulty: 'beginner',
    xpReward: 250,
    sortOrder: 5,
    lessons: [
      {
        slug: 'what-is-diversification',
        title: 'What Is Diversification?',
        estimatedMinutes: 8,
        xpReward: 40,
        content: [
          { type: 'text', content: 'Diversification means spreading your investments across different assets so that the poor performance of any single investment doesn\'t devastate your entire portfolio.' },
          { type: 'key_term', term: 'Diversification', definition: 'The practice of spreading investments across different assets, sectors, and geographies to reduce risk. Based on the idea that different investments often don\'t move in the same direction at the same time.' },
          { type: 'callout', variant: 'tip', content: 'Try to hold a mix of stocks, ETFs, and potentially some crypto in your paper portfolio. Watch how diversification affects your overall returns compared to holding just one asset.' },
          { type: 'text', content: 'A diversified portfolio might include: stocks from different sectors (tech, healthcare, finance), ETFs that track broad indices, bonds for stability, and a small allocation to higher-risk/higher-reward assets like crypto.' },
        ],
        quiz: { question: 'Why is diversification important?', options: [{ id: 'a', text: 'It guarantees profits', isCorrect: false }, { id: 'b', text: 'It eliminates all investment risk', isCorrect: false }, { id: 'c', text: 'It reduces the impact of any single investment performing poorly', isCorrect: true }, { id: 'd', text: 'It maximizes returns in all market conditions', isCorrect: false }], explanation: 'Diversification doesn\'t eliminate risk or guarantee profits, but it reduces the impact of any single bad investment on your overall portfolio.' },
      },
    ],
  },
];

export async function seedModules() {
  for (const mod of MODULES) {
    const { rows } = await db.query(
      `INSERT INTO modules(slug, title, description, asset_type, difficulty, xp_reward, sort_order, is_published)
       VALUES($1,$2,$3,$4,$5,$6,$7,true)
       ON CONFLICT(slug) DO UPDATE SET title=$2, description=$3, is_published=true
       RETURNING id`,
      [mod.slug, mod.title, mod.description, (mod as { assetType?: string }).assetType || null, mod.difficulty, mod.xpReward, mod.sortOrder],
    );
    const moduleId = rows[0].id;

    for (let i = 0; i < mod.lessons.length; i++) {
      const lesson = mod.lessons[i];
      const lessonRows = await db.query(
        `INSERT INTO lessons(module_id, slug, title, content_json, xp_reward, sort_order, estimated_minutes)
         VALUES($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [moduleId, lesson.slug, lesson.title, JSON.stringify(lesson.content), lesson.xpReward, i + 1, lesson.estimatedMinutes],
      );
      if (lessonRows.rows.length > 0 && lesson.quiz) {
        await db.query(
          `INSERT INTO quizzes(lesson_id, question_text, options, explanation, xp_reward)
           VALUES($1,$2,$3,$4,25)
           ON CONFLICT DO NOTHING`,
          [lessonRows.rows[0].id, lesson.quiz.question, JSON.stringify(lesson.quiz.options), lesson.quiz.explanation],
        );
      }
    }
  }
  console.log(`✅ Seeded ${MODULES.length} modules with lessons and quizzes`);
}
