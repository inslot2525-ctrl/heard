// Seed the fake demo campus into the database and Nexconn. Safe to rerun.
//   pnpm --filter @heard/api seed:demo           add anything missing
//   pnpm --filter @heard/api seed:demo --reset   delete demo pulses/flags first (fresh demo)
// Uses DATABASE_URL if set, otherwise the local PGlite database.

import { eq, inArray } from 'drizzle-orm';
import { addToCampusChat, createJoinCodes, provisionCampus } from '../src/campus.js';
import { openDb } from '../src/db/client.js';
import { flags, invites, mentorAssignments, pulses, users } from '../src/db/schema.js';
import { DEMO_CAMPUS, DEMO_STAFF, DEMO_STUDENTS, demoPulses } from '../src/demo.js';
import { env, nexconnConfigured } from '../src/env.js';
import { newId } from '../src/ids.js';
import { Nexconn, NexconnError } from '../src/nexconn.js';

const reset = process.argv.includes('--reset');
const chat = nexconnConfigured
  ? new Nexconn({ appKey: env.nexconnAppKey!, appSecret: env.nexconnAppSecret!, apiHost: env.nexconnApiHost })
  : null;
if (!chat) console.warn('Nexconn not configured: seeding the database only.');

const { db, close } = await openDb({ url: env.databaseUrl });
const campusId = DEMO_CAMPUS.id;
const hostelDbId = (h?: string) => (h ? `${campusId}${h}` : null);

console.log(`provisioning campus ${campusId}…`);
await provisionCampus(db, chat, DEMO_CAMPUS);

const people = [...DEMO_STAFF, ...DEMO_STUDENTS];
const demoIds = people.map((p) => p.id);

if (reset) {
  await db.delete(flags).where(inArray(flags.studentId, demoIds));
  await db.delete(pulses).where(inArray(pulses.studentId, demoIds));
  console.log('reset: demo pulses and flags deleted');
}

await db
  .insert(users)
  .values(people.map((p) => ({ id: p.id, campusId, role: p.role, name: p.name, lang: p.lang, hostelId: hostelDbId(p.hostel), isDemo: true })))
  .onConflictDoNothing();
await db
  .insert(mentorAssignments)
  .values(DEMO_STUDENTS.map((s) => ({ studentId: s.id, mentorId: s.mentor! })))
  .onConflictDoNothing();
const pulseRows = demoPulses().map((p) => ({ id: newId('p'), ...p, note: p.note ?? null }));
await db.insert(pulses).values(pulseRows).onConflictDoNothing();
console.log(`database: ${people.length} demo people, ${pulseRows.length} pulses`);

if (chat) {
  let ok = 0;
  for (const p of people) {
    try {
      await chat.issueAccessToken(p.id, p.name);
      await addToCampusChat(chat, { id: p.id, campusId, role: p.role });
      ok++;
    } catch (e) {
      console.error(`  ${p.id}: ${e instanceof NexconnError ? JSON.stringify(e.body) : e}`);
    }
  }
  console.log(`nexconn: ${ok}/${people.length} demo people registered and in the community`);
}

const existing = await db.select().from(invites).where(eq(invites.campusId, campusId));
const hostelName = (dbId: string | null) => DEMO_CAMPUS.hostels.find((h) => hostelDbId(h.id) === dbId)?.name;
const codes = existing.length
  ? existing.map((i) => ({ code: i.code, role: i.role, hostel: hostelName(i.hostelId) }))
  : await createJoinCodes(db, campusId);
console.log('\njoin codes for the demo campus:');
for (const c of codes) console.log(`  ${c.code}  ${c.role}${c.hostel ? ` · ${c.hostel}` : ''}`);
console.log('\ndemo logins (with DEMO_PASSCODE): demopriya (student), demorao (mentor), demowarden (warden)');
await close();
