# Handover: Aditya → Om

Aditya fills this in before the handover call (target **Mon Nov 16**). Om confirms each item in the last section. Keep it short: links and facts, not essays. Never put secret values in this file.

**Handover date:** _(fill in)_
**Last commit on `main` at handover:** _(fill in: `git log --oneline -1 origin/main`)_
**Live URLs:** web https://heard-web.onrender.com · API https://heard-api-htrg.onrender.com (`/health`)

_Draft filled in on Nov 4 with everything that is true today; update the blanks on handover day._

---

## 1. Status at a glance

| Feature (spec §5) | Status | Notes / known bugs |
|---|---|---|
| F1 Sign-in & onboarding | ✅ done | Join codes + one-time personal login code; privacy notice must be accepted at join; demo persona login with `DEMO_PASSCODE`. |
| F2 Campus community | ✅ done | Nexconn community per campus: hostel subchannels, notices (wardens post), mentors room; direct chats. Own React screens (the Chat UI kit isn't mobile). |
| F3 Pulse check-in | ✅ done | The warden presses "Send this week's check-in". No automatic weekly send: free Render sleeps, so a timer inside the API wouldn't fire. |
| F4 Flags + mentor inbox | ✅ done | 4 rules + "improved after help"; evidence cards; editable opener; Tone Guard; meeting card; help log; journey charts. Rule quality: `docs/PROOF.md`. |
| F5 Translation | ✅ done | Nexconn translation for most languages; Gemini for Indian languages/scripts (Nexconn garbles Marathi). Original always shown. |
| F6 Assistant bot | ✅ done | Handbook Q&A (`data/handbook/<campusId>.md`) + hand-off to the mentor. Server stream messages don't fire on web (SDK bug), so replies are plain text. |
| F7 Safety path | ✅ done | Fixed keyword lists en/hi/mr/zh; helpline card; urgent mentor flag; warden alert; also server-side via webhook. **Lists not yet reviewed by a counsellor or native speakers.** |
| Extras | ✅ done | Ask Heard (answers with receipts checked by code), voice notes + transcripts, topic tags, fairness view, Clear chat. |
| Deploy (Render + Neon) | ✅ live | Both in Singapore. Free plan: the API sleeps after ~15 min idle; open `/health` a minute before a demo. |
| Pilot | ⬜ not started | No warden; the plan is a peer-mentor pilot with classmates. users: 0 · mentors: 0 |

## 2. Accounts and secrets

Store values only in the team password manager, never here.

| Item | Where it lives | Who has access |
|---|---|---|
| Nexconn console login (app owner) | Nexconn console | Aditya |
| Nexconn App Key / App Secret | Render env (heard-api, heard-web), local `.env` | Aditya |
| Nexconn data centre / API host | Singapore, `api.sg-light-api.com` (`AreaCode.SG`) | – |
| Nexconn webhook | Console → Chat → Chat settings → Webhooks: `…/webhooks/nexconn`, event `message:send` | Aditya |
| Reskilll team leader | reskilll.com/hack/nexconn | _(fill in)_ |
| Render | Blueprint "heard" (heard-api, heard-web) | Aditya |
| Neon (Postgres) | project "heard" (`divine-forest-45762747`), AWS Singapore, pooled URL | Aditya |
| LLM API key | Gemini key in Render env + local `.env` | Aditya |
| `DEMO_PASSCODE` | Render env + local `.env`. **Change it before judges see the app** (the local one is guessable). | Aditya |
| Card bound to Nexconn? (translation / moderation / calls) | no (the free translation quota is 10K characters; after that a card is needed) | – |

- [ ] Check the Nexconn plan expiry in the console: one doc says the Free plan is "valid for one month", another says a year (`docs/SPIKES.md`). The app must still work during judging (Nov 23–27).
- [ ] Om added as a member or co-owner wherever the platform allows (GitHub, Render, Neon, Nexconn)
- [ ] Every secret in `.env.example` has a matching value in the password manager

## 3. How to run it

```bash
pnpm install
cp .env.example .env                              # then fill in values from the password manager
pnpm dev                                          # API :8787, web :5173
pnpm test && pnpm typecheck && pnpm build         # the gate before every commit
```

- Seed or reset the demo campus: `pnpm --filter @heard/api seed:demo --reset` (check-ins, flags, help log, safety alerts, profile languages). It does **not** touch chat history in Nexconn: use **Clear chat** in the app as each demo user.
- Trigger a pulse manually: log in as the warden → **Send this week's check-in** (or `POST /pulse/rounds`).
- Run the tests: `pnpm test` (about 40 s; API tests use in-memory PGlite).
- Rule proof: `pnpm --filter @heard/api proof` rewrites `docs/PROOF.md`.
- Deploy: merge to `main`; Render auto-deploys both services. Migrations run when the API starts.
- Real campus (pilot): `pnpm --filter @heard/api campus create|posters|codes|users|forget` (see `docs/pilot/README.md`).

## 4. How things work (the non-obvious parts)

- **Token issuing:** `POST /auth/nexconn-token` → Nexconn server API token call (signature `sha1(secret + nonce + timestamp)`), in `apps/api/src/nexconn.ts`.
- **Custom message types and where they render:** `packages/shared/src/messages.ts` (`SA:PulseCard`, `SA:PulseResp`, `SA:FlagCard`, `SA:Notice`, `SA:SafetyCard`, `SA:AskAnswer`). They must be registered **before** connecting (`apps/web/src/chat-client.ts`); they render in `ChatScreen.tsx`.
- **Webhooks:** `message:send` → `POST /webhooks/nexconn`, verified with the same signature (`verifyWebhook`). Used for the safety check on every student message, including ones sent outside our UI. Alerts are deduped by message ID.
- **Translation setup:** no console switch needed for the free quota. Routing lives in `chat-client.ts` + `packages/shared/src/languages.ts` (`useLlmTranslation`): Indian languages or scripts → our `/translate` (Gemini); everything else → Nexconn `translateMessages`. The SDK has no auto-translate, so we call it per message and cache by message ID (`heard.tr2.` keys).
- **Bot:** one bot user per campus, ID `<campusId>bot` (demo: `heardDemobot`), named "Heard Assistant"; the server sends its replies (`chat.ts`). Streaming: no (see F6).
- **LLM:** `apps/api/src/llm.ts`: model chain gemini-3.5-flash-lite → 3.5-flash → 2.5-flash, 5 s timeout each. Every AI feature is optional: without `GEMINI_API_KEY` the core loop still works.
- **Flag rules:** `packages/shared/src/rules.ts` (pure functions with tests). To add a rule: write the function, add it to `evaluate()`, add a `RuleId`, a label in `i18n.ts` and tests, then rerun the proof.
- **Safety keyword lists:** `apps/api/src/safety.ts`. Written by us and **not reviewed yet**: they need a counsellor and native speakers (hi, mr, zh).

## 5. Spike results and Nexconn gotchas

See `docs/SPIKES.md`. Learned since then:

- Server-sent stream messages never fire `onMessageReceived` on web (SDK 26.2.1). Not reported upstream yet.
- Nexconn has no server call to clear a chat's history; the SDK only clears it for the signed-in user (`deleteMessagesForMeByTimestamp`).
- Voice notes are `RC:HQVCMsg`, sent with `Helper.createSendHDVoiceMessageParams`; files are stored on `*.ronghub.com` (the API only fetches audio from that host list).
- Render: `fromService … property: host` gives an internal hostname, so `render.yaml` uses explicit public URLs.
- Login endpoints are rate-limited in memory (20 per 10 min per IP); restarting the API resets the limit.

## 6. Open issues and next steps (in priority order)

1. Pilot: 5–10 classmates as students + 1–2 as mentors; send one round a week; collect quotes (business/traction is 20% of the score).
2. Counsellor and native-speaker review of the safety lists and the hi/mr/zh UI strings.
3. Change `DEMO_PASSCODE` on Render and locally; put the new one only in the write-up.
4. Write-up PDF (`docs/WRITEUP.md` is the draft) and the demo video (script in the same file).
5. Optional: post the stream-message bug on `NexconnAI-Dev/hackathon` (needs Aditya's OK).

Open Nexconn support issues (GitHub links): none yet.

## 7. Pilot

- Who's in it, and the contact person at the college/hostel: _(fill in)_
- Feedback form link: _(fill in)_
- Numbers so far (active users, pulses answered, flags, conversations): warden overview → "Pilot so far"; MAU in the Nexconn console.
- Promises made to pilot users (data, removal, timeline): `docs/pilot/PRIVACY.md` (version 2026-11-01): mentors see only their own students; wardens see counts only; deletion on request with `campus forget`.

## 8. Om's confirmation

- [ ] Cloned fresh, ran locally from the README alone
- [ ] Deployed once without help
- [ ] Logged into every account in §2
- [ ] Sent a pulse → saw a flag → sent an opening line → read the translated reply
- [ ] Knows the cut list and the submission checklist (spec §10)
- [ ] Knows how to reach Aditya after handover:
