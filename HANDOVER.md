# Handover: Aditya → Om

Aditya fills this in before the handover call (target **Mon Nov 16**). Om confirms each item in the last section. Keep it short: links and facts, not essays.

**Handover date:**
**Last commit on `main` at handover:**
**Live URLs:** web: · api:

---

## 1. Status at a glance

| Feature (spec §5) | Status | Notes / known bugs |
|---|---|---|
| F1 Sign-in & onboarding | ⬜ not started / 🟡 partial / ✅ done | |
| F2 Campus community | | |
| F3 Pulse check-in | | |
| F4 Flags + mentor inbox | | |
| F5 Translation | | |
| F6 Assistant bot | | |
| F7 Safety path | | |
| Deploy (Render + Neon) | | |
| Pilot | | users: · mentors: |

## 2. Accounts and secrets

Store values only in the team password manager, never here.

| Item | Where it lives | Who has access |
|---|---|---|
| Nexconn console login (app owner) | | |
| Nexconn App Key / App Secret | | |
| Nexconn data centre / API host | | |
| Reskilll team leader | | |
| Render | | |
| Neon (Postgres) | | |
| LLM API key | | |
| Card bound to Nexconn? (translation / moderation / calls) | yes / no | |

- [ ] Om added as a member or co-owner wherever the platform allows
- [ ] Every secret in `.env.example` has a matching value in the password manager

## 3. How to run it

```bash
# fill in the exact commands that work today
```

- Seed or reset the demo campus:
- Trigger a pulse manually:
- Run the tests:
- Deploy:

## 4. How things work (the non-obvious parts)

- Token issuing:
- Custom message types and where they render:
- Webhooks: which events, the URL, how they're verified:
- Translation setup (console switches, channel strategy):
- Bot: user ID, how replies are sent, streaming yes/no:
- Flag rules: file, how to add a rule:
- Safety keyword lists: file, who reviewed the Hindi/Marathi terms:

## 5. Spike results and Nexconn gotchas

See `docs/SPIKES.md`. Add anything learned since then:

-

## 6. Open issues and next steps (in priority order)

1.
2.
3.

Open Nexconn support issues (GitHub links):

## 7. Pilot

- Who's in it, and the contact person at the college/hostel:
- Feedback form link:
- Numbers so far (active users, pulses answered, flags, conversations):
- Promises made to pilot users (data, removal, timeline):

## 8. Om's confirmation

- [ ] Cloned fresh, ran locally from the README alone
- [ ] Deployed once without help
- [ ] Logged into every account in §2
- [ ] Sent a pulse → saw a flag → sent an opening line → read the translated reply
- [ ] Knows the cut list and the submission checklist (spec §10)
- [ ] Knows how to reach Aditya after handover:
