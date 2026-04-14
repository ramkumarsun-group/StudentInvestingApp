---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories]
structureType: steel-thread
inputDocuments: [docs/prd.md]
threads: 4
totalStories: 47
---

# StockPlay — Steel Thread Story Map

## Overview

Stories are organised as **4 vertical steel threads**, each delivering a fully working end-to-end slice through DB → API → UI. Every thread ends with a shippable demo milestone. Stories within each thread are sequenced so each one can be implemented independently based only on the stories before it.

**Thread philosophy:** Ship a thin, working slice of the full product before adding breadth. Each thread proves a core user loop works end-to-end before the next thread begins.

---

## Requirements Inventory

### Functional Requirements

FR1: A visitor can register for a student account using email/password or Google OAuth
FR2: A visitor can register for a teacher account with role selection during signup
FR3: A registered user can log in using email/password or Google OAuth
FR4: An authenticated user can view and update their profile information
FR5: An authenticated user can log out and invalidate their session
FR6: The system enforces a minimum registration age of 13 with date-of-birth verification
FR7: A student account flagged as under-18 has parental visibility features available
FR8: An authenticated user can request permanent account deletion with full data removal within 30 days
FR9: A student can search for stocks, ETFs, and cryptocurrencies by name or ticker symbol
FR10: A student can view a real-time price quote and price chart for any supported asset
FR11: A student can place a market buy order for any supported asset using their virtual cash balance
FR12: A student can place a market sell order for any asset they currently hold
FR13: A student can view their complete portfolio including cash balance, holdings, total value, and overall P&L
FR14: A student can view each holding's quantity, average cost, current value, and unrealised P&L
FR15: A student can view their full order history
FR16: A student can view their portfolio value history over time as a chart
FR17: A student can view their portfolio asset allocation by asset class and individual holding
FR18: A student can reset their portfolio to the starting $100,000 virtual cash balance
FR19: The system prevents a student from placing an order that would exceed their available cash balance
FR20: The system provides live price quotes for US stocks and ETFs via Alpaca Markets
FR21: The system provides live price quotes for major cryptocurrencies via CoinGecko
FR22: The system provides OHLCV price history charts across multiple timeframes (1D, 1W, 1M, 3M, 1Y)
FR23: The system surfaces relevant market news headlines in context with portfolio holdings
FR24: The system displays a trending assets section showing top movers
FR25: The system handles market data API failures gracefully without placing or modifying orders
FR26: A student can browse all available learning modules with difficulty level, estimated time, and XP reward
FR27: A student can work through a module's lessons sequentially with each lesson unlocking on completion of the prior
FR28: A student can view lesson content including text, callout blocks, and key term definitions
FR29: A student can submit answers to a quiz at the end of a lesson and receive a score with explanations
FR30: A student can track their learning progress across all modules showing completion percentage
FR31: The system awards XP to a student upon completing a lesson and upon passing a quiz
FR32: A Pro subscriber can access advanced learning modules not available on the free tier
FR33: The system deep-links from a portfolio holding or market event directly to a relevant learning module
FR34: A student earns XP for completing defined activities including trading, learning, streaks, and referrals
FR35: A student progresses through 10 named levels as their cumulative XP increases with level-up notifications
FR36: A student can view all available badges, their unlock criteria, and their current unlock status
FR37: The system automatically evaluates and awards badges when a student meets badge criteria
FR38: A student maintains a daily activity streak that increments on consecutive days of activity and resets on missed days
FR39: A student can view a global leaderboard ranked by portfolio return percentage
FR40: A student can view a class leaderboard scoped to their enrolled class
FR41: A student can share an earned badge as a styled image card to external social platforms
FR42: The system sends in-app notifications for badge unlocks, level-ups, leaderboard rank changes, and streak milestones
FR43: A teacher can create a named class and receive a unique join code
FR44: A student can join a class by entering a valid join code
FR45: A teacher can view their class roster with each student's portfolio return, XP, modules completed, and trading activity
FR46: A teacher can create a time-bounded challenge with defined asset restrictions and scoring rules
FR47: A student can view active challenges, join them, and see their real-time standing
FR48: A teacher can export a class progress report as a downloadable CSV
FR49: A parent or guardian can view a read-only summary of a linked minor student's activity
FR50: A Pro subscriber can send messages to an AI coach in a persistent chat interface
FR51: The AI coach streams responses token-by-token via SSE
FR52: The AI coach has read access to the student's current portfolio holdings and cost basis
FR53: The AI coach provides educational guidance only and does not make specific investment recommendations
FR54: A student can request an AI-generated portfolio review covering diversification and performance
FR55: A student can view their full AI conversation history across sessions
FR56: A student can view a clear comparison of Free vs Pro tier features
FR57: A student can subscribe to Pro tier via Stripe checkout for $4.99/month
FR58: Pro features unlock immediately upon successful Stripe payment confirmation
FR59: A Pro subscriber can manage or cancel their subscription via the Stripe customer portal
FR60: The system syncs Pro subscription status in real time via Stripe webhooks
FR61: The platform provides a FERPA-compliant Data Processing Agreement for school sign-up
FR62: An authenticated user can request a full export of all their personal data
FR63: Account deletion permanently purges all PII and associated data within 30 days
FR64: The platform uses no third-party advertising or tracking SDKs that process student PII
FR65: The AI coach interface displays a persistent educational disclaimer

### Non-Functional Requirements

NFR1: API p95 response time < 200ms for all non-market-data endpoints
NFR2: Market quote cache hit rate ≥ 90% (Redis, 30s TTL)
NFR3: Zero PII in third-party analytics or ad trackers (FERPA)
NFR4: AI coach first token latency < 1,000ms
NFR5: 99.5% API uptime SLA
NFR6: Mobile-first responsive design — all core flows usable on a 375px viewport
NFR7: Google Workspace SSO available before first school onboards
NFR8: Stripe webhook signature verification on all billing events

### Additional Requirements

