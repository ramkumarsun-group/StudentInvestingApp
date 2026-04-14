# Solution Architecture — Stage 1 (Phases 1–3)

Web App foundation that the mobile stages build on | Months 1–9

---

## Phase 1 — Web Foundation (Months 1–3)

```
[ Student ] → [ Web App ]
                   │
                   ├── Trading Simulator
                   ├── 5 Learning Modules
                   ├── Leaderboard
                   └── Auth / User Profiles

Target: 200 beta users | Budget: ~$120K
```

---

## Phase 2 — Schools & Social (Months 4–6)

```
[ Student ] → [ Web App ]
[ Teacher ] → [ Teacher Dashboard ]
                   │
                   ├── Class Leagues
                   ├── Challenges
                   ├── Streaks
                   └── School Admin Panel

Target: First paying schools
```

---

## Phase 3 — AI Coach & Advanced (Months 7–9)

```
[ Student ] → [ Web App / PWA ]
                   │
                   ├── Claude AI Coach ──→ [ Anthropic API ]
                   ├── Advanced Modules
                   ├── Student Pro Subscription
                   └── Progressive Web App (PWA)

Target: Student Pro revenue, PWA installable on mobile
```

---

## Stage 1 → Stage 2 Handoff

The web backend built in Phases 1–3 is reused **100%** by the iOS and Android apps.

```
Stage 1 Output (Web)          Stage 2+ Input (Mobile)
─────────────────────         ──────────────────────────
REST / GraphQL API       →    Shared by React Native apps
Auth & User DB           →    Same auth layer, add Face ID
AI Coach (Claude)        →    Same API calls, mobile UI
Subscription logic       →    StoreKit (iOS) / Google Billing (Android)
```

> A `packages/core` React Native layer introduced in Phase 4 shares **~65%** of logic with the web app.

---

## Full Roadmap Reference

| Stage | Phases | Timeline | Platform |
|-------|--------|----------|----------|
| 1 | 1–3 | Months 1–9 | Web |
| 2 | 4–5 | Months 10–13 | iOS |
| 3 | 6–7 | Months 14–18 | Android + Scale |
