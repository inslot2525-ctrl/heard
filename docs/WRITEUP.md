# Heard: write-up draft (becomes the submission PDF)

> Draft, Nov 4. Fill in the **[brackets]** before export. Keep every claim true: if a number isn't real yet, leave it out.
> Track: **Humanitarian & Social Good**. Team: Aditya Chimurkar, Om [surname], [others].

## Heard, before it's a crisis

**Live app:** https://heard-web.onrender.com · **Demo login:** "Try the demo campus", passcode **[new DEMO_PASSCODE]**
**Repo:** https://github.com/inslot2525-ctrl/rocky · **Video:** [link] · **Nexconn App Key:** [App Key]

## 1. The problem

On most Indian campuses, a mentor or warden first hears that a hostel student is struggling at an exam, a disciplinary case or a crisis. By then it is no longer a conversation. Students rarely start that conversation themselves, especially about money, homesickness or health, and many are more at ease in Marathi or Hindi than in English. Hostel communication runs on noisy group chats with no roles and no follow-up.

## 2. What Heard does

Heard is a campus chat app on the **Nexconn Chat SDK** with one idea at its core: **a person is heard early, and a person decides what happens next.**

1. **One-tap weekly check-in.** Students rate studies, money, health and home as good / ok / struggling, in under 10 seconds, with an optional note and an "I'd like to talk" button. The card arrives in chat as a Nexconn custom message.
2. **An inbox of evidence, not scores.** Plain rules (two "struggling" weeks in a row, a drop from the student's own usual, two weeks of silence, asked to talk) raise a flag for that student's mentor. Every flag shows exactly why: the week-by-week answers and the student's own words, translated. No risk scores, no labels, no AI diagnosis.
3. **The mentor starts the conversation.** Heard drafts an opening line in the student's language; the mentor edits and sends it as themselves. **Tone Guard** catches a blaming or clinical tone before it is sent. The AI never messages a student on its own.
4. **Chat that crosses languages.** Every message is translated into the reader's language with the original one tap away: Nexconn translation for most of its 211 languages, Gemini for Indian scripts (in our tests Nexconn turned a Marathi request into its opposite). The full UI is in English, Hindi, Marathi and Chinese.
5. **Safety path, in code, not AI.** Self-harm and ragging keywords (four languages) in any student message, also caught server-side by a Nexconn webhook, show the student the Tele-MANAS helpline (14416) and alert the mentor and every warden at once.
6. **Mentor tools.**
   - **Ask Heard:** a chat bot that answers questions like "who's struggling with money?" with receipts (week, area, answer), each checked against the database by code before it is shown.
   - **Meeting card:** a fact-checked brief to read before a talk.
   - **Help log:** each student's journey charts, plus a log of what the mentor did, so Heard can show whether things *improved after help*.
   - **Voice notes:** Nexconn HD voice messages, transcribed and translated.
7. **For wardens, counts, not notes.** Pilot numbers, the topics students wrote about (tagged from a fixed list, never feelings) and a **fairness check**: flag rates by hostel and by language, so a rule or translation that treats one group differently shows up.
8. **Hostel handbook assistant.** Students ask about fees, mess timings or rules in their own language. Anything personal is handed to their mentor.
9. **Hostel register: the paper the hostel already keeps.** Wardens record each student's month (attendance, marks, hostel duties, activities, conduct incidents; any column can stay empty), typed in or **read from a photo of the paper register**. The photo only fills the table: every row is highlighted for the warden to check before anything is saved, and names that match no student are listed, never guessed.
   - **Register rules**, as plain as the check-in rules: a three-month decline, a drop against the student's own usual, repeated conduct incidents (a one-off never flags). The mentor gets the card with the month-by-month numbers and the warden's remarks.
   - **Perception gap:** when the register shows a slide but the student's own check-ins say studies are "good", the card says so, as a question to ask rather than a verdict.
   - **Next-month target:** one small goal ("attendance at least 75% in December"). When the next record meets it, the flag closes by itself.
   - **Six-month review:** each criterion is OK / Watch / Concern with its evidence, plus an advisory suggestion that never goes beyond "discuss at the review meeting". The app never suggests removing a student. The mentor decides and writes the reason, which is stored next to what was suggested.

## 3. Nexconn features we use, and where

| Nexconn feature | Where in Heard |
|---|---|
| Chat SDK for Web (`@nexconn/chat` 26.2.1), with our own mobile-first React screens | every chat screen |
| Community channel + subchannels (public per hostel, private notices and mentors room) | the campus: hostels, notices, mentors' room |
| Direct channels | student ↔ mentor, student ↔ assistant, mentor ↔ Ask Heard |
| Custom messages (`SA:PulseCard`, `SA:PulseResp`, `SA:FlagCard`, `SA:Notice`, `SA:SafetyCard`, `SA:AskAnswer`) | check-ins, flags, notices, the helpline card, Ask Heard answers |
| Message translation (`translateMessages`) | chat translation for non-Indian languages (e.g. Chinese ↔ English) |
| HD voice messages | voice notes, transcribed by our API |
| Bot user sending server-side messages | Heard Assistant and Ask Heard |
| Server API (tokens, send, community and subchannel setup, user soft-delete) | sign-in, campus setup, the bot, the right to be forgotten |
| Webhooks (`message:send`, signature verified) | the safety check on every student message, server-side |
| Message history, clear-for-me | chat history; "Clear chat" |

## 4. What is new

Heard is a **new codebase built during the challenge** (Oct 31 – Nov 22, 2026); see the commit history. The concept grew out of an earlier student-support prototype by our team. No code, data or design from it is reused.

## 5. Does it work?

- **149 automated tests** across the rules, API, safety path, translation routing and AI fallbacks; every commit is gated on tests, typecheck and build.
- **Rule proof** (`docs/PROOF.md`): on synthetic cohorts with planted problems, the four inbox rules caught 100% of planted problems (all but one in the noisiest cohort). On a calm cohort about 1 in 100 ordinary students gets a flag; on a noisy one about 1 in 8, every one with its evidence on screen so a mentor can dismiss it with a reason.
- Deployed on Render + Neon in Singapore (close to Nexconn's Singapore data centre).

## 6. Traction: pilot-ready, not yet piloted

We have **not run a pilot with real students yet**, and we would rather say so than show a thin one. Heard handles
sensitive data (how a student is doing with money, health and home), so we want a college's welfare cell or a
counsellor on board before real students use it. What we have instead:

- **Ready to launch on a campus in a day:**
  - one command creates the campus with join codes (capped per role, with an expiry date) and printable QR posters,
  - a privacy notice every user must accept,
  - guides for wardens, mentors and students (`docs/pilot/`),
  - one-command deletion that also removes the user on Nexconn,
  - a warden dashboard that counts usage.
- **Pilot plan after the challenge:** one hostel, 4 weeks, with a counsellor reviewing the safety lists first. We will
  measure: weekly check-in response rate, time from flag to the mentor's first message, flags acted on vs dismissed
  (with reasons), and whether students who were helped show "improved after help".
- **Nexconn usage today:** the console shows 25 MAU. These are our 25 **demo personas**, used while building and
  testing, **not real users**.

## 7. Business

A weekly check-in creates a small, predictable load: one campus of a few thousand students fits a single Nexconn app (our Free plan alone allows 2,000 MAU). Pricing per campus per year, with analytics, SSO and counsellor integrations in the paid tier. [Check Nexconn Starter/Pro prices before quoting costs.] Buyers: college student-welfare cells and hostel administrations. [Add a source on mentoring/welfare requirements for Indian colleges if we cite one.]

## 8. Privacy and safety by design

- A privacy notice must be accepted at join; mentors see only their own students; wardens see counts, never notes.
- Deletion on request removes the student from our database and soft-deletes them on Nexconn.
- No real student data in the repo or demo; the demo campus is fake.
- Safety keywords are matched in code before any AI sees the text. [Reviewed by: counsellor / native speakers, once done.]

---

## Demo video script (≈3 min)

Before recording: `seed:demo --reset`, open `/health` on the API a minute early, clear old chats, phone-size browser window.

| Time | Who | What to show |
|---|---|---|
| 0:00 | – | **Problem** in two sentences over the landing page. |
| 0:15 | Priya (student, Marathi UI) | One-tap check-in: money "struggling" again, note "help with this month's fee". Ask the assistant about the fee deadline (answer in Marathi). |
| 0:45 | Prof. Rao (mentor, English) | Inbox: Priya's card with evidence and her words translated. Open it → meeting card → edit the drafted opener (show Tone Guard on a harsh draft) → send. |
| 1:20 | Priya | The opener arrives in Marathi; she replies in Marathi; Rao reads it in English. |
| 1:40 | Rao | Ask Heard: "who's struggling with money?" → answer with receipts. Student journey: charts, help log. |
| 2:05 | Li Na ↔ Rao | Chinese ↔ English chat (Nexconn translation). |
| 2:15 | Warden | Hostel register: photo of the paper register → rows filled and highlighted → save. Rao's inbox: Rahul's attendance card with the perception gap → set a December target. |
| 2:35 | Warden | Overview: numbers, topics, fairness check. A test safety message → helpline card + urgent alert. |
| 2:45 | – | "Pilot-ready": the campus setup command + QR poster in 5 seconds; one slide of Nexconn features used. |