AR1: Native iOS app (React Native / Expo) — Phase 4
AR2: Native Android app (React Native / Expo) — Phase 4
AR3: School district licensing tier — Phase 4
AR4: Parent gifting flow for Pro subscription — Phase 4
AR5: Experience-tiered leaderboards (beginner vs advanced cohorts) — Phase 2
AR6: Push notifications via APNs (iOS) and FCM (Android) — Phase 4
AR7: Deep linking: stockplay://trade/AAPL, stockplay://learn/stocks — Phase 4

---

## Thread Overview

| Thread | Name | Phase | Stories | Demo Milestone |
|--------|------|-------|---------|----------------|
| 🧵 T1 | Core Trading Loop | 1 | 17 | Student registers, searches AAPL, buys, sees live P&L — responsive on mobile + desktop |
| 🧵 T2 | Learning & Gamification Loop | 1 | 13 | Student completes lesson, passes quiz, levels up, earns badge |
| 🧵 T3 | School & Classroom Loop | 2 | 10 | Teacher creates class, students join challenge, report exported |
| 🧵 T4 | Monetisation & AI Loop | 3 | 7 | Student upgrades, AI coach streams portfolio-aware response |
| | **Total** | | **47** | |

---

## 🧵 Thread 1: Core Trading Loop

**Goal:** A student can register, find any stock/ETF/crypto, execute trades, and see their live portfolio — the foundational loop that every other thread builds on.

**Phase:** 1 (Months 1–3)
**Demo milestone:** A real user registers in < 90 seconds, searches for Tesla, buys 10 shares, watches the value move in real time, and sees their P&L on the portfolio dashboard.

---

### Story T1.1: Student Registration with Email and Password

As a prospective student,
I want to register for a StockPlay account using my email and password,
So that I can access the platform and start learning to invest.

**FRs:** FR1, FR6, FR19
**Layers:** PostgreSQL (users, portfolios tables) · Express auth API · Next.js register page

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I submit a valid email, password (min 8 chars), display name, and date of birth showing I am 13 or older
**Then** my account is created, a portfolio with $100,000 virtual cash is initialised, and I am redirected to the dashboard

**Given** I submit a date of birth showing I am under 13
**When** I attempt to register
**Then** registration is blocked with a message; no account is created

**Given** I submit an email already registered
**When** I attempt to register
**Then** I receive an error indicating the email is in use

**Given** I submit a password shorter than 8 characters
**When** I attempt to register
**Then** I receive a validation error before form submission

---

### Story T1.2: Google OAuth Registration and Login

As a prospective student or teacher,
I want to register and log in using my Google account,
So that I can access the platform without creating a separate password.

**FRs:** FR1, FR3
**Layers:** NextAuth Google provider · Express JWT · PostgreSQL users table

**Acceptance Criteria:**

**Given** I click "Continue with Google" on the registration or login page
**When** I complete Google OAuth and grant consent
**Then** my account is created (or signed into if existing), defaulting to student role, and I am redirected to the dashboard

**Given** my Google account email already exists from a prior email/password registration
**When** I attempt Google OAuth with that email
**Then** the accounts are linked and I am signed in successfully

**Given** I close the Google OAuth popup before completing consent
**When** I return to the app
**Then** no account is created and I remain on the registration page

---

### Story T1.3: Secure Session Management and Logout

As an authenticated user,
I want my session to be secure with automatic token refresh and a reliable logout,
So that my account cannot be accessed by others on shared devices.

**FRs:** FR3, FR5
**Layers:** Redis (refresh tokens) · Express auth middleware · NextAuth session

**Acceptance Criteria:**

**Given** I click "Sign out" from the user menu
**When** the logout request is processed
**Then** my refresh token is invalidated in Redis and I am redirected to the login page

**Given** my access token expires (15-minute TTL)
**When** I make an API request
**Then** the client silently refreshes using the refresh token without interrupting my session

**Given** a previously-used refresh token is replayed
**When** the second request arrives
**Then** it is rejected with 401 and I am redirected to login

---

### Story T1.4: Age Verification and Under-18 Account Flagging

As the system,
I want to verify user age at registration and flag minor accounts,
So that COPPA compliance is maintained and parental visibility can be enabled.

**FRs:** FR6, FR7
**Layers:** PostgreSQL (is_minor flag) · Express registration endpoint

**Acceptance Criteria:**

**Given** a user registers with a DOB indicating they are under 13
**When** the form is submitted
**Then** registration is hard-blocked; no account is created

**Given** a user registers with a DOB indicating they are 13–17
**When** registration succeeds
**Then** the account is flagged `is_minor: true`

**Given** a user registers with a DOB indicating 18 or older
**When** registration succeeds
**Then** no minor flag is set and standard privacy settings apply

---

### Story T1.5: FERPA Compliance — DPA and No Third-Party Trackers

As a school administrator,
I want to confirm FERPA compliance before enrolling students,
So that I can meet our school's data governance requirements.

**FRs:** FR61, FR64
**Layers:** Static legal page · Analytics configuration · CSP headers

**Acceptance Criteria:**

**Given** I am on the school sign-up or teacher registration page
**When** I look for legal documentation
**Then** a link to the current Data Processing Agreement is visible before I submit any form

**Given** any page in the application loads
**When** the browser network activity is inspected
**Then** no requests are made to Google Analytics, Meta Pixel, or any third-party advertising domain

**Given** the application sends analytics events
**When** those events are processed
**Then** they go to a first-party endpoint only, with no PII included

---

### Story T1.6: Asset Search

As a student,
I want to search for stocks, ETFs, and cryptocurrencies by name or ticker,
So that I can find assets I want to trade.

**FRs:** FR9, FR20, FR21
**Layers:** Alpaca search API · CoinGecko search · Redis cache · Express market routes · Next.js search UI

**Acceptance Criteria:**

**Given** I type a ticker or name (minimum 2 characters) in the search bar
**When** the search executes
**Then** results appear within 500ms showing name, ticker, asset type (stock/ETF/crypto), and current price

**Given** I search for a known stock ticker (e.g. "AAPL")
**When** results appear
**Then** the exact ticker match appears at the top

