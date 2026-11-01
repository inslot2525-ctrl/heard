// Set up a real (pilot) campus and print its join posters.
//
//   pnpm --filter @heard/api campus create --id sahyadri --name "Sahyadri College" \
//        --hostels "hostelA:Godavari Hostel,hostelB:Krishna Hostel" --expires 2026-12-31
//   pnpm --filter @heard/api campus posters --id sahyadri [--base https://heard-web.onrender.com]
//   pnpm --filter @heard/api campus codes --id sahyadri
//   pnpm --filter @heard/api campus users --id sahyadri
//   pnpm --filter @heard/api campus forget --user s7hk2mxq9ra --confirm    (deletion request)
//
// Uses DATABASE_URL (production Neon) when set. IDs: letters and digits only (Nexconn rule);
// campus ≤ 40 chars, hostel ≤ 20. Posters go to docs/pilot/out/ (gitignored: real codes stay private).

import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { asc, eq, or } from 'drizzle-orm';
import QRCode from 'qrcode';
import { createJoinCodes, provisionCampus } from '../src/campus.js';
import { openDb } from '../src/db/client.js';
import { campuses, consents, flags, hostels, invites, mentorAssignments, pulses, safetyEvents, users } from '../src/db/schema.js';
import { env, nexconnConfigured } from '../src/env.js';
import { Nexconn } from '../src/nexconn.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const need = (name: string) => {
  const v = opt(name);
  if (!v) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return v;
};

const { db, close } = await openDb({ url: env.databaseUrl });
console.log(`database: ${env.databaseUrl ? new URL(env.databaseUrl.replace(/^postgres(ql)?/, 'http')).host : 'local PGlite'}`);

async function codesFor(campusId: string) {
  const rows = await db.select({ invite: invites, hostel: hostels }).from(invites).leftJoin(hostels, eq(hostels.id, invites.hostelId)).where(eq(invites.campusId, campusId));
  const order = { student: 0, mentor: 1, warden: 2, bot: 3 } as const;
  return rows
    .map((r) => ({ code: r.invite.code, role: r.invite.role, hostel: r.hostel?.name, expiresAt: r.invite.expiresAt, uses: r.invite.uses, maxUses: r.invite.maxUses }))
    .sort((a, b) => order[a.role] - order[b.role] || (a.hostel ?? '').localeCompare(b.hostel ?? ''));
}

function printCodes(rows: Awaited<ReturnType<typeof codesFor>>) {
  for (const c of rows) {
    console.log(`  ${c.code.padEnd(12)} ${c.role.padEnd(8)} ${(c.hostel ?? '').padEnd(20)} used ${c.uses}/${c.maxUses}${c.expiresAt ? `  until ${c.expiresAt.toISOString().slice(0, 10)}` : ''}`);
  }
}

if (cmd === 'create') {
  const id = need('id');
  const name = need('name');
  const hostelList = need('hostels')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => {
      const [hid, ...rest] = h.split(':');
      return { id: hid.trim(), name: rest.join(':').trim() || hid.trim() };
    });
  const expires = opt('expires');
  const chat = nexconnConfigured ? new Nexconn({ appKey: env.nexconnAppKey!, appSecret: env.nexconnAppSecret!, apiHost: env.nexconnApiHost }) : null;
  if (!chat) console.warn('Nexconn not configured: creating the campus in the database only.');
  await provisionCampus(db, chat, { id, name, hostels: hostelList, isPilot: true });
  const existing = await db.select().from(invites).where(eq(invites.campusId, id));
  if (!existing.length) await createJoinCodes(db, id, { expiresAt: expires ? new Date(`${expires}T23:59:59+05:30`) : undefined });
  const handbook = `${ROOT}data/handbook/${id}.md`;
  const exists = await stat(handbook).then(() => true, () => false);
  if (!exists) await copyFile(`${ROOT}data/handbook/_TEMPLATE.md`, handbook);
  console.log(`\ncampus ${id} ("${name}") ready with ${hostelList.length} hostel(s).`);
  console.log(exists ? `handbook: ${handbook} (kept)` : `handbook: ${handbook} created from the template. Fill it in before students use the assistant.`);
  console.log('\njoin codes:');
  printCodes(await codesFor(id));
  console.log(`\nnext: pnpm --filter @heard/api campus posters --id ${id}`);
} else if (cmd === 'codes') {
  printCodes(await codesFor(need('id')));
} else if (cmd === 'posters') {
  const id = need('id');
  const base = (opt('base') ?? 'https://heard-web.onrender.com').replace(/\/$/, '');
  const [campus] = await db.select().from(campuses).where(eq(campuses.id, id));
  if (!campus) {
    console.error(`no campus ${id}`);
    process.exit(1);
  }
  const rows = await codesFor(id);
  const pages: string[] = [];
  for (const c of rows) {
    const url = `${base}/#/join/${encodeURIComponent(c.code)}`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    pages.push(poster(campus.name, c, url, svg));
  }
  const dir = `${ROOT}docs/pilot/out`;
  await mkdir(dir, { recursive: true });
  const file = `${dir}/${id}-posters.html`;
  await writeFile(file, page(campus.name, pages));
  console.log(`${rows.length} poster(s): ${file}\nOpen it in Chrome and print (A4). Student posters go up in each hostel; give mentor and warden codes privately.`);
} else if (cmd === 'users') {
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role, lang: users.lang, joined: users.createdAt })
    .from(users)
    .where(eq(users.campusId, need('id')))
    .orderBy(asc(users.role), asc(users.name));
  for (const u of rows) console.log(`  ${u.id.padEnd(14)} ${u.role.padEnd(8)} ${u.lang.padEnd(4)} ${u.joined.toISOString().slice(0, 10)}  ${u.name}`);
} else if (cmd === 'forget') {
  // A student (or mentor) asked for their data to be deleted. Removes everything Heard stores about
  // them in our database. Their chat messages live on Nexconn; see docs/pilot/PRIVACY.md for that step.
  const id = need('user');
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) {
    console.error(`no user ${id}`);
    process.exit(1);
  }
  if (u.role === 'bot') {
    console.error('refusing to delete the campus bot');
    process.exit(1);
  }
  const counts = {
    pulses: (await db.select().from(pulses).where(eq(pulses.studentId, id))).length,
    flags: (await db.select().from(flags).where(or(eq(flags.studentId, id), eq(flags.mentorId, id)))).length,
    safetyEvents: (await db.select().from(safetyEvents).where(eq(safetyEvents.studentId, id))).length,
  };
  console.log(`${u.name} (${u.role}, ${u.id}): ${JSON.stringify(counts)}`);
  if (u.role === 'mentor') console.log('note: their students become unassigned; the next mentor to join adopts them, or reassign by hand.');
  if (!args.includes('--confirm')) {
    console.log('dry run. Add --confirm to delete permanently.');
  } else {
    await db.delete(flags).where(or(eq(flags.studentId, id), eq(flags.mentorId, id)));
    await db.delete(safetyEvents).where(eq(safetyEvents.studentId, id));
    await db.delete(pulses).where(eq(pulses.studentId, id));
    await db.delete(consents).where(eq(consents.studentId, id));
    await db.delete(mentorAssignments).where(or(eq(mentorAssignments.studentId, id), eq(mentorAssignments.mentorId, id)));
    await db.delete(users).where(eq(users.id, id));
    console.log('deleted from the Heard database.');
    if (nexconnConfigured) {
      const chat = new Nexconn({ appKey: env.nexconnAppKey!, appSecret: env.nexconnAppSecret!, apiHost: env.nexconnApiHost });
      try {
        await chat.softDeleteUsers([id]);
        console.log('deleted on Nexconn (profile and message history).');
      } catch (e) {
        console.error('Nexconn deletion failed; retry with the same command:', e instanceof Error ? e.message : e);
      }
    } else console.log('Nexconn not configured here: delete the user on Nexconn separately (docs/pilot/PRIVACY.md).');
  }
} else {
  console.log('commands: create, posters, codes, users, forget (see the top of scripts/campus.ts)');
}
await close();

