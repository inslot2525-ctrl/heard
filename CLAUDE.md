# Heard: rules for every Claude Code session

Two people (Aditya, Om) build this in parallel with Claude Code. Read `docs/MVP-SPEC.md` and `docs/PLAN.md` first.

## Hard rules

- **No Avlokan Setu or VSS code, data, names, screenshots or wording.** This is a new codebase built during the Nexconn challenge (Oct 23 – Nov 22, 2026).
- **Never commit secrets.** The Nexconn App Secret, DB URLs and LLM keys live in `.env` (gitignored). Update `.env.example` whenever a variable is added. The App Secret is used only by `apps/api`, never by the browser.
- **No real student data** in the repo, seeds, screenshots or the demo. Pilot data stays in the production DB only.
- **The AI never messages a student on its own.** Mentor opening lines are drafts that a human sends. Safety detection is a fixed keyword list matched in code, not an LLM.
- **Branches:** Aditya uses `aditya/*`, Om uses `om/*`. Never push to `main` directly; merge through a PR. `main` must always deploy.

## Layout

```
apps/web         React + Vite + TS on the Nexconn Chat SDK (own chat screens; no @nexconn/chatui)
apps/api         Node + TS: auth/token, campus, pulse, flags, bot, safety, webhooks
packages/shared  custom message types, flag rule definitions, shared types
data/            handbook.md (bot knowledge), seed files (fake only)
docs/            spec, plan, spikes
```

## Conventions

- Custom message type names and payloads are defined once in `packages/shared` and imported by both apps.
- Flag rules are pure functions with unit tests. Each rule has a plain-English description shown to mentors.
- User-facing strings come from one i18n file per language (en, hi, mr).
- Use the installed Nexconn AI skills when integrating the SDK. When an SDK behaviour is surprising, record it in `docs/SPIKES.md`.
- Before handing work to the other person, update `HANDOVER.md` (status table and open issues).