**Given** I search for a cryptocurrency (e.g. "bitcoin")
**When** results appear
**Then** crypto results are clearly labelled "Crypto"

**Given** no results match my query
**When** results would appear
**Then** a "No results found" message is shown

---

### Story T1.7: Live Quote and Price Chart

As a student,
I want to view the live price and historical chart for any asset,
So that I can make an informed decision before placing a trade.

**FRs:** FR10, FR22
**Layers:** Alpaca bars API · CoinGecko OHLCV · Redis (30s TTL) · Express market routes · Recharts

**Acceptance Criteria:**

**Given** I select an asset from search results
**When** the asset detail page loads
**Then** I see current price, day change ($ and %), last updated timestamp, and a default 1D OHLCV chart

**Given** I select a different timeframe (1D, 1W, 1M, 3M, 1Y)
**When** I click the timeframe button
**Then** the chart updates within 500ms

**Given** the market data API is unavailable
**When** I view an asset
**Then** the last cached price is shown with a "Prices delayed" indicator; no error page is shown

---

### Story T1.8: Market Data Caching and API Failure Resilience

As the system,
I want to cache all market quotes and handle upstream API failures gracefully,
So that students experience fast load times and no order is ever placed on unavailable data.

**FRs:** FR25
**NFRs:** NFR2
**Layers:** Redis · ioredis · Alpaca/CoinGecko error handling · Express middleware

**Acceptance Criteria:**

**Given** a market quote is requested and a cached quote < 30s old exists
**When** the request is processed
**Then** the cached quote is returned without an upstream API call

**Given** the upstream API returns HTTP 429
**When** the system retries
**Then** exponential backoff is applied for up to 3 retries before surfacing a user-friendly error

**Given** a student attempts to trade and the market data API is unavailable
**When** the order is submitted
**Then** the order is rejected with a clear message; cash balance and holdings are unchanged

---

### Story T1.9: Buy Order Execution

As a student,
I want to place a market buy order for any supported asset,
So that I can invest my virtual cash and build my portfolio.

**FRs:** FR11, FR19
**Layers:** PostgreSQL (orders, holdings, portfolios — DB transaction) · Express trade routes · Next.js trade UI

**Acceptance Criteria:**

**Given** I have sufficient cash and enter a valid quantity on the asset detail page
**When** I review the estimated total (price ± 0.1% spread) and confirm the buy
**Then** the order executes at the simulated price, my cash decreases, and my holding is created or updated with weighted average cost basis

**Given** my order total would exceed my available cash
**When** I submit
**Then** the order is rejected before execution with a clear error showing my available balance

**Given** the market data API fails during order submission
**When** the order would execute
**Then** the order is not placed, cash is unchanged, and I see a clear error message

---

### Story T1.10: Sell Order Execution

As a student,
I want to sell assets I currently hold,
So that I can realise gains, cut losses, and rebalance my portfolio.

**FRs:** FR12
**Layers:** PostgreSQL (orders, holdings — DB transaction) · Express trade routes · Next.js trade UI

**Acceptance Criteria:**

**Given** I hold a position and select "Sell" with a valid quantity
**When** I confirm the sell
**Then** the order executes at market price ± 0.1% spread, my holding quantity decreases (or position closes), and cash increases

**Given** I attempt to sell more shares than I hold
**When** I submit
**Then** the order is rejected with an error showing my current holding quantity

**Given** I sell my entire position
**When** the order executes
**Then** the holding is removed from my portfolio

---

### Story T1.11: Portfolio Dashboard

As a student,
I want to view a summary of my entire portfolio,
So that I can quickly assess my overall performance.

**FRs:** FR13, FR14
**NFRs:** NFR6
**Layers:** PostgreSQL (portfolios, holdings) · Express portfolio routes · Recharts mini chart · Next.js dashboard

**Acceptance Criteria:**

**Given** I navigate to the portfolio page
**When** the page loads
**Then** I see total portfolio value, cash balance, total invested, total P&L ($ and %), and a mini chart of value over 30 days

**Given** live price updates are available
**When** I view the portfolio
**Then** total value reflects current market prices refreshed every 30 seconds

**Given** I have no holdings
**When** I view the portfolio
**Then** I see my $100,000 cash balance, $0 P&L, and an empty state prompting me to make my first trade

---

### Story T1.12: Holdings Detail and Order History

As a student,
I want to see each holding's performance and my full trade history,
So that I can review my decisions and track each position.

**FRs:** FR14, FR15
**Layers:** PostgreSQL (holdings, orders) · Express portfolio/trade routes · Next.js holdings table

**Acceptance Criteria:**

**Given** I have one or more holdings
**When** I view the holdings list
**Then** each holding shows ticker, quantity, average cost, current price, current value, unrealised P&L ($ and %)

**Given** I navigate to order history
**When** the page loads
**Then** all past orders appear in reverse chronological order with asset, side, quantity, execution price, and timestamp

**Given** I have no order history
**When** I view the page
**Then** an empty state encourages me to place my first trade

---

### Story T1.13: Portfolio History Chart and Asset Allocation

As a student,
I want to see my portfolio value over time and how it is allocated,
So that I understand my performance trend and diversification.

**FRs:** FR16, FR17
**Layers:** PostgreSQL (portfolio_history) · Express portfolio routes · Recharts AreaChart + PieChart

**Acceptance Criteria:**

**Given** I have placed at least one trade
**When** I view the portfolio history chart
**Then** I see a line chart of total portfolio value over time with selectable timeframes (1W, 1M, 3M, All)

**Given** I view the asset allocation section with multiple holdings
**When** the chart loads
**Then** a pie/donut chart shows each holding and cash as a percentage of total portfolio

---

### Story T1.14: Portfolio Reset and Market News

As a student,
I want to reset my portfolio and see relevant market news,
So that I can start fresh and discover what is moving assets I hold.

**FRs:** FR18, FR23, FR24
**Layers:** PostgreSQL (reset transaction) · NewsAPI · Redis (5min news cache) · Express routes · Next.js UI

**Acceptance Criteria:**

**Given** I initiate a portfolio reset and confirm in the dialog
**When** the reset executes
**Then** all holdings are removed, cash returns to $100,000, portfolio history resets, and my leaderboard return recalculates to 0%

**Given** I dismiss the confirmation dialog
**When** I do not confirm
**Then** no changes are made

**Given** I view an asset detail page with news available
**When** the news section loads
**Then** up to 5 recent headlines are shown with source, title, and published time; if NewsAPI is down, cached headlines or a hidden section is shown gracefully

---

### Story T1.15: Responsive AppShell Layout

As a student,
I want the app navigation to adapt between mobile and desktop,
So that I get a bottom tab bar on my phone and a left sidebar on my computer.

**FRs:** NFR6 (mobile-first responsive design)
**Layers:** Next.js layout components · Tailwind responsive classes · AppShell / Sidebar / BottomNav components
**Stitch refs:** Dashboard - Desktop `5ca7025a...`, Dashboard & Path mobile `e546d615...`

**Acceptance Criteria:**

**Given** I am on any authenticated page on a viewport < 1024px
**When** the page renders
**Then** I see a fixed bottom tab bar (Dashboard, Trade, Learn, Leaderboard, Profile) and no sidebar

**Given** I am on any authenticated page on a viewport ≥ 1024px
**When** the page renders
**Then** I see a fixed left sidebar (220px) with nav links and no bottom tab bar

**Given** I resize across the 1024px breakpoint
**When** the transition occurs
**Then** layout switches with no flicker, hydration mismatch, or JS errors

---

### Story T1.16: Desktop Onboarding Layout

As a prospective student on a desktop,
I want the registration and login pages to use a two-column desktop layout,
So that the onboarding experience feels native to a larger screen.

**FRs:** FR1, FR3
**Layers:** Next.js `(auth)` layout · `AuthHeroPanel` component · Tailwind responsive grid
**Stitch refs:** StockPlay Onboarding - Desktop `7db7eb84...`

**Acceptance Criteria:**

**Given** I visit `/register` or `/login` on a viewport ≥ 1024px
**When** the page renders
**Then** I see a two-column layout: branded hero panel left, auth form right

**Given** I visit either page on a viewport < 1024px
**When** the page renders
**Then** the existing single-column mobile layout is unchanged

---

### Story T1.17: Desktop Dashboard & Portfolio Layout

As a student on a desktop,
I want the Dashboard, Portfolio, and Trade pages to use a multi-column layout,
So that I can see more information at once without scrolling.

**FRs:** FR13, FR14, FR16, FR17, FR23, FR24
**Layers:** Next.js page components · Tailwind responsive grid · existing data components (no new APIs)
**Stitch refs:** StockPlay Dashboard - Desktop `5ca7025a...`, StockPlay Portfolio - Desktop `b78b73cd...`

**Acceptance Criteria:**

**Given** I am on `/dashboard` on a viewport ≥ 1024px
**When** the page renders
**Then** portfolio summary + chart appear left/centre; trending assets + news appear in a right sidebar column

**Given** I am on `/portfolio` on a viewport ≥ 1024px
**When** the page renders
**Then** summary stats + history chart appear left; holdings list + allocation chart appear right

**Given** I am on either page on a viewport < 1024px
**When** the page renders
**Then** existing single-column mobile layouts are unchanged — no regression

---

## 🧵 Thread 2: Learning & Gamification Loop

**Goal:** A student can discover modules, complete lessons, pass quizzes, earn XP, level up, unlock badges, and maintain a streak — the retention engine that keeps students returning daily.

**Phase:** 1 (Months 1–3, parallel with Thread 1 from Week 3)
**Demo milestone:** A student opens the Learn page, completes "What is a Stock?", passes the quiz, sees "+100 XP", levels up from Rookie to Novice, and unlocks the "First Lesson" badge — all within one session.

---

### Story T2.1: Module Browser

As a student,
I want to browse all available learning modules,
So that I can choose what to learn based on difficulty and reward.

**FRs:** FR26, FR32
**Layers:** PostgreSQL (modules table) · Express learn routes · Next.js modules grid

**Acceptance Criteria:**

**Given** I navigate to the Learn page
**When** the page loads
**Then** I see all modules each showing title, difficulty badge, estimated time, XP reward, and completion progress percentage

**Given** I am on the free tier and a module is Pro-gated
**When** I view that module
**Then** it shows a lock icon and "Pro" badge; clicking it shows the Pro upgrade paywall

**Given** I have completed some lessons within a module
**When** I view that module card
**Then** a progress bar shows the correct completion percentage

---

### Story T2.2: Sequential Lesson Navigation

As a student,
I want to work through lessons in a module sequentially,
So that each lesson builds on the previous progressively.

**FRs:** FR27
**Layers:** PostgreSQL (lessons, lesson_progress) · Express learn routes · Next.js lesson list

**Acceptance Criteria:**

**Given** I open a module
**When** the page loads
**Then** all lessons are listed with titles, estimated time, and status (locked/available/complete)

**Given** I have not started a module
**When** I view its lesson list
**Then** only the first lesson is unlocked; all subsequent lessons are locked

**Given** I complete a lesson
**When** completion is recorded
**Then** the next lesson unlocks immediately

---

### Story T2.3: Lesson Content Renderer

As a student,
I want to read lesson content with clear visual formatting,
So that I can learn investing concepts through well-structured material.

**FRs:** FR28
**Layers:** PostgreSQL (lesson JSONB content blocks) · Express lesson route · Next.js content renderer

**Acceptance Criteria:**

**Given** I open a lesson
**When** the content loads
**Then** text, callout (tip/warning/info), and key term blocks each render with distinct visual styling

**Given** a lesson contains a key term
**When** I view it
**Then** the term is highlighted and its definition is shown inline or on tap/hover

**Given** I reach the end of a lesson
**When** I click "Complete Lesson"
**Then** completion is recorded, XP is awarded, and I am taken to the quiz or next lesson

