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

Authenticated routes take `Authorization: Bearer <session>`.

**Auth**

| Route | What it does |
|---|---|
| `POST /auth/join` `{ code, name, lang }` | Join a campus with a join code; the code decides campus, role and hostel. Returns `{ session, user, loginCode }`. **Show `loginCode` to the user once**: it's how they log back in on another device (only its hash is stored). Students get the mentor with the fewest students. |
| `POST /auth/login` `{ code }` | Log back in with the personal login code. |
| `POST /auth/demo-login` `{ passcode, userId }` | Log in as a seeded demo persona (demo users only). |
| `GET /auth/demo-users` | Demo personas for a login picker. |
| `GET /auth/me` | User, campus, hostel, and (for students) mentor. |
| `POST /auth/nexconn-token` | Nexconn access token for the logged-in user. |

Join, login and demo login are rate-limited (20 tries per 10 minutes per IP).

**Check-ins (pulse)**

| Route | Who | What it does |
|---|---|---|
| `GET /pulse/current` | student | This week (`2026-W45`) and my answer, or `null`. |
| `POST /pulse` `{ week, levels: { studies, money, health, home }, note?, wantsToTalk? }` | student | Save or change an answer (levels: 2 good, 1 ok, 0 struggling). This week or last week only. Mirrors a `SA:PulseResp` into the student's chat with the campus bot, then runs the flag rules. Returns `{ saved, mentorNotified }`; students never see flags. |
| `POST /pulse/rounds` | warden | Send this week's `SA:PulseCard` to every student from the campus bot. First checks last week for students who went silent. |

**Mentor inbox (flags)**

| Route | What it does |
|---|---|
| `GET /flags?status=open,contacted` | My students' flags, newest first, with `student`, `reason`, `evidence` (6-week history + the student's words) and `openerDraft` in my language. |
| `GET /flags/:id` | One flag (only my own students'). |
| `POST /flags/:id/opener` `{ text }` | Send my edited opener to the student as me; flag → `contacted`. Refuses labels/diagnoses ("depressed", "at risk", …). |
| `POST /flags/:id/dismiss` `{ reason }` | Close with a reason (required). |
| `POST /flags/:id/resolve` | Close as resolved. |

A new flag also sends the mentor a `SA:FlagCard` from the campus bot, so it shows up in chat.

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
- `apps/web`: React + Vite on the Nexconn web SDK (`@nexconn/chat` 26.2.1). Mobile-first screens:
  - **Welcome:** join with a code (then the one-time login code), log back in with a login code, or pick a demo persona.
  - **Student:** this week's one-tap check-in card, then chats (mentor, hostel, notices, assistant).
  - **Mentor:** inbox of flags → flag detail (reason, 6-week bars, the student's words, editable opener, send / resolve / dismiss) and chats with each student.
  - **Warden:** send this week's check-in round; notices and hostel channels.
  - **Chat:** history + live messages, check-in and flag cards, automatic translation when the sender's language differs, with the original always shown.
  - UI text in English, Hindi and Marathi (`src/i18n.ts`; hi/mr need a native speaker's review). The old spike lab is at `#/lab`.
- `packages/shared`: custom message types, flag rules, ISO weeks (pure functions with tests).
