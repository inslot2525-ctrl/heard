# Heard: developer guide

How to run, test, seed and deploy Heard, and the full API. The project overview is in the [README](../README.md).

- Spec: [MVP-SPEC.md](MVP-SPEC.md)
- Plan: [PLAN.md](PLAN.md)
- Handover: [HANDOVER.md](../HANDOVER.md)
- Rules for Claude Code sessions: [CLAUDE.md](../CLAUDE.md)
- **Pilot:** [docs/pilot/README.md](pilot/README.md) (runbook), guides for [wardens](pilot/WARDEN.md), [mentors](pilot/MENTOR.md), [students](pilot/STUDENT.md), and the [privacy notice](pilot/PRIVACY.md)

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

**Hostel register** (monthly records kept by the warden; rules in `packages/shared/src/register.ts`)

| Route | Who | What it does |
|---|---|---|
| `GET /register?month=&hostelId=` | warden | The month's sheet for the campus. |
| `PUT /register` `{ month, rows: [{ studentId, attendance, academics, duties, activities, conduct, remarks }], source }` | warden | Save rows (any value may be empty), then run the register rules (3-month decline, drop vs own usual, repeated conduct) and check targets. A continuing problem refreshes the open card instead of opening a new one. |
| `POST /register/scan` `{ month, hostelId?, image: { mimeType, data } }` | warden | Read a photo of the paper register (Gemini). Returns rows with matched students; **nothing is saved**. |
| `GET /register/students/:id` | mentor (own students) | 6 months of records, targets with met / not met, the advisory six-month review, past decisions. |
| `POST /register/students/:id/targets` `{ metric, month, goal, flagId? }` | mentor | Next-month target; when met, the linked flag resolves. |
| `POST /register/students/:id/review` `{ month, decision, reason }` | mentor | Record the decision (continue / continue with support / refer) with a required reason, stored with the suggestion shown. |

**AI and safety** (Gemini; off without `GEMINI_API_KEY`)

| Route | Who | What it does |
|---|---|---|
| `POST /translate` `{ text, to }` | any | Gemini translation, used for Indian languages (Nexconn garbles Marathi). Cached; rate-limited. |
| `POST /assistant/ask` `{ text, messageId? }` | student | The Heard Assistant answers from `data/handbook/<campusId>.md` in the student's language, sent as the campus bot. Personal or unknown questions → hand-off: an `asked_for_help` flag for the mentor. |
| `POST /safety/check` `{ text, messageId? }` | student | Runs the safety keywords on a message the student just sent. A backup for the webhook below. |
| `POST /webhooks/nexconn` | Nexconn | Signed webhook. On `message:send`, every student text message in any chat goes through the safety check, server-side. Configure in the Nexconn console: Chat → Chat settings → Webhooks → URL `https://heard-api-htrg.onrender.com/webhooks/nexconn`, event `message:send`. |

**Safety path** (`apps/api/src/safety.ts`): fixed keyword lists in English, Hindi, Marathi and Chinese, matched in code (never by AI), for self-harm and ragging. Checked on chat messages, check-in notes and assistant questions, **before** any AI. On a match: the student gets a card with Tele-MANAS 14416 and 112, the mentor gets an **urgent** flag at the top of the inbox, and every warden gets a direct alert. The lists need review by a counsellor and native speakers before the pilot.

## The demo campus

"Sahyadri College (demo)", fake people only: 2 hostels, 3 mentors, 1 warden, 20 students with 6 weeks of check-ins. Four students carry a story, one per flag rule (`apps/api/src/demo.ts`):

| Student | Story | Flag |
|---|---|---|
| Priya Patil (`demopriya`, Marathi) | "money: struggling" two weeks running, asks for help with fees | repeat struggling |
| Rohan Yadav (`demorohan`, Hindi) | health usually good, now struggling; can't sleep | drop from baseline |
| Sneha Iyer (`demosneha`) | stopped replying two weeks ago | silent |
| Aman Khan (`demoaman`) | tapped "I'd like to talk" | wants to talk |

Everyone else is steady and never flags (tested). **Li Na** (`demolina`, Chinese, exchange student) talks to Prof. Rao in English: the best showcase of chat translation.

## Layout

- `apps/api`: Hono on Node. Drizzle ORM (PGlite locally, Postgres via `DATABASE_URL`), join-code login, Nexconn server API client.
- `apps/web`: React + Vite on the Nexconn web SDK (`@nexconn/chat` 26.2.1). Mobile-first screens:
  - **Welcome:** join with a code (then the one-time login code), log back in with a login code, or pick a demo persona.
  - **Student:** this week's one-tap check-in card, then chats (mentor, hostel, notices, assistant).
  - **Mentor:** inbox of flags → flag detail (reason, 6-week bars, the student's words, editable opener, send / resolve / dismiss) and chats with each student.
  - **Warden:** send this week's check-in round; notices and hostel channels.
  - **Chat:** history + live messages, check-in and flag cards, automatic translation when the sender's language differs, with the original always shown.
  - **Languages:** the full UI is written in English, Hindi, Marathi and Chinese (`src/i18n.ts`; hi/mr/zh need a native speaker's review). Chat works in all **211** languages Nexconn translates (`packages/shared/src/languages.ts`): pick any, and the UI falls back to English while messages are translated. Users can switch language any time (🌐 in the header, `POST /auth/me/lang`). The old spike lab is at `#/lab`.
- `packages/shared`: custom message types, flag rules, ISO weeks (pure functions with tests).

## Deploy (Render + Neon, all in Singapore)

`render.yaml` is a Render Blueprint with two services:

- **heard-api**: Node web service, Singapore, free plan. Runs migrations on start. Health check `/health`.
- **heard-web**: static site (global CDN). The hash router needs no rewrite rules.

Live: **https://heard-web.onrender.com** (web) and **https://heard-api-htrg.onrender.com** (API). The services know each other's public URLs from `render.yaml` (`WEB_ORIGIN`, `VITE_API_URL`). Don't use `fromService … property: host` for these: it returns Render's internal hostname, not the public one.

1. Render dashboard → **New → Blueprint** → pick this repo (branch `main`).
2. Paste the secrets it asks for (never commit them): `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`, `DATABASE_URL` (Neon **pooled** string, Singapore project), `GEMINI_API_KEY`, `DEMO_PASSCODE`, and `VITE_NEXCONN_APP_KEY` (same App Key). `SESSION_SECRET` is generated.
3. After the first deploy, seed the demo campus into Neon once from your machine (`pnpm --filter @heard/api seed:demo` with `DATABASE_URL` set), if it isn't there already.

Free-plan note: the API sleeps after ~15 minutes idle and takes up to a minute to wake. Open `/health` a minute before a demo.