---

### Story T2.4: Quiz Submission and Scoring

As a student,
I want to test my understanding at the end of a lesson,
So that I can confirm I've learned the material and earn XP for passing.

**FRs:** FR29
**Layers:** PostgreSQL (quizzes, quiz_attempts) · Express quiz routes · Next.js quiz UI

**Acceptance Criteria:**

**Given** I reach the quiz at the end of a lesson
**When** the quiz loads
**Then** multiple-choice questions appear with answer options; correct answers are hidden until I submit

**Given** I submit my answers
**When** the quiz is scored
**Then** I see my score (e.g. "3/4 correct"), each question shows the correct answer, and explanations are shown

**Given** I pass (score ≥ 70%)
**When** results appear
**Then** XP is awarded, a success animation plays, and I can proceed to the next lesson

**Given** I fail
**When** results appear
**Then** I can retry; no XP is awarded until I pass

---

### Story T2.5: XP Award System

As a student,
I want to earn XP for every meaningful activity,
So that my efforts are recognised and I feel rewarded.

**FRs:** FR31, FR34
**NFRs:** NFR1
**Layers:** PostgreSQL (xp_events immutable audit log) · Express XP service · Next.js toast notification

**Acceptance Criteria:**

**Given** I complete any XP-awarding activity (trade, lesson, quiz pass, streak)
**When** the activity is recorded
**Then** an immutable XP event row is created with activity type, amount, and timestamp

**Given** XP is awarded
**When** my total updates
**Then** a "+X XP" toast appears within 1 second and my XP total in the nav bar updates

**Given** daily trade XP caps are in effect
**When** I trade more than the daily cap allows
**Then** additional trades do not award further XP for that day; learning and streak XP are uncapped

---

### Story T2.6: Level Progression and Level-Up Notifications

As a student,
I want to advance through 10 named levels as I accumulate XP,
So that I have a clear long-term progression arc.

**FRs:** FR35
**Layers:** PostgreSQL (users.level, levels table) · Express XP service (level detection) · Next.js level-up modal

**Acceptance Criteria:**

**Given** my cumulative XP crosses the next level threshold
**When** the level-up is detected after any XP award
**Then** a level-up modal shows my new level name and badge art and the achievement is recorded

**Given** I view my dashboard or profile
**When** the page loads
**Then** I see my current level name, XP progress bar (earned vs needed for next level), and total XP

**Given** I reach Level 10
**When** further XP is awarded
**Then** XP accumulates but no further level-up notifications fire

---

### Story T2.7: Badge Catalog and Display

As a student,
I want to see all available badges and track which I have earned,
So that I have clear goals to work toward.

**FRs:** FR36
**Layers:** PostgreSQL (badges, user_badges) · Express gamification routes · Next.js badges page

**Acceptance Criteria:**

**Given** I navigate to the Badges page
**When** the page loads
**Then** all badges are shown organised by category; earned badges appear in full colour, locked badges are greyed out with unlock criteria

**Given** a badge has a rarity level (common/rare/epic/legendary)
**When** I view it
**Then** distinct visual styling (colour, border, glow) reflects its rarity

---

### Story T2.8: Automatic Badge Award Engine

As the system,
I want to automatically evaluate and award badges when a student meets the criteria,
So that achievements feel instantaneous and rewarding.

**FRs:** FR37
**Layers:** PostgreSQL (badge criteria, user_badges) · Express badge service · triggered after every XP award

**Acceptance Criteria:**

**Given** I meet the criteria for a badge (e.g. complete 3 trades)
**When** the badge check runs after XP is awarded
**Then** the badge is automatically unlocked, recorded, and an in-app notification is triggered

**Given** I have already unlocked a badge
**When** the badge check runs again
**Then** the badge is not awarded a second time

**Given** multiple badge criteria are met simultaneously
**When** the badge check runs
**Then** all qualifying badges are awarded in a single check pass

---

### Story T2.9: Daily Streak Tracking

As a student,
I want to maintain a daily activity streak,
So that I build a consistent habit of engaging with the platform.

**FRs:** FR38
**Layers:** PostgreSQL (streaks table) · node-cron (midnight reset) · Express streak service · Next.js streak flame UI

**Acceptance Criteria:**

**Given** I complete any qualifying activity today (trade, lesson, quiz)
**When** the activity is recorded
**Then** if I also had activity yesterday, my streak increments by 1; if not, streak resets to 1

**Given** I have no activity for more than 24 hours since my last active day
**When** the midnight cron job runs
**Then** my streak resets to 0

**Given** my streak is 3 or more days
**When** I view the dashboard
**Then** a flame icon with my streak count is displayed prominently

---

### Story T2.10: Global Leaderboard

As a student,
I want to see how my portfolio return ranks against all students globally,
So that I stay motivated through competition.

**FRs:** FR39
**NFRs:** NFR1
**Layers:** Redis sorted set (ZADD/ZREVRANGE) · PostgreSQL fallback · node-cron (5-min refresh) · Express leaderboard routes · Next.js leaderboard page

**Acceptance Criteria:**

**Given** I navigate to the Leaderboard page
**When** the page loads
**Then** I see students ranked by portfolio return %; top 3 have medal icons; my rank is shown even if outside top 10

**Given** the leaderboard is read from Redis
**When** the Redis sorted set is available
**Then** data is served from the sorted set; if Redis is unavailable, the DB fallback is used transparently

**Given** the leaderboard cron refresh runs every 5 minutes
**When** new portfolio values are available
**Then** the sorted set is updated with current return percentages

---

### Story T2.11: Learning Progress Tracking

As a student,
I want to see my overall learning progress across all modules,
So that I can see how far I've come and what remains.

**FRs:** FR30
**Layers:** PostgreSQL (lesson_progress) · Express progress routes · Next.js progress bars

**Acceptance Criteria:**

**Given** I have completed some lessons
**When** I view the Learn page
**Then** each module card shows my completion percentage and count (e.g. "3/5 lessons complete")

