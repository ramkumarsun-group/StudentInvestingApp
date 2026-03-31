---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish]
inputDocuments: [STUDENT_INVESTING_APP_PLAN.md, STUDENT_INVESTING_APP_OVERVIEW.md, SOLUTION_DIAGRAM_PHASES_1_3.md, CLAUDE.md]
workflowType: prd
briefCount: 0
researchCount: 0
projectDocsCount: 4
---

# Product Requirements Document - StockPlay

**Author:** Ramkumar
**Date:** 2026-03-23

## Executive Summary

StockPlay is a mobile-first, gamified investing education platform for students aged 13–25. It closes the gap between financial literacy content (abundant, static, desktop-oriented) and the way Gen Z actually learns: in short bursts, on their phone, through doing rather than watching. Students practice with $100,000 in virtual capital against live market data — making real investment decisions with zero financial risk — while earning XP, badges, and leaderboard rank.

The platform serves two customer segments simultaneously: students (B2C, direct engagement) and educational institutions (B2B, teacher-led class management). Phase 1 delivers the student paper-trading core and gamification loop. Phase 2 adds the school channel — teacher dashboards, class leagues, and curriculum-aligned challenges. Phase 3 introduces an AI coach powered by Claude `claude-sonnet-4-6`, Stripe Pro subscriptions ($4.99/mo), and PWA (Progressive Web App) delivery. Phase 4 introduces the iPhone App and Android App.

**Target users:** High school and college students (13–25), with a secondary segment of economics/finance teachers seeking low-setup classroom engagement tools.

**Problem being solved:** No investing education product exists with a mobile-first, Gen Z-native mental model. Incumbents (Robinhood, Fidelity, Bloomberg) target adults with real assets. EdTech tools assume desktop access and 30-minute attention spans. The result: the first smartphone-native generation entering prime financial decision-making age has no purpose-built tool to learn with.

### What Makes This Special

**Core differentiator:** Live market data + real decision-making + emotional feedback loop, delivered in a mobile-first format students actually use — not a textbook repackaged as an app.

**Structural timing advantage:** Gen Z (born 1997–2012) is now 14–29. They grew up with smartphones as their primary compute device and are entering peak financial curiosity (crypto, meme stocks, FIRE movement). No well-resourced company has been incentivized to build for them — until now. The cost to serve this cohort (cloud infrastructure, market data APIs, AI models) has dropped to the point where a lean product can compete.

**Defensible moats:**
- School network effects: a teacher's class creates a cluster of daily-active students
- Behavioral dataset: anonymized data on how 13–25 year-olds make financial decisions is uniquely valuable to financial institutions (opt-in, aggregate only)
- AI coach personalization: portfolio-aware Claude coaching improves with each interaction

**Key insights from user research:**
- Daily retention is driven by social/competitive triggers (leaderboard position, friend activity), not educational intent — learning is the side effect
- Beginner shame is a silent churn driver — experience-tiered leaderboards are required, not optional
- Teacher adoption requires < 5 min setup and one-click progress export
- FERPA compliance and Google Workspace SSO are Phase 1 school-channel prerequisites, not Phase 2 nice-to-haves
- AI coach must be framed as educational, not advisory (SEC regulatory boundary)

## Success Criteria

### User Success

- A student completes onboarding (registration → first trade) in **< 3 minutes** on mobile
- A student who opens the app returns the **next day** (D1 retention ≥ 40%)
- Students complete at least **1 learning module** within their first week
- A beginner student can place their first trade **without reading any documentation**
- A student can articulate the difference between a stock, ETF, and crypto after completing Module 1
- Teacher sets up a class and assigns a challenge in **< 5 minutes**
- Teacher can export class progress report in **1 click**

### Business Success

| Metric | 3-Month Target | 12-Month Target |
|--------|---------------|-----------------|
| Registered students | 1,000 | 10,000 |
| Weekly Active Users | 400 (40% WAU/registered) | 4,000 |
| Schools/classes active | 10 | 100 |
| Pro subscribers | — | 500 |
| D7 retention | ≥ 25% | ≥ 30% |
| Avg session length | ≥ 4 min | ≥ 6 min |

### Technical Success

- API p95 response time **< 200ms** for all non-market-data endpoints
- Market quote cache hit rate **≥ 90%** (Redis, 30s TTL)
- Zero PII stored in third-party analytics or ad trackers (FERPA)
- FERPA-compliant data handling with signed DPA available for schools
- Google Workspace SSO working before first school onboards
- AI coach responses stream within **< 1s** to first token
- 99.5% uptime SLA for API (paper trading; no real money at risk)

### Measurable Outcomes

- **Aha moment:** Student sees their portfolio go green or red in real-time after first trade
- **Retention driver:** Student returns because they're ranked #X on leaderboard or received a badge notification
- **Teacher ROI:** Teacher sees a student who was disengaged in class complete 3 lessons in a week
- **Learning outcome:** Students who complete all 5 modules score ≥ 70% on a financial literacy post-test

## User Journeys

### Journey 1: Jordan's First Week — The Beginner Finds His Footing

*Primary User · Success Path*

Jordan is a 19-year-old CS student. He's heard "invest early" his whole life but the word ETF still means nothing to him. His roommate texted him a link to StockPlay.

**Opening Scene:** Jordan opens the link on his phone at 11pm. He's skeptical — every finance app he's tried felt like reading a Wikipedia article. He sees a clean screen: "Start with $100,000. No real money. No risk." He signs up in 90 seconds with Google.

