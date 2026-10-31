# Saathi

Hostel students heard early: weekly one-tap check-ins, mentor conversations started by evidence and approved by a human, and chat in Marathi, Hindi or English. Built on the Nexconn Chat SDK for the Nexconn Build Challenge 2026 (Humanitarian & Social Good).

> Pre-build. This README is for the team; it will be replaced with the judge-facing version before submission.

- Spec: [docs/MVP-SPEC.md](docs/MVP-SPEC.md)
- Plan: [docs/PLAN.md](docs/PLAN.md)
- Handover: [HANDOVER.md](HANDOVER.md)
- Rules for Claude Code sessions: [CLAUDE.md](CLAUDE.md)

## Run locally

Needs Node 22+ and pnpm 10.

```bash
pnpm install
cp .env.example .env   # fill in the Nexconn App Key/Secret and a DEMO_PASSCODE
pnpm dev               # api on :8787, web on :5173
pnpm test              # unit tests (flag rules, Nexconn signing)
pnpm typecheck
```

Spike A: open http://localhost:5173 in two windows, log in as `alice` and `bob` with the demo passcode, and message each other.

## Layout

- `apps/api`: Hono on Node. Signs Nexconn server API calls and issues access tokens.
- `apps/web`: React + Vite. Uses the Nexconn web SDK (`@nexconn/chat` 26.2.1).
- `packages/shared`: custom message types and the flag rules (pure functions with tests).