**Given** I complete the final lesson in a module
**When** completion is recorded
**Then** the module shows 100% complete with a visual completion indicator

---

### Story T2.12: Shareable Badge Cards and In-App Notifications

As a student,
I want to share badge achievements and receive timely notifications,
So that I celebrate milestones with friends and stay engaged.

**FRs:** FR41, FR42
**Layers:** Canvas API (badge card generation) · Express notifications · Next.js notification bell

**Acceptance Criteria:**

**Given** I earn a new badge
**When** the badge is unlocked
**Then** a share button appears; clicking it generates a styled image card with my username, badge art, badge name, and StockPlay branding

**Given** the share card is generated on mobile
**When** I tap share
**Then** the native share sheet opens with the image pre-loaded

**Given** any notification-triggering event occurs (badge, level-up, streak)
**When** the event is processed
**Then** an in-app notification appears within the session; unread count shows in the notification bell

---

### Story T2.13: Portfolio-to-Lesson Deep Linking and Pro Module Gating

As a student,
I want to jump from my portfolio directly to relevant lessons and unlock advanced modules with Pro,
So that learning feels contextual and Pro has clear value.

**FRs:** FR32, FR33
**Layers:** PostgreSQL (Pro flag) · Express auth middleware · Next.js dynamic routing

**Acceptance Criteria:**

**Given** I view a holding (e.g. a tech stock)
**When** a "Learn more" contextual link appears
**Then** clicking it navigates directly to the relevant lesson within the correct module

**Given** I am a free-tier student accessing a Pro-gated module URL directly
**When** the page loads
**Then** I see the Pro paywall with a description of what I'd unlock and a clear upgrade CTA

**Given** I upgrade to Pro
**When** my subscription activates
**Then** all Pro-gated modules unlock immediately without a page refresh

---

## 🧵 Thread 3: School & Classroom Loop

**Goal:** A teacher can set up a class, enroll students, run a graded challenge, monitor progress in real time, and export a report — the institutional channel that drives school adoption.

**Phase:** 2 (Months 4–6)
**Demo milestone:** Mr. Chen creates a class in 45 seconds, 20 students join via join code, he creates a 2-week challenge, sees live rankings update as students trade, and downloads a CSV report to show his department head.

---

### Story T3.1: Teacher Registration and Dashboard

As a teacher,
I want to register with the teacher role and access a teacher-specific dashboard,
So that I can manage my classes and students.

**FRs:** FR2
**Layers:** PostgreSQL (users — role: teacher) · Express auth routes · Next.js teacher layout

**Acceptance Criteria:**

**Given** I select "I am a teacher" on the registration page and complete signup
**When** registration succeeds
**Then** my account is created with the teacher role and I see the teacher dashboard with classes and challenges navigation

**Given** I am a registered teacher and log in
**When** I access the app
**Then** I see teacher navigation (My Classes, Challenges, Reports) instead of student navigation

**Given** a teacher navigates to a student-only route (e.g. /trade)
**When** the page loads
**Then** I am redirected to the teacher dashboard

---

### Story T3.2: Class Creation and Join Code

As a teacher,
I want to create a named class and receive a join code instantly,
So that I can onboard students in under 5 minutes.

**FRs:** FR43
**Layers:** PostgreSQL (classes, join_codes tables) · Express teacher routes · Next.js create class modal

**Acceptance Criteria:**

**Given** I am on My Classes and click "Create Class"
**When** I enter a class name and submit
**Then** a class is created and a unique 6-character alphanumeric join code is displayed within 3 seconds

**Given** my class is created
**When** I view the class detail page
**Then** the join code is prominently displayed with a one-click copy button

**Given** I create multiple classes
**When** I view My Classes
**Then** each class is listed with name, join code, student count, and creation date

---

### Story T3.3: Student Class Enrollment via Join Code

As a student,
I want to join a class using my teacher's join code,
So that I can participate in class challenges and appear on the class leaderboard.

**FRs:** FR44
**Layers:** PostgreSQL (class_enrollments) · Express teacher routes · Next.js join class UI

**Acceptance Criteria:**

**Given** I have a valid join code and enter it in "Join a Class"
**When** I submit
**Then** I am enrolled, the teacher's roster updates in real time, and I can see the class leaderboard

**Given** I enter an invalid join code
**When** I submit
**Then** I receive a clear error that the code was not found

**Given** I am already enrolled in a class and enter a second join code
**When** I submit
**Then** I receive an error indicating I am already in a class (MVP: one class per student)

---

### Story T3.4: Class Roster and Progress Dashboard

As a teacher,
I want to see all my students' activity in a single view,
So that I can identify who is engaged and who needs support.

**FRs:** FR45
**Layers:** PostgreSQL (class_enrollments, portfolios, xp_events, lesson_progress) · Express teacher routes · Next.js class detail page

**Acceptance Criteria:**

**Given** I open a class detail page
**When** it loads
**Then** I see a table of enrolled students with: display name, portfolio return %, XP earned, modules completed, trades placed, and last active date

**Given** a student completes a lesson or places a trade
**When** I refresh the roster
**Then** the updated data is reflected

**Given** I have no students enrolled
**When** I view the class
**Then** an empty state shows the join code prominently with enrollment instructions

---

### Story T3.5: Class Leaderboard

As a student enrolled in a class,
I want to see how my portfolio return ranks within my class,
So that I can compete with my classmates.

**FRs:** FR40
**Layers:** PostgreSQL (class_enrollments, portfolios) · Redis (class-scoped sorted set) · Express leaderboard routes · Next.js leaderboard tabs

**Acceptance Criteria:**

**Given** I am enrolled in a class and view the Leaderboard page
**When** I select the class leaderboard tab
**Then** I see only my classmates ranked by portfolio return percentage

**Given** a classmate places a trade that changes their return
**When** the leaderboard refreshes (5-min cron)
**Then** their position updates accordingly

**Given** I am not enrolled in any class
**When** I view the leaderboard page
**Then** only the global leaderboard tab is shown

---

### Story T3.6: Class Challenge Creation