**Rising Action:** The app drops him into a dashboard showing his $100K balance. A tooltip says "Search any stock or crypto to start." He types "Tesla" — he's heard of it. A card shows the live price, a mini chart, and a green "Buy" button. He buys 10 shares. His portfolio ticks up $47 within the minute. A notification arrives: "🏆 First Trade badge unlocked. +50 XP." He checks the leaderboard — he's #312 out of 400 students. He thinks: *I could beat some of these people.*

The next day he opens the app to check his portfolio (it's down $23). He clicks "Why did Tesla drop?" — the app surfaces a NewsAPI headline about an earnings miss. He didn't know earnings reports were a thing. He taps a "Learn more" link that opens Module 1, Lesson 3: "What moves stock prices."

**Climax:** By day 5, Jordan has completed Module 1, made 8 trades, and climbed to #187. His roommate signs up after seeing Jordan's leaderboard rank on his screen.

**Resolution:** Jordan can now explain to his roommate what a P/E ratio means. He's opened the app every day this week — not because he planned to learn investing, but because he wanted to check his rank.

**Requirements revealed:** Google SSO, live price on trade card, first-trade XP notification, leaderboard with rank, contextual news surface, module deep-link from portfolio

---

### Journey 2: Maya Hits the Ceiling — The Advanced Student Upgrades

*Primary User · Edge Case / Pro Conversion*

Maya is a 21-year-old finance major. She signed up expecting to be bored. She wasn't wrong about the beginner modules — she skipped most of them. But the leaderboard has her attention: she's #3 globally and wants #1.

**Opening Scene:** Maya opens the Modules page and sees "Options Trading — Unlock with Pro" greyed out behind a lock icon. She's frustrated — this is exactly what she wants. She checks the price: $4.99/mo.

**Rising Action:** She visits the AI Coach page. A preview shows: "Ask me anything about your portfolio." She types "Why is my Sharpe ratio so low?" The response is locked behind Pro. That's the moment she converts. She taps "Upgrade to Pro" → Stripe checkout pre-filled with her email → Apple Pay tap → done in 14 seconds. The options module unlocks instantly.

**Climax:** She spends 40 minutes on the options module, builds a covered call strategy on her virtual AAPL position, and asks the AI coach to critique it. The coach references her actual holdings: "Your cost basis on AAPL is $183.42. A covered call at $190 strike expiring next Friday would yield approximately 0.8% premium…" She screenshots it and posts to her finance Discord: "this AI actually knows my portfolio."

**Resolution:** Maya is now a Pro subscriber and an organic advocate. She's told 6 people in her finance program about the AI coach. She's #1 on the leaderboard.

**Requirements revealed:** Module lock/unlock UI, Pro paywall gate, Stripe checkout (fast path), AI coach with live portfolio context, screenshot-worthy AI response quality

---

### Journey 3: Mr. Chen's Monday Morning — The Teacher Onboards a Class

*Secondary User · Teacher Admin Path*

Mr. Chen has 28 students in his AP Economics class. He has 8 minutes between periods.

**Opening Scene:** Mr. Chen registered as a teacher last night. He clicks "Create Class" → types "AP Econ Period 3" → clicks Create. A 6-character join code appears: `CHEN42`. That took 45 seconds.

**Rising Action:** He puts the join code on the whiteboard. By the end of class, 21 of 28 students have joined — visible in real-time on his teacher dashboard. He creates a 2-week challenge: "Best portfolio return using only S&P 500 stocks." Three clicks.

**Climax:** Day 8. Mr. Chen sees that Marcus — who never participates in class — has made 34 trades and completed 4 learning modules. He's #2 in the class challenge. Mr. Chen calls on Marcus in class. Friday: he clicks "Export Report." A CSV downloads with each student's trades, modules completed, XP, and portfolio return.

**Resolution:** Mr. Chen tells the department head: "I had 78% of students voluntarily doing finance activities outside class hours." He's asked to present the tool at the next staff meeting.

**Requirements revealed:** Teacher registration, class creation < 60s, join-code display, real-time student roster, challenge creation wizard, student activity dashboard, one-click CSV export

---

### Journey 4: Priya Goes Viral — The Social Sharer

*Primary User · Social Virality Path*

Priya is 15, competitive, and very online. She joined because her friend showed her the badges page.

**Opening Scene:** Priya earns the "Crypto Pioneer" badge after her third crypto trade. A share button appears. She taps it — a styled card generates with her username, badge art, and "StockPlay — learn investing for free." She shares it to her Instagram story.

**Rising Action:** Three friends DM her asking what the app is. Two sign up that afternoon. She now sees them on the leaderboard and is determined to stay ahead. Her streak hits 7 days. A flame icon animates on her profile. Her friend beats her return by 2%. She immediately makes three new trades, then completes a quiz to earn bonus XP. She regains the lead by end of day.

**Resolution:** Priya has been active for 3 consecutive weeks — her longest streak with any app. She's the reason 4 people in her friend group signed up.

**Requirements revealed:** Shareable badge card (styled image), streak flame animation, friend sub-leaderboard, competitive re-engagement trigger, referral attribution

---

### Journey 5: Safe Failure — Jordan's Trade During API Outage

*Primary User · Error Recovery*

Jordan tries to buy 5 shares of NVDA during a brief Alpaca API outage. He taps Buy. The button spins. After 4 seconds, a toast appears: "Market data temporarily unavailable. Your order was not placed." His cash balance is unchanged. Two minutes later the quote loads and his order succeeds.

Jordan never lost trust in the app because the failure was clean, transparent, and his virtual money was never at risk.

**Requirements revealed:** Graceful API failure handling, clear error toast messaging, no partial order states, idempotent order creation

---

## Domain-Specific Requirements

### Compliance & Regulatory

**FERPA (Family Educational Rights and Privacy Act)**
- Any school partnership makes StockPlay a "school official" — student education records are protected
- Data Processing Agreement (DPA) must be available for all school sign-ups before any student data is collected
- Students' PII (name, email, performance data) may not be shared with third parties without consent
- Parents of students under 18 have right to access and request deletion of records

**COPPA (Children's Online Privacy Protection Act)**
- Minimum age 13 with date-of-birth verification at registration
- Under-13 registration hard-blocked with message to contact school/parent
- No behavioral advertising to under-13s under any circumstances

**SEC / FINRA — Educational Carve-Out**
- Paper trading is not a regulated activity — no broker-dealer license required
- AI coach responses must be clearly framed as educational content only, not investment advice
- Required disclaimer on AI coach and trade pages: "This is a simulated environment. Nothing here constitutes financial advice."
- AI coach system prompt must prohibit specific security recommendations ("buy X", "sell X")

**GDPR (future EU expansion)**
- Lawful basis for processing: legitimate interest for education
- Right to erasure: deleted account data purged within 30 days
- EU student data residency: flag for future infrastructure separation

### Risk Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| AI coach gives specific investment advice | Medium | System prompt prohibition + UI disclaimer on every AI response |
| Student data breach via third-party SDK | Medium | Audit all dependencies; no ad/analytics SDKs in student-facing app |
| School IT blocks app on content filter | High | PWA served from clean domain; document IT whitelist requirements |
| COPPA violation via under-13 registration | Low | Hard DOB gate at registration |
| Market API rate limit causes trade failure | Medium | Redis cache-first; graceful fallback; no order placed on stale data |
| Gamification incentivizes over-trading | Medium | Daily trade XP cap; bonus XP for research and learning activities |
| FinTech regulatory scrutiny at scale | Low (Phase 1) | Maintain paper-trading-only positioning; legal review before any real-money features |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Mobile-First Mental Model for Investing Education**

Every existing investing education tool was built for desktop — Investopedia, MarketWatch simulators, Stock Market Game. They assume 30-minute focused sessions. StockPlay is architected from the ground up for 3-minute mobile bursts: thumb-sized buy/sell panels, swipeable charts, push notification re-engagement. This is not a desktop app made responsive — it is a new UX paradigm for the category.

**2. Emotional Feedback Loop as the Learning Mechanism**

Traditional EdTech presents content then tests recall. StockPlay inverts this: students act first (make a trade), then feel the consequence (portfolio goes green or red), then understand why (contextual news + module deep-link). The emotion comes before the explanation — which is how real financial literacy is formed. No existing paper-trading platform has intentionally designed this loop.

**3. Portfolio-Aware AI Coach**

Most AI-powered EdTech tools answer generic questions with no context about the student. StockPlay's AI coach (Claude claude-sonnet-4-6) has read-access to the student's actual holdings, cost basis, return history, and completed modules. It can respond: "You're heavy in tech (67% allocation). Here's why that increases your volatility risk..." Contextual coaching that adapts to each student's specific situation — not generic content retrieval.

**4. Dual Network Effect (Student × School)**

StockPlay creates two compounding network effects simultaneously:
- Student side: each new student increases leaderboard competition, making the platform more engaging for all
- School side: each teacher brings a cohort of 20–30 students; school adoption drives clusters of daily-active users

Most EdTech tools have one or the other. Having both creates a defensible moat that compounds over time.

**5. Behavioral Dataset at the EdTech × FinTech Intersection**

At scale, StockPlay accumulates a unique dataset: how 13–25 year-olds make financial decisions before they have real money. This has significant value to financial institutions for product design and financial literacy programs — opt-in, anonymized, aggregate only.

### Market Context & Competitive Landscape

| Competitor | Strength | Gap StockPlay Fills |
|------------|---------|--------------------------|
| Stock Market Game (SIFMA) | Established in schools | Desktop-only, 1990s UX, no gamification, no AI |
| Investopedia Simulator | Brand recognition | Not mobile-first, no social layer, no school channel |
| Robinhood | Mobile-first UX | Real money (risky for students), no education layer |
| Webull Paper Trading | Advanced charting | Overwhelming for beginners, no structured learning path |
| Khan Academy (finance) | Free, trusted, curriculum-aligned | Pure content — no simulation, no practice |
| Bloom Stock Investing App | Beginner-friendly, mobile-first stock education | Limited gamification, no school channel, no AI coach |

**The gap:** No product sits at the intersection of mobile-first + gamified + real market data + structured learning + school channel + AI coaching. StockPlay is the first to combine all six.

### Validation Approach

| Innovation | How to Validate | Success Signal |
|-----------|----------------|----------------|
| Mobile-first UX | Session completion rate on mobile vs desktop | ≥ 70% of sessions on mobile; avg session ≥ 4 min |
| Emotional feedback loop | Module start rate after first portfolio movement | ≥ 30% of students open a lesson within 24h of first trade |
| Portfolio-aware AI coach | NPS survey after AI interaction | ≥ 70% rate response as "helpful and specific to my portfolio" |
| Dual network effect | Cohort retention vs individual signup retention | School-sourced cohorts retain at 2× individual signup rate |
| School channel adoption | Teacher setup time measurement | 80% of teachers complete class setup in < 5 min |

### Innovation Risk Mitigation

| Innovation Risk | Mitigation |
|----------------|-----------|
| Mobile-first excludes desktop power users | Fully responsive — desktop works, mobile is the primary design target |
| Emotional feedback loop causes distress on portfolio loss | Loss framing is educational: "Down 8% — here's what happened and what to learn" |
| AI coach quality bar is high — shallow responses kill trust | Portfolio context in every prompt; Claude claude-sonnet-4-6; fallback to module suggestions |
| Behavioral dataset raises privacy concerns at scale | Strict opt-in; aggregate anonymized only; never sell individual data; clear ToS disclosure |
| School channel sales cycle is slow | Teacher self-serve (no sales call); join-code frictionless; free forever for teachers |

## Technical Architecture Requirements

StockPlay is a multi-tenant SaaS web application delivered as a responsive PWA (Phase 1–3), with native iOS and Android apps in Phase 4. It serves three tenant types: individual students (B2C), teacher-managed classrooms (B2B2C), and future school district accounts (B2B). Frontend: Next.js 14 App Router SPA. Backend: versioned Express REST API. Real-time market data and streaming AI responses require persistent connections beyond standard request/response.

### Platform Strategy

| Platform | Phase | Approach | Rationale |
|----------|-------|----------|-----------|
| Responsive Web — Mobile (PWA) | Phase 1 | Next.js + next-pwa | Fastest to ship; works on all devices immediately |
| Responsive Web — Desktop | Phase 1 | Next.js (same codebase, responsive breakpoints) | Students on computers get a full, optimised experience — not a stretched mobile layout |
| iOS App | Phase 4 | React Native (Expo) | Shares 80%+ business logic via shared packages |
| Android App | Phase 4 | React Native (Expo) | Simultaneous release with iOS |

**Why Desktop Web in Phase 1:** A meaningful segment of students (particularly in school computer labs and home study environments) will access StockPlay on a laptop or desktop. A mobile-only layout stretched to 1280px delivers a poor experience. The Next.js codebase already supports responsive design — desktop layout is an extension of the existing web app, not a new platform. No additional infrastructure required.

**Why React Native with Expo:** `packages/shared-types` and `packages/shared-utils` already work in React Native. Expo Router mirrors Next.js App Router patterns. Expo EAS Build handles app store pipelines. Avoids maintaining separate Swift + Kotlin codebases.

### Multi-Tenancy Model

| Tenant Level | Description | Data Isolation |
|-------------|-------------|----------------|
| Individual Student | Self-registered, no org affiliation | Own portfolio, XP, badges, orders |
| Classroom | Teacher-created, students join via code | Shared class leaderboard; private portfolios |
| School (future) | Admin-managed, multiple classes | Shared analytics; teacher management |

- Students may belong to zero or one class (MVP); multiple classes in future
- Teachers see only their own classes and enrolled students
- All queries scoped by `class_id` or `user_id` — no cross-class data leakage
- Leaderboard: global mode (all students) and class-scoped mode (teacher's students only)

### RBAC Permission Matrix

| Permission | Student | Teacher | Admin |
|-----------|---------|---------|-------|
| View own portfolio | ✅ | — | ✅ |
| Place trades | ✅ | — | — |
| View learning modules | ✅ | ✅ | ✅ |
| View class roster | — | ✅ (own) | ✅ (all) |
| Create class | — | ✅ | ✅ |
| Create challenge | — | ✅ | ✅ |
| Export class report | — | ✅ (own) | ✅ (all) |
| Access AI coach | Pro only | — | ✅ |
| Manage subscriptions | ✅ (own) | — | ✅ |
| View global leaderboard | ✅ | ✅ | ✅ |

### Subscription Tiers

| Tier | Price | Features | Gate Mechanism |
|------|-------|----------|----------------|
| Free | $0 | Paper trading, 5 modules, leaderboard, badges, streaks, class join | Default for all registered users |
| Student Pro | $4.99/mo | + AI coach, advanced modules, Pro badge | Stripe subscription; `is_pro` flag in JWT |
| School (future) | TBD per seat | Bulk teacher + student Pro, admin dashboard, district reporting | Manual provisioning Phase 3+ |

### Browser & Device Matrix

| Target | Support Level | Notes |
|--------|--------------|-------|
| Chrome mobile (Android) | Primary | Core mobile test target |
| Safari mobile (iOS) | Primary | Must test PWA install flow |
| Chrome desktop | Primary | Full desktop layout — co-equal with mobile |
| Safari desktop | Primary | Full desktop layout |
| Firefox desktop | Full support | No known blockers |
| Samsung Internet | Best effort | Large Android segment |
| Edge desktop | Best effort | Chromium-based; expected to work |

- Minimum mobile viewport: 390px width (iPhone 14 — matches Stitch design target)
- Minimum desktop viewport: 1024px (laptop); optimised for 1280px and 1440px
- Touch targets: minimum 44×44px on mobile (WCAG 2.5.5)
- No horizontal scroll at any supported viewport width
- Desktop layout uses sidebar navigation; mobile uses bottom tab bar

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint (FCP) | < 1.5s | Lighthouse on 4G throttle |
| Largest Contentful Paint (LCP) | < 2.5s | Core Web Vitals |
| API p95 response time | < 200ms | Non-market-data endpoints |
| Market quote latency | < 500ms cache hit | < 2s cache miss |
| AI coach first token | < 1s | SSE stream start |
| Initial JS bundle | < 200KB gzipped | Next.js bundle analyzer |

### Real-Time & Streaming

| Feature | Protocol | Implementation |
|---------|----------|---------------|
| AI coach responses | SSE | Express `res.write()` + Anthropic SDK stream |
| Live price on trade page | Polling 5s | TanStack Query `refetchInterval` |
| Portfolio value refresh | Polling 30s | Background refetch on focus |
| Push notifications (Phase 2) | Web Push API | Service worker + VAPID keys |

### Native Mobile Requirements (Phase 4)

**iOS**
- Minimum deployment target: iOS 16
- Push notifications via APNs
- Face ID / Touch ID for biometric login
- Apple Pay for Pro subscription
- App Store: paper trading clearly labeled "for educational purposes"

**Android**
- Minimum SDK: Android 8.0 / API level 26
- Push notifications via FCM
- Google Pay for Pro subscription
- Google Sign-In (mirrors web OAuth flow)
- Google Play: financial education app classification

**Shared Mobile**
- Deep linking: `stockplay://trade/AAPL`, `stockplay://learn/stocks`
- Offline state: show cached portfolio with "prices as of [timestamp]" banner
- App store ratings prompt: trigger after 7-day streak or first badge earned

### Updated Monorepo Structure (Phase 4)

```
apps/
  api/        Express REST API (existing)
  web/        Next.js 14 (existing)
  mobile/     Expo React Native (Phase 4)
packages/
  shared-types/   Already React Native compatible
  shared-utils/   Already React Native compatible
```

### Integration Architecture

```
Next.js (port 3000)
  └── /api/backend/* → rewrites to Express (port 4000)
  └── /api/auth/* → NextAuth (Google OAuth + credentials)

Express API (port 4000)
  ├── Alpaca Markets → stock/ETF quotes + OHLCV
  ├── CoinGecko → crypto quotes + history
  ├── NewsAPI → market headlines
  ├── Anthropic Claude claude-sonnet-4-6 → AI coach (streaming)
  ├── Stripe → subscription billing + webhooks
  ├── PostgreSQL → primary data store
  └── Redis → cache + leaderboard sorted sets + refresh tokens
```

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — ship the core emotional loop (trade → feel → learn → compete) before any secondary features. Every Phase 1 feature must either support the aha moment or prevent churn in the first session.

**MVP Aha Moment:** Student makes first trade, watches portfolio move with real market data, earns a badge, sees themselves on a leaderboard, and returns the next day.

**Resource Requirements:** 1 full-stack developer (existing codebase), 1 designer (UI/UX), free-tier API access (Alpaca, CoinGecko, NewsAPI)

### Phase 1 — Foundation (Months 1–3) · Web PWA

**Core User Journeys Supported:** Jordan J1 (beginner success path), Mr. Chen J3 (teacher onboarding), Jordan J5 (error recovery)

**Must-Have Capabilities:**

| Capability | Justification |
|-----------|--------------|
| Student registration + Google SSO | Onboarding < 90s; zero friction |
| Paper trading (stocks, ETFs, crypto) | The product's core value proposition |
| Live market quotes (Alpaca + CoinGecko) | "Real data" is the key differentiator |
| Portfolio dashboard with P&L | Emotional feedback loop — see your results |
| 5 learning modules with lessons, quizzes, XP | Learning side of learn-by-doing |
| XP system + 10 levels | Core retention loop |
| 19 badges | Celebration moments + share triggers |
| Daily streaks | Daily open trigger |
| Global leaderboard | Competitive re-engagement driver |
| Teacher class creation + join-code | B2B channel prerequisite |
| Class leaderboard | Teacher's primary proof of engagement |
| FERPA-compliant data handling + DPA | School adoption prerequisite |
| Responsive design — mobile + desktop | Mobile (390px) and desktop (1024px+) both first-class experiences |
| Desktop sidebar navigation layout | Students on computers get purpose-built desktop navigation, not stretched mobile |
| Graceful API failure handling | Trust — virtual money must never be at risk |

**Explicitly Out of Phase 1:** AI coach, Stripe Pro, push notifications, friend challenges, parent dashboard, advanced modules, native iOS/Android

### Phase 2 — School Channel & Social (Months 4–6)

**Core User Journeys Supported:** Priya J4 (social virality), Mr. Chen J3 (full teacher workflow)

| Capability | Justification |
|-----------|--------------|
| Class challenges with countdown + auto-grading | Teacher's most requested feature |
| Teacher progress reports (1-click CSV export) | Institutional adoption proof |
| Clever SSO integration | District IT prerequisite |
| Experience-tiered leaderboards (beginner / advanced) | Prevent beginner shame churn |
| Friend / peer challenges | Viral growth mechanism |
| Shareable badge cards (styled image) | Organic social acquisition |
| Push notifications (Web Push API) | Daily re-engagement trigger |
| Parent read-only dashboard | Under-18 trust signal for schools |
| Contextual news surfaced in portfolio | "Why did my stock move?" learning trigger |
| Deep-link from portfolio → lesson | Connect doing to learning |

### Phase 3 — AI Coach & Pro Monetization (Months 7–9)

**Core User Journeys Supported:** Maya J2 (Pro conversion and AI coach)

| Capability | Justification |
|-----------|--------------|
| Claude AI coach with portfolio context (streaming SSE) | Primary Pro value driver |
| Stripe Pro subscription ($4.99/mo) | Revenue; gates AI coach + advanced modules |
| Advanced learning modules (options, portfolio theory) | Advanced student retention |
| PWA (installable, offline-capable) | Mobile experience upgrade before native |
| School district licensing tier | B2B revenue expansion |
| Parent gifting flow | Seasonal revenue opportunity |

### Phase 4 — Native Mobile (Months 10–15)

| Capability | Justification |
|-----------|--------------|
| React Native (Expo) iOS app | App Store presence; reliable push notifications |
| React Native (Expo) Android app | Google Play presence; Android market coverage |
| Biometric login (Face ID / Touch ID) | Mobile-native trust signal |
| Apple Pay + Google Pay | Reduce Pro subscription checkout friction |
| Deep linking for push tap-through | Re-engagement on notification tap |
| Offline portfolio cache with timestamp banner | Usable without data connection |

### Risk Mitigation Strategy

**Technical Risks**

| Risk | Mitigation |
|------|-----------|
| Alpaca free tier rate limits at scale | Redis cache-first already built; upgrade to Alpaca Broker API at 1K+ DAU |
| AI coach response quality | System prompt engineering + portfolio context injection; review first 100 conversations |
| Real-time price accuracy | Label quotes "delayed up to 15 min" on free tier; upgrade at scale |

**Market Risks**

| Risk | Mitigation |
|------|-----------|
| Students don't return after Day 1 | Validate D1 retention before Phase 2 investment; iterate on notification strategy |
| Teachers don't complete setup | Measure setup funnel; add guided tour if < 60% complete |
| Pro conversion too low | A/B test paywall copy and pricing; consider 30-day free trial |

**Resource Risks**

| Risk | Mitigation |
|------|-----------|
| Single developer bottleneck | Phase 1 scope deliberately lean; modular architecture allows parallel work in Phase 2+ |
| API costs at scale | Free tiers sufficient to 1K MAU; model cost scaling in Phase 2 budget |
| App store review delays (Phase 4) | Submit iOS 4 weeks before target launch; Android typically faster |

## Functional Requirements

### User Account Management

- **FR1:** A visitor can register for a student account using email/password or Google OAuth
- **FR2:** A visitor can register for a teacher account with role selection during signup
- **FR3:** A registered user can log in using email/password or Google OAuth
- **FR4:** An authenticated user can view and update their profile information
- **FR5:** An authenticated user can log out and invalidate their session
- **FR6:** The system enforces a minimum registration age of 13 with date-of-birth verification
- **FR7:** A student account flagged as under-18 has parental visibility features available
- **FR8:** An authenticated user can request permanent account deletion with full data removal within 30 days

### Paper Trading & Portfolio

- **FR9:** A student can search for stocks, ETFs, and cryptocurrencies by name or ticker symbol
- **FR10:** A student can view a real-time price quote and price chart for any supported asset
- **FR11:** A student can place a market buy order for any supported asset using their virtual cash balance
- **FR12:** A student can place a market sell order for any asset they currently hold
- **FR13:** A student can view their complete portfolio including cash balance, holdings, total value, and overall P&L
- **FR14:** A student can view each holding's quantity, average cost, current value, and unrealised P&L
- **FR15:** A student can view their full order history
- **FR16:** A student can view their portfolio value history over time as a chart
- **FR17:** A student can view their portfolio asset allocation by asset class and individual holding
- **FR18:** A student can reset their portfolio to the starting $100,000 virtual cash balance
- **FR19:** The system prevents a student from placing an order that would exceed their available cash balance

### Market Data

- **FR20:** The system provides live price quotes for US stocks and ETFs via Alpaca Markets
- **FR21:** The system provides live price quotes for major cryptocurrencies via CoinGecko
- **FR22:** The system provides OHLCV price history charts across multiple timeframes (1D, 1W, 1M, 3M, 1Y)
- **FR23:** The system surfaces relevant market news headlines in context with portfolio holdings
- **FR24:** The system displays a trending assets section showing top movers
- **FR25:** The system handles market data API failures gracefully without placing or modifying orders

### Learning & Education

- **FR26:** A student can browse all available learning modules with difficulty level, estimated time, and XP reward
- **FR27:** A student can work through a module's lessons sequentially with each lesson unlocking on completion of the prior
- **FR28:** A student can view lesson content including text, callout blocks, and key term definitions
- **FR29:** A student can submit answers to a quiz at the end of a lesson and receive a score with explanations
- **FR30:** A student can track their learning progress across all modules showing completion percentage
- **FR31:** The system awards XP to a student upon completing a lesson and upon passing a quiz
- **FR32:** A Pro subscriber can access advanced learning modules not available on the free tier
- **FR33:** The system deep-links from a portfolio holding or market event directly to a relevant learning module

### Gamification & Engagement

- **FR34:** A student earns XP for completing defined activities including trading, learning, streaks, and referrals
- **FR35:** A student progresses through 10 named levels as their cumulative XP increases with level-up notifications
- **FR36:** A student can view all available badges, their unlock criteria, and their current unlock status
- **FR37:** The system automatically evaluates and awards badges when a student meets badge criteria
- **FR38:** A student maintains a daily activity streak that increments on consecutive days of activity and resets on missed days
- **FR39:** A student can view a global leaderboard ranked by portfolio return percentage
- **FR40:** A student can view a class leaderboard scoped to their enrolled class
- **FR41:** A student can share an earned badge as a styled image card to external social platforms
- **FR42:** The system sends in-app notifications for badge unlocks, level-ups, leaderboard rank changes, and streak milestones

### School & Teacher Management

- **FR43:** A teacher can create a named class and receive a unique join code
- **FR44:** A student can join a class by entering a valid join code
- **FR45:** A teacher can view their class roster with each student's portfolio return, XP, modules completed, and trading activity
- **FR46:** A teacher can create a time-bounded challenge with defined participation rules
- **FR47:** A student can view active challenges, join a challenge, and track their standing within it
- **FR48:** A teacher can export a class progress report as a downloadable file
- **FR49:** A parent or guardian with read-only access can view a linked student's activity summary

### AI Coach

- **FR50:** A Pro subscriber can send messages to an AI coach in a persistent conversation interface
- **FR51:** The AI coach streams responses to the student in real time as they are generated
- **FR52:** The AI coach has read access to the student's current portfolio holdings, cost basis, return history, and completed learning modules
- **FR53:** The AI coach provides only educational responses and declines to make specific buy or sell recommendations
- **FR54:** A Pro subscriber can request an AI-generated portfolio review summarising diversification, risk exposure, and learning suggestions
- **FR55:** A student can view their full AI conversation history

### Subscriptions & Billing

- **FR56:** A student can view the features included in the Pro subscription tier
- **FR57:** A student can initiate a Pro subscription purchase via an integrated payment flow
- **FR58:** A student's Pro features activate immediately upon successful subscription payment
- **FR59:** A Pro subscriber can manage or cancel their subscription via a self-serve portal
- **FR60:** The system updates a student's Pro status in real time in response to subscription lifecycle events

### Compliance & Privacy

- **FR61:** The system provides a Data Processing Agreement available for school administrators to review and accept
- **FR62:** An authenticated user can request export of all their personal data
- **FR63:** An authenticated user can request permanent deletion of their account and all associated data
- **FR64:** The system collects no third-party advertising or tracking data from any user
- **FR65:** All AI coach interactions display a visible disclaimer that responses are educational and not investment advice

## Non-Functional Requirements

### Performance

- **NFR-P1:** All non-market-data API endpoints must respond at p95 ≤ 200ms under normal load
- **NFR-P2:** Market quote endpoints must respond at p95 ≤ 500ms on cache hit and ≤ 2,000ms on cache miss
- **NFR-P3:** The AI coach must deliver the first streamed token within 1,000ms of request submission
- **NFR-P4:** The web application must achieve First Contentful Paint ≤ 1,500ms and Largest Contentful Paint ≤ 2,500ms on a simulated 4G mobile connection
- **NFR-P5:** The initial JavaScript bundle must not exceed 200KB gzipped
- **NFR-P6:** Portfolio and leaderboard pages must be interactive within 3,500ms Time to Interactive on mid-range mobile devices
- **NFR-P7:** Chart components must render within 300ms of data availability on any supported device

### Security

- **NFR-S1:** All data in transit must be encrypted using TLS 1.2 or higher; HTTP connections must redirect to HTTPS
- **NFR-S2:** All data at rest in PostgreSQL must be encrypted at the storage layer
- **NFR-S3:** User passwords must be hashed using bcrypt with a minimum work factor of 12
- **NFR-S4:** JWT access tokens must expire after 15 minutes; refresh tokens must be rotated on every use and invalidated immediately on logout
- **NFR-S5:** The API must enforce rate limiting of 100 requests/minute globally and 20 requests/minute on market data endpoints per authenticated user
- **NFR-S6:** No personally identifiable information may appear in application logs; user IDs only
- **NFR-S7:** The StockPlay backend must never receive, store, or log raw payment card numbers (PCI-DSS SAQ-A compliance via Stripe)
- **NFR-S8:** The AI coach must never transmit student PII to the Anthropic API; all prompts must reference students by portfolio ID only
- **NFR-S9:** All HTTP responses must include security headers: HSTS, X-Content-Type-Options, X-Frame-Options, and Content-Security-Policy
- **NFR-S10:** Student session tokens must be invalidated across all devices upon password change or account deletion

### Scalability

- **NFR-SC1:** The system architecture must support scaling to 10,000 monthly active users without architectural changes
- **NFR-SC2:** The Redis leaderboard must support global ranking queries in O(log N) time regardless of total user count
- **NFR-SC3:** The market data cache must maintain ≥ 90% hit rate under normal operating conditions
- **NFR-SC4:** Database connection pooling must handle burst traffic without exhaustion (maximum 20 pooled connections per API instance)
- **NFR-SC5:** The system must handle at least 500 concurrent active users without p95 API response time exceeding 500ms
- **NFR-SC6:** Background cron jobs must not degrade API response times during execution

### Reliability

- **NFR-R1:** The API must maintain 99.5% uptime measured monthly (≤ 3.6 hours downtime/month)
- **NFR-R2:** A market data API outage must not cause any trade order to be placed, modified, or cancelled without explicit user action
- **NFR-R3:** A failed trade order must leave the student's cash balance and holdings in a consistent pre-order state (all-or-nothing DB transaction)
- **NFR-R4:** The system must complete a full database backup daily with point-in-time recovery capability of ≤ 1 hour
- **NFR-R5:** AI coach SSE stream failures must present a recoverable error state without loss of conversation history
- **NFR-R6:** Redis unavailability must degrade gracefully to database fallback for leaderboard reads without causing errors on core trading or learning endpoints

### Accessibility

- **NFR-A1:** All user-facing pages must conform to WCAG 2.1 Level AA
- **NFR-A2:** All colour combinations for text and interactive elements must meet contrast ratios of ≥ 4.5:1 for normal text and ≥ 3:1 for large text
- **NFR-A3:** All charts and data visualisations must provide an equivalent accessible data table or text summary for screen reader users
- **NFR-A4:** All interactive elements must be fully operable via keyboard navigation with visible focus indicators
- **NFR-A5:** All images and icons must have descriptive alt text or ARIA labels
- **NFR-A6:** Touch targets must be a minimum of 44×44 pixels on mobile interfaces

### Integration

- **NFR-I1:** Alpaca Markets integration must implement exponential backoff on rate limit responses and surface a user-friendly error after 3 failed retries
- **NFR-I2:** CoinGecko API responses must be cached at a minimum 60-second TTL
- **NFR-I3:** NewsAPI responses must be cached at a minimum 5-minute TTL; stale cache must be served if upstream is unavailable
- **NFR-I4:** Stripe webhook events must be verified using the Stripe-Signature header before processing; invalid signatures must be rejected with HTTP 400
- **NFR-I5:** Google OAuth integration must support Google Workspace for Education domain restriction
- **NFR-I6:** All third-party API credentials must be stored as environment variables and must never be committed to source control or included in client-side bundles

## UI/UX Design — Screen Inventory

High-fidelity mobile screens have been produced in **Google Stitch** (Project: "Onboarding", ID: `914389739818317223`). The design system uses the **Editorial Intelligence** theme — dark mode (`#121416` base), Plus Jakarta Sans / Manrope typography, and a "no-border / tonal layering" philosophy.

The following 10 screens are the current approved design artefacts. Each maps to a functional area defined in the Functional Requirements section above.

| # | Screen Title | Stitch Screen ID | Functional Area |
|---|---|---|---|
| 1 | Onboarding | `dd985b490d1945d7a7ada7affd274e27` | User Account Management — registration & onboarding flow |
| 2 | Onboarding | `1f5cf6bf1ea64e66bd4a188907be4e11` | User Account Management — onboarding (variant) |
| 3 | Dashboard & Path | `7ddf77f0a42e428d92816910655a8eed` | Paper Trading & Portfolio — main dashboard |
| 4 | Dashboard & Path | `e546d615793e4e4c8f9ec5860d5b0fc3` | Paper Trading & Portfolio — dashboard (variant) |
| 5 | Portfolio Simulator | `e6766204fad345b0a644b369e5e3b351` | Paper Trading & Portfolio — simulator view |
| 6 | Portfolio Simulator | `643a245c71904bfca0b37f3a4397aa43` | Paper Trading & Portfolio — simulator (variant) |
| 7 | Lesson Content | `00063f20d1094f5bb9677155aed56184` | Learning & Education — lesson detail |
| 8 | Lesson Content | `5c1ab2d859e2428c903328f3b2b5234d` | Learning & Education — lesson detail (variant) |
| 9 | Quiz & Assessment | `e87586b8a86840d9b30da152f76a0c0b` | Learning & Education — quiz/assessment |
| 10 | Quiz & Assessment | `84cc412710154ea9b80a41ce0ce049ed` | Learning & Education — quiz/assessment (variant) |

### Design Notes

- Current screens are **mobile** (390px wide) — Phase 1 mobile designs are complete
- **Desktop screens (2560px reference) are complete** — 4 screens available in Google Stitch. Desktop layout uses a left sidebar navigation pattern; implementation targets 1280–1440px.
- Duplicate screen titles (e.g., two "Onboarding" screens) represent design variants — the PM/designer must select one canonical variant per screen before development begins
- Screens are accessible via the Google Stitch MCP (`stitch.googleapis.com`) using project ID `914389739818317223`
- The **Brand Assets** screen and all **StockPlay**-branded variants have been removed from the active design set

### Desktop Screen Inventory ✅

4 desktop screens at 2560px (updated 2026-03-29), covering core functional areas. All accessible via Stitch project `914389739818317223`.

| # | Title | Stitch Screen ID | Functional Area |
|---|---|---|---|
| 1 | StockPlay Onboarding - Desktop | `7db7eb8490a943e99ec07c36c2c44e9c` | User Account Management |
| 2 | StockPlay Dashboard - Desktop | `5ca7025a8d20489b96403837b8bb70a2` | Paper Trading & Portfolio |
| 3 | StockPlay Portfolio - Desktop | `b78b73cd883142aca1a4ff9ac6b11aab` | Paper Trading & Portfolio — simulator |
| 4 | StockPlay Lesson - Desktop | `a0225fbfa9264361bac691768188f9f4` | Learning & Education |

> **Brand confirmed: StockPlay** — All screens, copy, and UI components must use "StockPlay" as the product name.
