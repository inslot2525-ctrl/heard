# Heard: MVP spec

**Name:** Heard. Tagline: "Heard, before it's a crisis."
**Challenge:** Nexconn Build Challenge 2026 on Reskilll. **Track:** Humanitarian & Social Good.
**Deadline:** Nov 22, 23:59 AoE = **Mon Nov 23, 17:29 IST**. Our internal deadline: **Sun Nov 22, 21:00 IST**.
**Team:** Aditya, Om.

---

## 1. One line

A campus communication app where hostel students are heard early: weekly one-tap check-ins, mentor conversations started by evidence and approved by a human, and chat that works in Marathi, Hindi or English.

## 2. Problem

- On most Indian campuses, mentors and wardens only notice a struggling student at an exam, a disciplinary case or a crisis. By then it's no longer a conversation.
- Students rarely start that conversation themselves. Homesickness, money and health stay invisible.
- Hostel communication runs on noisy WhatsApp groups with no structure, no roles and no follow-up.
- Many students, and most parents, are more comfortable in Marathi or Hindi than in English.

## 3. What we are NOT building

- **No Avlokan Setu or VSS code, data, branding, screenshots or wording.** This is a new codebase. The write-up may say only that "the concept grew out of an earlier student-support prototype by our team".
- No video classroom or Zoom clone.
- No risk scores, labels or AI diagnosis. The AI never contacts a student on its own.
- No real student data in the repo or demo. Seed data is fake.

## 4. Users and roles

| Role | Who | Main screen |
|---|---|---|
| Student | Hostel or class member | Chats, pulse card, assistant |
| Mentor | Faculty mentor or senior | Inbox of flags plus direct chats with their students |
| Warden | Hostel warden or admin | Notices, hostel channels, urgent alerts |
| Parent *(stretch)* | Student's parent, only with the student's consent | Weekly digest in their language |

A campus = one Nexconn **community channel**. Each hostel, class and the mentors' room are **subchannels**. Roles map to **user groups**.

## 5. Features

### Core: must work end-to-end in the demo (P0)

**F1. Sign-in and onboarding**
- Phone or email login on our backend (simple magic link or demo passcode; no real OTP needed for the MVP).
- Onboarding asks for role, hostel or class, and preferred language (en / hi / mr).
- The backend issues the Nexconn access token. The App Secret never reaches the browser.

**F2. Campus community**
- Subchannels per hostel and class, a private mentors' room, and a notices channel where only wardens can post.
- Direct chats between a student and their assigned mentor.
- Read receipts on notices, so the warden sees who has read them.

**F3. Weekly pulse check-in (custom message)**
- Every Monday the backend sends each student a `PulseCard`: four one-tap rows covering studies, money, health and home (good / ok / struggling), plus an optional free-text box ("anything on your mind?").
- The student's tap sends a `PulseResponse` back. It renders as a compact card and is saved to our DB through a webhook.

**F4. Evidence flags and mentor inbox (the core differentiator)**
- Deterministic rules, written as code and readable in the UI:
  - "struggling" on the same area 2 weeks in a row
  - a drop of 2 or more levels from the student's own baseline
  - no pulse reply for 2 weeks
  - an explicit "I'd like to talk" tap
  - *(stretch)* attendance below a threshold, from a CSV upload
- Each flag is shown to the mentor as a `FlagCard` with its evidence: a sparkline of the last 6 weeks, the rule that fired, and the student's own words if they gave any.
- An LLM drafts a short, warm **opening line**. Code checks the draft: no diagnosis words, no score, under 300 characters, and in the mentor's language. The mentor edits and sends, or dismisses with a reason. Nothing reaches a student without the mentor acting.
- Flag states: open → contacted → resolved / dismissed. The mentor sees a "resolved this month" count.

**F5. Language bridging**
- Uses Nexconn built-in translation. Each user's language is set at onboarding, and auto-translate is on in the mentor–student chats and hostel channels.
- The UI shows the original text with the translation, and lets users toggle between them.
- Cost: 10,000 characters are free, then a card is needed ($0.02 per 1,000 characters). The team decides whether to bind a card before the pilot.

**F6. Campus assistant bot**
- A Nexconn bot user, "Heard Assistant", answers routine questions (mess timings, leave process, fees office hours, Wi-Fi) from `data/handbook.md`.
- Replies stream in piece by piece (Nexconn stream messages) when the platform supports that from the server. Otherwise it sends normal messages.
- Hand-off: if a message is out of scope or sensitive, the bot replies "I'll connect you with your mentor" and opens a flag of type `asked_for_help`.

**F7. Safety path**
- Crisis keywords in English, Hindi and Marathi (a fixed list, matched in code, not by an LLM) trigger two things:
  1. The student immediately sees helpline info: **Tele-MANAS 14416** and the campus emergency contact.
  2. The warden and mentor get an urgent alert by push and an in-app banner.
- The bot never gives medical or crisis advice.

### Stretch (P1), only after the core is solid and the pilot is live

