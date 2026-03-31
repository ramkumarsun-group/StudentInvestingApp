# StudentInvest — Claude Code Context

## Project Overview
A gamified investing education platform for students (ages 13–25). Students learn investing with virtual money ($100K paper trading), real market data, and AI coaching.

## Monorepo Structure
```
apps/
  api/        Express REST API (Node.js + TypeScript + PostgreSQL + Redis)
  web/        Next.js 14 web app (App Router + Tailwind CSS + Recharts)
packages/
  shared-types/   TypeScript types shared across apps + future mobile
  shared-utils/   Currency formatting and portfolio math helpers
infra/            Docker Compose, Dockerfiles
docs/             PRD, architecture, and user stories (BMAD artifacts)
_bmad/            BMad Method agent skills and workflows
```

## Tech Stack
- **Backend:** Express, PostgreSQL, Redis, JWT auth, node-cron
- **Frontend:** Next.js 14 App Router, Tailwind CSS, TanStack Query, Recharts, NextAuth
- **AI:** Anthropic Claude claude-sonnet-4-6 (streaming chat, portfolio analysis)
- **Payments:** Stripe (Student Pro $4.99/mo)
- **Market Data:** Alpaca Markets (stocks/ETFs), CoinGecko (crypto), NewsAPI

## Development Phases
- **Phase 1 (Months 1–3):** Web foundation — paper trading, 5 learning modules, XP/badges, leaderboard
- **Phase 2 (Months 4–6):** Schools & Social — teacher dashboard, class leagues, challenges, streaks
- **Phase 3 (Months 7–9):** AI Coach & Advanced — Claude AI coach, advanced modules, Stripe Pro, PWA

## Key Conventions
- API routes: `/api/v1/*` — all versioned, JWT-protected (except public leaderboard + auth)
- Database: PostgreSQL with sequential migrations in `apps/api/src/db/migrations/`
- Caching: Redis for market quotes (30s TTL), leaderboard sorted sets, refresh tokens
- Shared types live in `packages/shared-types` — import as `@student-investing/shared-types`
- Paper trading fills at market price ±0.1% simulated spread
- XP events are immutable audit rows; badge checks run after every XP award

## BMAD Workflow
This project uses the BMad Method for agile AI-driven development.

### Available Agents (use as slash commands)
| Command | Agent | Role |
|---------|-------|------|
| `/bmad-analyst` | Mary 📊 | Business analysis, requirements elicitation |
| `/bmad-architect` | Fred 🏗️ | System design, architecture decisions |
| `/bmad-pm` | John 📋 | PRD, backlog, prioritization |
| `/bmad-dev` | James 💻 | Implementation, code review |
| `/bmad-qa` | Quinn 🧪 | Testing, quality assurance |
| `/bmad-sm` | Bob 🏃 | Sprint planning, story creation |
| `/bmad-ux-designer` | Sally 🎨 | UX design, user flows |

### Available Workflows
| Command | Purpose |
|---------|---------|
| `/bmad-help` | Get help with BMad |
| `/bmad-create-prd` | Create/update PRD |
| `/bmad-create-architecture` | Architecture documentation |
| `/bmad-create-story` | Write a user story |
| `/bmad-create-epics-and-stories` | Break PRD into epics/stories |
| `/bmad-dev-story` | Implement a story |
| `/bmad-sprint-planning` | Sprint planning session |
| `/bmad-code-review` | Structured code review |
| `/bmad-qa-generate-e2e-tests` | Generate E2E tests |
| `/bmad-retrospective` | Sprint retrospective |
| `/bmad-generate-project-context` | Generate project context doc |
| `/bmad-correct-course` | Identify and fix blockers |
| `/bmad-party-mode` | Multi-agent collaboration |

### BMAD Documents
- `docs/prd.md` — Product Requirements Document
- `docs/architecture.md` — System architecture
- `docs/stories/` — User stories (US-001.md, US-002.md, ...)

## Local Development
```bash
# Start DB + Redis
docker compose -f infra/docker-compose.yml up -d

# Install dependencies
pnpm install

# Run DB migrations + seeds
pnpm db:migrate && pnpm db:seed

# Start all apps
pnpm dev
# API: http://localhost:4000
# Web: http://localhost:3000
```

## Environment
Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NEXTAUTH_SECRET`
- `ALPACA_API_KEY`, `ALPACA_API_SECRET` (free tier at alpaca.markets)
- `COINGECKO_API_KEY` (free at coingecko.com)
- `NEWS_API_KEY` (free at newsapi.org)
- `ANTHROPIC_API_KEY` (Phase 3 AI coach)
- `STRIPE_SECRET_KEY` (Phase 3 subscriptions)