// ---- poster HTML -----------------------------------------------------------------------------

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

function poster(campus: string, c: { code: string; role: string; hostel?: string; expiresAt: Date | null }, url: string, svg: string) {
  const who =
    c.role === 'student'
      ? { en: `Students of ${c.hostel}`, hi: `${c.hostel} के छात्र`, mr: `${c.hostel} चे विद्यार्थी` }
      : c.role === 'mentor'
        ? { en: 'Mentors only. Do not post publicly.', hi: 'सिर्फ़ मेंटर के लिए', mr: 'फक्त मेंटरसाठी' }
        : { en: 'Wardens only. Do not post publicly.', hi: 'सिर्फ़ वार्डन के लिए', mr: 'फक्त वॉर्डनसाठी' };
  return `<section class="poster ${c.role}">
  <div class="brand">Heard</div>
  <div class="tag">Weekly one-tap check-ins · your mentor, in your language</div>
  <div class="campus">${esc(campus)}</div>
  <div class="who">${esc(who.en)}<br><span>${esc(who.hi)} · ${esc(who.mr)}</span></div>
  <div class="qr">${svg}</div>
  <div class="code">${esc(c.code)}</div>
  <ol>
    <li><b>Scan</b> with your phone camera <span>· स्कैन करें · स्कॅन करा</span></li>
    <li><b>Write your name</b>, pick your language <span>· नाम और भाषा · नाव आणि भाषा</span></li>
    <li><b>Save your login code</b> <span>· लॉगिन कोड सेव करें · लॉगिन कोड जपून ठेवा</span></li>
  </ol>
  <div class="url">${esc(url)}</div>
  <div class="fine">Only your mentor sees your check-ins. Wardens see totals only. Pilot: ask your warden to delete your data any time.${c.expiresAt ? ` Code valid until ${c.expiresAt.toISOString().slice(0, 10)}.` : ''}<br>If you are not safe right now, call Tele-MANAS 14416 (free, 24×7) or 112.</div>
</section>`;
}

function page(campus: string, posters: string[]) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Heard join posters · ${esc(campus)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { margin: 0; font-family: system-ui, 'Segoe UI', 'Nirmala UI', sans-serif; color: #1d1f24; }
  .poster { page-break-after: always; break-after: page; text-align: center; padding: 8mm 6mm; min-height: 260mm; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 4mm; }
  .poster.mentor, .poster.warden { border: 3px dashed #b4413a; }
  .brand { font-size: 42pt; font-weight: 800; color: #2f5d50; letter-spacing: -0.02em; }
  .tag { font-size: 13pt; color: #5d6270; }
  .campus { font-size: 20pt; font-weight: 700; margin-top: 3mm; }
  .who { font-size: 16pt; font-weight: 600; }
  .who span, li span { font-weight: 400; color: #5d6270; font-size: 0.85em; }
  .qr svg { width: 95mm; height: 95mm; }
  .code { font-family: ui-monospace, Consolas, monospace; font-size: 28pt; font-weight: 800; letter-spacing: 0.15em; color: #2f5d50; }
  ol { text-align: left; font-size: 14pt; line-height: 1.6; margin: 2mm 0; }
  .url { font-family: ui-monospace, Consolas, monospace; font-size: 9pt; color: #5d6270; word-break: break-all; }
  .fine { font-size: 10pt; color: #5d6270; max-width: 160mm; margin-top: auto; }
</style></head><body>
${posters.join('\n')}
</body></html>`;
}
