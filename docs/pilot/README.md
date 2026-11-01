# Pilot runbook

Goal: real students and mentors using Heard for about 10 days before submission. This is the evidence for the
"business & growth" criterion (20%), and the best test of the product.

**Target:** one or two hostels, about 30 students, 3 mentors, 1 warden. **Start:** Nov 12. **Freeze:** Nov 20.

## 1. Before anything is set up (people, not code)

- [ ] **Warden's permission**, in writing (an email or a WhatsApp message is enough). Show them `WARDEN.md`.
- [ ] **3 mentors** agree (faculty mentors or seniors the warden trusts). Show them `MENTOR.md`.
- [ ] **A counsellor or student-welfare officer** reads the safety keywords (`apps/api/src/safety.ts`) and the
      alert wording, and says who should be called for an urgent alert at night.
- [ ] **Hostel facts for the assistant**, from the warden: fill in the handbook (step 2). Only confirmed facts.
- [ ] **Native-speaker review** of the Marathi and Hindi app text (`apps/web/src/i18n.ts`) and the privacy notice.

## 2. Set up the campus (10 minutes)

```bash
# against production: DATABASE_URL in .env is the Neon (Singapore) URL
pnpm --filter @heard/api campus create --id <campusid> --name "<College name>" \
     --hostels "<hostelid>:<Hostel name>,<hostelid2>:<Hostel name 2>" --expires 2026-12-31
```

- IDs are letters and digits only (`sahyadri`, `hostelA`). The campus ID becomes the Nexconn community ID.
- This creates the join codes and `data/handbook/<campusid>.md` from the template. **Fill in the handbook,
  commit it, and merge**, so the deployed assistant can read it. Until then, the assistant hands every question
  to the mentor (that is safe, just less useful).

## 3. Posters and codes

```bash
pnpm --filter @heard/api campus posters --id <campusid>
```

Open `docs/pilot/out/<campusid>-posters.html` in Chrome → Print (A4).

- **Student posters** (one per hostel) go on the hostel notice board and in the WhatsApp group.
- **Mentor and warden codes** (red dashed border): hand them over privately. Anyone with the mentor code joins as
  a mentor.
- Codes expire on the date you set; reprint with `campus codes` / `campus posters` if needed.

## 4. Launch (Nov 12)

1. The warden and the mentors join first (so students are assigned to a mentor as they join).
2. A 5-minute intro at hostel dinner or in the WhatsApp group: what it is, that only their mentor sees answers,
   how to join (`STUDENT.md` has a script).
3. The warden presses **Send this week's check-in** on Monday mornings.
4. Mentors check their inbox once a day.

## 5. During the pilot

- **Warden's home screen → "Pilot so far"**: students joined, check-ins answered per week, conversations started,
  safety alerts. Screenshot it every few days for the write-up.
- **Nexconn console → Usage**: monthly active users. Screenshot it for the traction proof.
- A short feedback form (Google Form, 4 questions) on day 7: Was it easy? Did you feel heard? Would you keep
  using it? Anything to change? Ask for one quote they're happy to have used, with name or anonymous.
- The free Render plan sleeps when idle; the first open of the day can take up to a minute. Warn people once.

## 6. Deletion requests

Someone asks for their data to be deleted:

```bash
pnpm --filter @heard/api campus users --id <campusid>      # find their ID
pnpm --filter @heard/api campus forget --user <id>          # dry run: shows what will go
pnpm --filter @heard/api campus forget --user <id> --confirm
```

This removes them from the Heard database **and** soft-deletes them on Nexconn (profile and message history,
permanently). Tell them when it's done.

## 7. After the pilot

- Keep it running if the hostel wants it (the free plans allow it); otherwise tell everyone the end date and
  delete the campus data the same way.
- Numbers and quotes go into the write-up (spec §10).
