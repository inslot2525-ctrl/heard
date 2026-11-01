# Heard pilot: privacy notice

Version **2026-11-01** (`PRIVACY_NOTICE_VERSION` in `packages/shared/src/messages.ts`; bump it when this changes,
and update the in-app text in `apps/web/src/i18n.ts`, keys `privacy1`–`privacy5`). Everyone sees the short form in
their language and must tick "I understand and agree" before joining; the version they agreed to is recorded.

## The short form (shown in the app)

- Your check-ins and notes are seen only by your mentor, never by other students.
- Wardens see totals (how many students checked in), not your answers.
- If you write something that suggests you may not be safe, your mentor and warden are alerted so they can help.
- Chat runs on Nexconn; some messages are translated by Google Gemini.
- This is a pilot. Ask your warden to delete your data at any time.

## The detail

**Who runs it.** Heard is a student project built for the Nexconn Build Challenge 2026 by <team names>. Contact:
<email>. The pilot runs at <college / hostel> with the warden's permission from <date> to <date>.

**What we store** (Neon Postgres, Singapore):
- your name, language, hostel, role, and which mentor you're assigned to;
- your weekly check-in answers and optional notes;
- "flags" for your mentor (e.g. "struggling with money two weeks running"), and what your mentor did about them;
- safety alerts, if any keyword matched.

**What Nexconn stores** (Singapore data centre): your chat messages, check-in cards and profile name, so chat works.

**What Google Gemini sees:** the text of a message when it's translated between an Indian language and another
language, and questions you ask the Heard Assistant. Requests go to Google's Gemini API; we don't store them there.

**What we don't do:** no risk scores, no labels, no diagnosis. The AI never contacts you on its own: mentors read
the evidence and decide. Your answers are never shown to other students, and the warden sees only counts. The
exception is safety: if a message suggests you may not be safe, your mentor and the warden get your name and the
message so they can reach you, and you're shown helplines (Tele-MANAS 14416, 112).

**Deletion.** Ask your warden or email <email>. We delete you from our database and from Nexconn (profile and
message history) using `campus forget`, usually the same day, and confirm.

**After the pilot.** The data is deleted when the pilot ends, unless the hostel decides to keep using Heard; in
that case you'll be told and can ask for deletion any time.