As a teacher,
I want to create a time-bounded challenge with defined rules,
So that I can motivate students through structured competition.

**FRs:** FR46
**Layers:** PostgreSQL (challenges table) · Express challenge routes · Next.js challenge creation form

**Acceptance Criteria:**

**Given** I am on a class detail page and click "Create Challenge"
**When** I enter name, description, start date, end date, and optional asset restrictions and submit
**Then** the challenge is created and becomes visible to enrolled students on or after the start date

**Given** I set a start date in the future
**When** enrolled students view Challenges before that date
**Then** the challenge shows as "Upcoming" with a countdown

**Given** the end date passes
**When** the challenge closes
**Then** final rankings are frozen and the challenge moves to "Completed" state

---

### Story T3.7: Student Challenge View and Participation

As a student,
I want to see active challenges and track my standing,
So that I can participate in class competitions.

**FRs:** FR47
**Layers:** PostgreSQL (challenge_participants, portfolios) · Express challenge routes · Next.js challenges page

**Acceptance Criteria:**

**Given** I view the Challenges page and an active challenge exists for my class
**When** the page loads
**Then** I see the challenge name, description, time remaining countdown, and a "Join" button if not yet enrolled

**Given** I join a challenge
**When** I place trades within the challenge period
**Then** my portfolio return is tracked against other participants and my standing updates on the challenge leaderboard

**Given** a challenge ends
**When** I view it
**Then** final rankings are shown with a "Completed" banner; I can no longer join

---

### Story T3.8: Class Progress Report Export

As a teacher,
I want to export a class progress report with one click,
So that I can share evidence of student engagement.

**FRs:** FR48
**Layers:** PostgreSQL (aggregated query) · Express report route (CSV generation) · Next.js download trigger

**Acceptance Criteria:**

**Given** I am on a class detail page and click "Export Report"
**When** the export generates
**Then** a CSV file downloads within 3 seconds with columns: display name, portfolio return %, XP total, modules completed, lessons completed, trades placed, streak days

**Given** the CSV is opened in a spreadsheet
**When** I review the data
**Then** all columns have clear headers; percentages are numbers; dates are ISO formatted

**Given** I have no students enrolled
**When** I export
**Then** the CSV downloads with only the header row

---

### Story T3.9: User Profile Management and Account Deletion

As an authenticated user,
I want to manage my profile and delete my account with full data removal,
So that I have control over my information.

**FRs:** FR4, FR8, FR62, FR63
**Layers:** PostgreSQL (users, cascade delete) · Express profile/account routes · Next.js profile page

**Acceptance Criteria:**

**Given** I navigate to my profile page
**When** it loads
**Then** I can see and update my display name; changes reflect across the app within one refresh

**Given** I request account deletion and confirm with the required prompt
**When** deletion is initiated
**Then** I am signed out immediately; all PII, portfolio data, orders, XP, badges, and AI conversations are purged within 30 days

**Given** a teacher deletes their account while they have active classes
**When** deletion is initiated
**Then** they are warned that enrolled students retain their own data

---

### Story T3.10: Parent Read-Only Dashboard

As a parent or guardian,
I want to view my child's activity on the platform in read-only mode,
So that I can monitor engagement without interfering with their account.

**FRs:** FR49
**Layers:** PostgreSQL (guardian_links table) · Express guardian routes · Next.js guardian dashboard

**Acceptance Criteria:**

**Given** a minor student sends a guardian invite from their account settings
**When** the parent clicks the emailed link
**Then** a read-only guardian account is created linked to the student

**Given** I am a linked guardian and log in
**When** I view the dashboard
**Then** I see the student's portfolio value (no holdings detail), modules completed, streak, badges earned, and last active date — but cannot place trades or modify settings

**Given** the linked student deletes their account
**When** deletion is processed
**Then** my guardian access is also removed

---

## 🧵 Thread 4: Monetisation & AI Loop

**Goal:** A student can discover Pro benefits, upgrade via Stripe in under 15 seconds, access advanced modules and an AI coach with live portfolio context, and manage their subscription — the revenue and retention engine.

**Phase:** 3 (Months 7–9)
**Demo milestone:** Maya taps "Upgrade to Pro", pays $4.99 via Apple Pay, the advanced options module unlocks instantly, she opens the AI coach, asks "review my portfolio", and receives a streaming response referencing her actual AAPL position.

---

### Story T4.1: Pro Tier Features Display and Upgrade Prompts

As a student,
I want to clearly understand what Pro offers and be prompted to upgrade at natural moments,
So that I can make an informed decision about subscribing.

**FRs:** FR56
**Layers:** Next.js static upgrade page · Pro paywall component

**Acceptance Criteria:**

**Given** I navigate to the "Upgrade to Pro" page
**When** it loads
**Then** I see a clear Free vs Pro feature comparison including AI coach, advanced modules, and Pro badge

**Given** I attempt to access a Pro-gated feature while on free tier
**When** I am redirected
**Then** I see a paywall component with the specific benefit I'd unlock and a prominent "Upgrade" CTA

**Given** I am already Pro
**When** I view any paywall or upgrade page
**Then** I see my subscription status and a link to manage — not another upgrade prompt

---

### Story T4.2: Stripe Subscription Checkout

As a student,
I want to subscribe to Pro using a fast, secure checkout,
So that I can start using Pro features immediately after payment.

**FRs:** FR57, FR58
**NFRs:** NFR8
**Layers:** Stripe API (checkout sessions) · PostgreSQL (subscriptions table) · Express billing routes · Next.js redirect

**Acceptance Criteria:**

**Given** I click "Upgrade to Pro"
**When** the checkout initiates
**Then** I am redirected to Stripe-hosted checkout pre-filled with my email within 2 seconds

**Given** I complete payment on Stripe
**When** Stripe confirms payment
**Then** I am redirected back to the app, `is_pro` is set to true, and Pro features are accessible without logging out

**Given** I abandon the Stripe checkout before completing payment
**When** I return to the app
**Then** my account remains free tier with no partial state

---

### Story T4.3: Subscription Management and Webhook Sync

As a Pro subscriber,
I want to manage or cancel my subscription with immediate access updates,
So that I have full control over my billing.

**FRs:** FR59, FR60
**NFRs:** NFR8
**Layers:** Stripe customer portal · Stripe webhooks (raw body) · PostgreSQL · Express webhook endpoint

**Acceptance Criteria:**

**Given** I navigate to subscription management
**When** the page loads
**Then** I see my current plan, next billing date, and a "Manage subscription" button opening the Stripe portal

**Given** I cancel my subscription in the Stripe portal
**When** Stripe sends the cancellation webhook
**Then** the webhook is verified via Stripe-Signature header, `is_pro` is revoked at period end, and Pro features are removed accordingly

**Given** a webhook arrives with an invalid signature
**When** the endpoint processes it
**Then** the request is rejected with HTTP 400; no database changes are made

---

### Story T4.4: AI Coach Chat Interface

As a Pro subscriber,
I want to send messages to an AI coach in a persistent chat interface,
So that I can ask investing questions and get personalised guidance.

**FRs:** FR50, FR53, FR65
**Layers:** PostgreSQL (conversations, messages) · Express AI routes · Next.js chat UI

**Acceptance Criteria:**

**Given** I am Pro and navigate to the AI Coach page
**When** it loads
**Then** I see a chat interface with my conversation history, a message input, send button, and a persistent disclaimer: "Responses are educational only and do not constitute investment advice"

**Given** I am free tier and navigate to the AI Coach page
**When** it loads
**Then** I see the Pro paywall with AI coach described as a benefit

**Given** I type a message and press send
**When** submitted
**Then** my message appears immediately and the AI response begins streaming within 1 second

---

### Story T4.5: Streaming AI Responses with Portfolio Context

As a Pro subscriber,
I want the AI coach to respond in real time using my actual portfolio data,
So that guidance is specific to my situation.

**FRs:** FR51, FR52
**NFRs:** NFR4
**Layers:** Anthropic SDK (claude-sonnet-4-6, streaming) · Express SSE · PostgreSQL (portfolio read) · Next.js EventSource

**Acceptance Criteria:**

**Given** I send a message to the AI coach
**When** the response streams
**Then** tokens appear progressively via SSE; first token arrives within 1,000ms

**Given** the AI coach generates a response
**When** it references my portfolio
**Then** it uses my actual holdings, cost basis, and return data (portfolio ID only sent to Anthropic — no PII)

**Given** the SSE stream is interrupted by a network error
**When** the interruption occurs
**Then** a retry option appears; messages already received are preserved in conversation history

---

### Story T4.6: AI Educational Guardrails and Portfolio Review

As a Pro subscriber,
I want the AI coach to give educational guidance only and offer portfolio reviews,
So that I learn proper investing principles without receiving regulated advice.

**FRs:** FR53, FR54
**Layers:** Anthropic system prompt (educational framing) · Express AI service · Next.js portfolio review trigger

**Acceptance Criteria:**

**Given** I ask "Should I buy Apple stock?"
**When** the response generates
**Then** the coach declines to make a specific recommendation and instead explains how to evaluate a stock

**Given** I request a portfolio review
**When** the review generates
**Then** I receive structured analysis covering: concentration, diversification, best/worst performers, and 2–3 suggested learning modules relevant to my holdings

**Given** any AI response is displayed
**When** I view it
**Then** the educational disclaimer is visible on the page at all times

---

### Story T4.7: AI Conversation History

As a Pro subscriber,
I want to view my full conversation history with the AI coach,
So that I can reference previous guidance and continue discussions.

**FRs:** FR55
**Layers:** PostgreSQL (conversations, messages) · Express AI routes · Next.js conversation list

**Acceptance Criteria:**

**Given** I have had previous AI coach conversations
**When** I open the AI Coach page
**Then** my full conversation history loads in chronological order

**Given** I have multiple conversation sessions
**When** I view the conversation list
**Then** sessions are separated by date with the most recent first; I can click any to view its full messages

**Given** I delete my account
**When** the data purge runs
**Then** all AI conversation history is permanently deleted

---

## Thread Dependency Map

```
T1 Core Trading Loop (Phase 1, Weeks 1–3)
│
├── T2 Learning & Gamification Loop (Phase 1, Weeks 3–5)
│   └── Requires: T1.1 (auth), T1.3 (sessions)
│
├── T3 School & Classroom Loop (Phase 2, Months 4–6)
│   └── Requires: T1 complete, T2.10 (leaderboard), T2.8 (badges)
│
└── T4 Monetisation & AI Loop (Phase 3, Months 7–9)
    └── Requires: T1 complete, T2 complete (Pro module gating), T3 (optional)
```

---

## Story Count by Thread

| Thread | Stories | Phase | Key Milestone |
|--------|---------|-------|---------------|
| T1: Core Trading Loop | 14 | 1 | Register → Trade → P&L |
| T2: Learning & Gamification | 13 | 1 | Learn → Quiz → Level Up → Badge |
| T3: School & Classroom | 10 | 2 | Create Class → Challenge → Export |
| T4: Monetisation & AI | 7 | 3 | Upgrade → AI Coach → Stream |
| **Total** | **44** | | |

---

## Implementation Notes

**Start with T1.1 → T1.8 → T1.9:** Registration, caching, and buy order are the hardest dependency chain. Nothing else works until these three are stable.

**De-risk early:** T1.8 (market data caching, Risk: 4) and T4.5 (streaming AI, Complexity: 5) are the two most technically risky stories. Spike T1.8 in Week 1 and T4.5 in Phase 3 Week 1 — never leave them for last.

**Parallel workstreams from Week 3:** T1 and T2 can be developed in parallel from Week 3 onward. T1.3 (sessions) is the only shared prerequisite for T2.

**Phase 4 — Native Mobile:** After T4 is complete, begin `apps/mobile` Expo app. All business logic lives in the API; the mobile app is a new client consuming the same endpoints. Shared types in `packages/shared-types` require zero changes.
