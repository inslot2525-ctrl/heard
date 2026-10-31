# Heard

Hostel students heard early: weekly one-tap check-ins, mentor conversations started by evidence and approved by a human, and chat in Marathi, Hindi or English. Built on the Nexconn Chat SDK for the Nexconn Build Challenge 2026 (Humanitarian & Social Good).

> Pre-build. This README is for the team; it will be replaced with the judge-facing version before submission.

- Spec: [docs/MVP-SPEC.md](docs/MVP-SPEC.md)
- Plan: [docs/PLAN.md](docs/PLAN.md)
- Handover: [HANDOVER.md](HANDOVER.md)
- Rules for Claude Code sessions: [CLAUDE.md](CLAUDE.md)

## Run locally

Needs Node 22+ and pnpm 10. No database to install: locally the API uses an embedded Postgres (PGlite) in `apps/api/.pglite`.

```bash
pnpm install
cp .env.example .env                    # Nexconn App Key/Secret, a DEMO_PASSCODE
pnpm --filter @heard/api seed:demo      # fake demo campus in the DB and on Nexconn; prints join codes
pnpm dev                                # api on :8787, web on :5173
pnpm test                               # unit + API tests
pnpm typecheck
```

- Reset the demo data: `pnpm --filter @heard/api seed:demo --reset`. Wipe the local DB completely: delete `apps/api/.pglite`.
- Spike lab (http://localhost:5173): log in as a demo persona (`demopriya`, `demorao`, `demowarden`, …) with the demo passcode. `pnpm --filter @heard/api spike <cmd>` pushes test messages to it.
- After changing `apps/api/src/db/schema.ts`: `pnpm --filter @heard/api db:generate`, then commit the new file in `apps/api/drizzle`. Migrations run when the API starts.

## API so far

| Route | What it does |
|---|---|
| `POST /auth/join` `{ code, name, lang }` | Join a campus with a code. The code decides campus, role and hostel. Returns `{ session, user }`. Students are given the mentor with the fewest students. |
| `POST /auth/demo-login` `{ passcode, userId }` | Log in as a seeded demo persona (demo users only). |
| `GET /auth/demo-users` | Demo personas for a login picker. |
| `GET /auth/me` | User, campus, hostel, and (for students) mentor. |
| `POST /auth/nexconn-token` | Nexconn access token for the logged-in user. |

Authenticated routes take `Authorization: Bearer <session>`.

## The demo campus

"Sahyadri College (demo)", fake people only: 2 hostels, 3 mentors, 1 warden, 20 students with 6 weeks of check-ins. Four students carry a story, one per flag rule (`apps/api/src/demo.ts`):

| Student | Story | Flag |
|---|---|---|
| Priya Patil (`demopriya`, Marathi) | "money: struggling" two weeks running, asks for help with fees | repeat struggling |
| Rohan Yadav (`demorohan`, Hindi) | health usually good, now struggling; can't sleep | drop from baseline |
| Sneha Iyer (`demosneha`) | stopped replying two weeks ago | silent |
| Aman Khan (`demoaman`) | tapped "I'd like to talk" | wants to talk |

Everyone else is steady and never flags (tested).

## Layout

- `apps/api`: Hono on Node. Drizzle ORM (PGlite locally, Postgres via `DATABASE_URL`), join-code login, Nexconn server API client.
- `apps/web`: React + Vite on the Nexconn web SDK (`@nexconn/chat` 26.2.1). Currently the spike lab.
- `packages/shared`: custom message types, flag rules, ISO weeks (pure functions with tests).