- **S1.** Anonymous lecture Q&A (open channel, upvotes)
- **S2.** Parent weekly digest in the parent's language, opt-in by the student
- **S3.** Auto-moderation on hostel channels (needs a card; English and Arabic by default)
- **S4.** One-tap urgent voice call to the warden (Call SDK; needs a card)
- **S5.** Attendance CSV upload feeding F4
- **S6.** Voice notes transcribed by our own speech-to-text (the Nexconn docs have no speech-to-text API)

## 6. Nexconn features we use (say this in the write-up)

| Nexconn feature | Where |
|---|---|
| Chat SDK + Chat UI (web) | all chat screens |
| Community channel, subchannels, private subchannels, user groups | F2 |
| Direct channels | F2, F4 |
| Custom messages | F3 (`PulseCard`, `PulseResponse`), F4 (`FlagCard`), notices |
| Read receipts | F2 notices |
| Built-in translation | F5 |
| Bot user + stream messages | F6 |
| Webhooks / server API | F3, F4, F6, F7, token issuing |
| Push | F7 |
| *(stretch)* Open channel, moderation, Call SDK | S1, S3, S4 |

## 7. Architecture

```
Browser (installable web app, React + Vite + TS)
  ├─ Nexconn Chat UI / Chat SDK (web)  ←→  Nexconn cloud
  └─ our REST API
        │
Backend (Node + TypeScript, Fastify or Hono)
  ├─ /auth: login, issues the Nexconn access token (App Secret on the server only)
  ├─ /campus: channels, roles, mentor assignments
  ├─ /pulse: scheduler that sends PulseCards; webhook receives responses
  ├─ /flags: rules engine, LLM opening-line draft + code checks, flag states
  ├─ /bot: webhook in → handbook answer (LLM) → reply via server API
  └─ /safety: keyword match → alerts
        │
Postgres (Neon free tier) · deployed on Render
LLM: Gemini (free tier) behind one small adapter, so it can be swapped
```

- Monorepo: `apps/web`, `apps/api`, `packages/shared` (message types, rule definitions).
- Nexconn packages seen in public sample apps: `@nexconn/engine`, `@nexconn/chat`, `@nexconn/chatui`. Confirm exact names and versions in the docs during spike A.

### Data model (first cut)

- `users`: id, name, role, lang, campus_id, hostel_id, nexconn_user_id
- `mentor_assignments`: mentor_id, student_id
- `pulses`: id, student_id, week, studies, money, health, home, note, created_at
- `flags`: id, student_id, mentor_id, rule, evidence_json, status, opener_draft, opener_sent, reason, timestamps
- `safety_events`: id, student_id, message_id, matched_term, alerted_at
- `consents`: student_id, parent_digest (bool), created_at

### Things to verify on day 1 (spikes)

| # | Question | If the answer is no |
|---|---|---|
| A | Can we issue a token from our server and send a message from the web SDK? | Blocker: open a GitHub issue on NexconnAI-Dev/hackathon at once |
| B | Do custom messages render in Chat UI (web), or do we need our own renderer? | Build our own message list for custom cards |
| C | Translation for hi / mr: auto vs on demand, from web | Translate through the LLM adapter ourselves |
| D | Can our server send messages as the bot user, and stream them? | Send normal messages from the bot |
| E | Do community channels work on the free hackathon plan? | Use groups per hostel instead |
| F | Which webhooks exist for "message sent"? | Have the client also POST to our API |

## 8. Demo script (≈3 min)

1. **Problem** (20 s).
2. **Student:** Priya (fake) opens the app in Marathi, answers her pulse with "money: struggling" for the second week, and asks the assistant about the fee deadline.
3. **Mentor:** the inbox shows the flag with its evidence. The mentor edits the drafted opening line in English and sends it. Priya receives it in Marathi and replies, and the mentor reads the reply in English.
4. **Warden:** posts a notice and sees who has read it.
5. **Safety:** a test message triggers the helpline card and the warden alert.
6. **Traction:** real pilot numbers (active users, check-ins answered, conversations started), with quotes.
7. **Nexconn features used** (one slide).

## 9. Judging rubric → what we do

| Criterion | Weight | Our answer |
|---|---|---|
| Completeness & UX | 50% | A small core that never breaks; seeded demo campus; mobile-first UI; Lighthouse check |
| Innovation & scenario | 30% | Conversations triggered by evidence and approved by a human; language bridging; "heard, not scored" |
| Business & growth | 20% | Live pilot at our college; MAU from the Nexconn console; feedback quotes; pricing story (free to 10K MAU per campus) |

## 10. Submission checklist

- [ ] Reskilll team created; Humanitarian track picked by the **team leader**
- [ ] Write-up PDF: why, problem, features, **which Nexconn features are used where**, **Nexconn App Key**, a statement that it is a new codebase built during the challenge, and pilot results
- [ ] Demo video (YouTube unlisted or Loom), viewable by anyone with the link
- [ ] Live URL (Render), with the demo login on the landing page
- [ ] Public GitHub repo: README, setup, `.env.example`, no secrets
- [ ] Traction proof: Nexconn console MAU screenshot, pilot stats, feedback form results
