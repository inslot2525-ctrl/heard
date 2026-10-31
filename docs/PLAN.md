# Heard: day-by-day plan

Today is Sat Oct 31, 2026. **Internal deadline: Sun Nov 22, 21:00 IST.** The hard deadline is Mon Nov 23, 17:29 IST.

**Assumptions:**
- Nov 1–4 are light days (about 1–2 h each), because the Meta hackathon is due Nov 5, 07:30 IST.
- Full speed starts Nov 5.
- Aditya hands over to Om on **Mon Nov 16** (see `HANDOVER.md`). Change that date here if it moves.

## Progress

- **Oct 31:** Phase 0 done (scaffold, spikes A–E; F waits for deploy). Started Phase 1 early, since Om has the Meta hackathon: database, join-code login, sessions, and the seeded demo campus are done (planned Nov 5–6). See README "API so far".
- **Oct 31 (later):** core loop done ahead of Nov 10–12: personal login codes, weekly rounds, `POST /pulse`, flags engine, mentor inbox API with opener drafts (templates in en/hi/mr; LLM drafts later). Verified live on Nexconn: answer → flag card to mentor → opener reaches student.
- **Oct 31 (night):** first version of all screens (welcome, student home + check-in, chat with cards and translation, mentor inbox + flag detail, warden home), checked in the browser with the demo campus. Om takes these over for polish when he's back. Found: Nexconn translation garbles Marathi; switching mr/hi to Gemini.
- **Oct 31 (late):** Gemini in: Indian-language translation (fixes Marathi), the Heard Assistant answering from the handbook with hand-off to mentors, and the safety path (keywords in 4 languages → helplines, urgent flag, warden alert). All verified live in the browser.

## Who owns what

| | Aditya (until handover) | Om |
|---|---|---|
| Area | **Platform:** Nexconn integration, backend, data, bot, webhooks, deploy | **Product:** screens, UX, pulse and flag flows on the client, demo, pilot, video, write-up |
| Branches | `aditya/*` | `om/*` |
| After handover | — | Owns everything |

Rules:
- Work on branches and merge to `main` only through a PR reviewed by the other person, or self-merged if the other is unavailable for more than 6 h.
- `main` must always deploy.

## Phase 0: set up and de-risk (Nov 1–4, light)

| Date | Aditya | Om |
|---|---|---|
| **Sun Nov 1** | Create the Nexconn account and app; save the App Key and Secret in the team password manager (**never in git**). Install the Nexconn AI skills in Claude Code. | Register on Reskilll and create the team (the leader picks Humanitarian). Install the Nexconn AI skills. Read the Chat UI web docs. |
| **Mon Nov 2** | **Spike A:** token server plus one message from the web SDK. **Spike E:** community channel on the free plan. | Repo scaffold: `apps/web` (Vite React TS), `apps/api`, `packages/shared`, lint, `.env.example`. |
| **Tue Nov 3** | **Spike B:** custom message in Chat UI. **Spike C:** translation hi/mr. | Low-fi screens: student home, chat, pulse card, mentor inbox, flag card. |
| **Wed Nov 4** | **Spike D:** bot reply from the server (+ stream). **Spike F:** webhooks. Write the results in `docs/SPIKES.md`. | Pick the UI kit and theme; the onboarding flow (role, hostel, language). |

**Gate on Nov 4:** if spike A fails, post an issue on `NexconnAI-Dev/hackathon` the same day (they reply within 12 h).

## Phase 1: foundation (Nov 5–9)

| Date | Aditya | Om |
|---|---|---|
| **Thu Nov 5** | Postgres schema plus migrations; `/auth` with demo passcode login; token issuing. | Onboarding screens wired to `/auth`. |
| **Fri Nov 6** | Campus setup script: community channel, subchannels, user groups; seed a fake campus (2 hostels, 3 mentors, 20 students). | Own chat screens on the Chat SDK (no Chat UI: not mobile, no community channels): channel list, hostel channel, direct chat, message list with custom-card renderers. |
| **Sat Nov 7** | Custom message types in `packages/shared`: `PulseCard`, `PulseResponse`, `FlagCard`, `Notice`. Server send helpers. | Renderers for the custom cards. Notices channel (only wardens post) with a read-receipt view. |
| **Sun Nov 8** | Translation on per user and per channel; webhook receiver skeleton. | Language toggle (original vs translated); the Marathi/Hindi UI strings that matter. |
| **Mon Nov 9** | Deploy API + web on Render; Neon DB; health check. **Shared demo URL live.** | End-to-end test on 2 phones; bug list in GitHub Issues. |

## Phase 2: core features + pilot v0 (Nov 10–15)

| Date | Aditya | Om |
|---|---|---|
| **Tue Nov 10** | Pulse scheduler (manual trigger plus weekly cron); webhook saves `PulseResponse`. | Pulse card UX: one tap, under 10 seconds, optional note. |
| **Wed Nov 11** | Flags rules engine (pure functions plus unit tests); `/flags` API with states. | Mentor inbox: flag list, evidence sparkline, rule text, student's words. |
| **Thu Nov 12** | LLM opening-line draft plus code checks; send as the mentor. | Edit-and-send / dismiss-with-reason flow. **Pilot v0 live:** recruit 1 hostel or class at our college (target 30 students + 3 mentors). Feedback form. |
| **Fri Nov 13** | Bot user + handbook Q&A + hand-off to a flag. | Assistant chat UX; write `data/handbook.md` for our real hostel (with permission). |
| **Sat Nov 14** | Safety path: keyword lists (en/hi/mr), helpline card, warden alert by push. | Safety UX; warden screens. |
| **Sun Nov 15** | Bug fixes from the pilot; analytics endpoint (active users, pulses, conversations). Draft `HANDOVER.md`. | Pilot round 2: send the first real pulse; collect quotes. |

## Handover (Mon Nov 16)

| Date | Aditya | Om |
|---|---|---|
| **Mon Nov 16** | Finish `HANDOVER.md`; a 45-minute walkthrough call; hand over secrets through the password manager; make sure Om can deploy alone. | Run the whole stack locally from the README alone; deploy once on his own. Raise any gaps before the call ends. |

## Phase 3: polish + stretch (Nov 17–20), Om owns this (Aditya on call if available)

| Date | Om |
|---|---|
| **Tue Nov 17** | Fix the top pilot bugs; UX polish on mobile; loading and empty states. |
| **Wed Nov 18** | One stretch item only: **S2 parent digest** or **S1 lecture Q&A** (pick by pilot feedback). |
| **Thu Nov 19** | Second weekly pulse to pilot users; screenshot the Nexconn console MAU; collect quotes. |
| **Fri Nov 20** | **Feature freeze, 22:00 IST.** Reset the seeded demo campus; record a rough cut of the demo. |

## Phase 4: submission (Nov 21–22)

| Date | Om |
|---|---|
| **Sat Nov 21** | Final demo video (≈3 min, script in the spec §8). Write-up PDF (checklist in the spec §10, including the App Key and the "new codebase" statement). README with screenshots. |
| **Sun Nov 22** | Final check: live URL in an incognito window, repo public with no secrets (`git log -p` scan), video link opens while logged out. **Submit by 21:00 IST.** You can keep editing until Nov 23 17:29 IST. |

## Cut list (drop in this order if late)

1. All stretch items
2. Bot streaming (send normal messages instead)
3. Bot handbook Q&A (keep only the hand-off to the mentor)
4. Warden screens (keep notices only)

**Never cut:** pulse → flag → mentor opening line → translated reply. That is the demo.
