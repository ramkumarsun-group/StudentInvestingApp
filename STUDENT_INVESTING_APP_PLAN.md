# Student Investing App — Product Roadmap

7 phases across 3 stages | 18-month timeline

---

## Stage 1 — Web App (Phases 1–3, Months 1–9)

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| 1 | Web Foundation | Live web app, trading sim, 5 modules, leaderboard, 200 beta users |
| 2 | Schools & Social | Teacher dashboard, class leagues, challenges, streaks, first paying schools |
| 3 | AI Coach & Advanced | Claude AI coach, advanced modules, Student Pro subscription, PWA |

---

## Stage 2 — iOS App (Phases 4–5, Months 10–13)

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| 4 | iOS Core | App Store launch, full feature parity, push notifications, Face ID |
| 5 | iOS Polish | StoreKit IAP, onboarding flow, offline mode, A/B testing |

---

## Stage 3 — Android + Scale (Phases 6–7, Months 14–18)

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| 6 | Android Launch | Google Play, Google Billing, Android-specific testing |
| 7 | Cross-Platform Scale | Parent Plan, national competitions, expert modules, 50K users |

---

## Why This Order Works

- The web backend built in Phases 1–3 is reused **100%** by mobile — no throwaway work.
- A React Native `packages/core` layer is introduced in Phase 4 that shares **~65%** of logic with the web app.
- Validate the product and get paying schools before spending on mobile development.

---

## Minimum Viable Investment

> **Phase 1 alone (~$120K, 3 months)** proves the concept before committing to the full roadmap.
