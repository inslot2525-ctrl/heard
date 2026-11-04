// Campus provisioning and membership: keeps our DB and the Nexconn community in step.

import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { SUB, type Chat } from './chat.js';
import type { Db } from './db/client.js';
import { campuses, hostels, invites, mentorAssignments, users, type Role } from './db/schema.js';
import { newJoinCode } from './ids.js';

export const BOT_ID_SUFFIX = 'bot';
export const botIdFor = (campusId: string) => `${campusId}${BOT_ID_SUFFIX}`;

export interface CampusSpec {
  /** letters/digits, ≤ 40 chars (used as the Nexconn community ID) */
  id: string;
  name: string;
  hostels: { id: string; name: string }[];
  isPilot?: boolean;
}

const ID_RE = /^[a-zA-Z0-9]+$/;

/**
 * Create the campus in the DB and on Nexconn: community, a notices subchannel, a private mentors
 * subchannel, one public subchannel per hostel, and the assistant bot user. Safe to rerun:
 * existing rows are kept and Nexconn "already exists" errors are ignored.
 */
export async function provisionCampus(db: Db, chat: Chat | null, spec: CampusSpec) {
  if (!ID_RE.test(spec.id) || spec.id.length > 40) throw new Error(`bad campus id ${spec.id}`);
  for (const h of spec.hostels) if (!ID_RE.test(h.id) || h.id.length > 20) throw new Error(`bad hostel id ${h.id}`);

  await db.insert(campuses).values({ id: spec.id, name: spec.name, isPilot: spec.isPilot ?? false }).onConflictDoNothing();
  for (const h of spec.hostels) {
    await db.insert(hostels).values({ id: `${spec.id}${h.id}`, campusId: spec.id, name: h.name, subchannelId: h.id }).onConflictDoNothing();
  }
  const botId = botIdFor(spec.id);
  await db
    .insert(users)
    .values({ id: botId, campusId: spec.id, role: 'bot', name: 'Heard Assistant', isDemo: !spec.isPilot })
    .onConflictDoNothing();

  if (chat) {
    const ignoreExists = (p: Promise<unknown>) => p.catch(() => undefined);
    await chat.issueAccessToken(botId, 'Heard Assistant');
    await ignoreExists(chat.createCommunity(spec.id, spec.name, botId));
    await ignoreExists(chat.createSubchannel(spec.id, SUB.notices, 0));
    await ignoreExists(chat.createSubchannel(spec.id, SUB.mentors, 1));
    for (const h of spec.hostels) await ignoreExists(chat.createSubchannel(spec.id, h.id, 0));
  }
  return { botId };
}

/** "Godavari Hostel" → GODAV; "Hostel A" → HOSTA (keep a short last word so hostels differ). */
export function codePrefix(name: string) {
  const words = name.trim().split(/\s+/);
  const last = words.at(-1) ?? '';
  return words.length > 1 && last.length <= 2 ? words[0].slice(0, 5 - last.length) + last : name;
}

/**
 * Create one join code per role (and per hostel for students). Returns code → description.
 * Use maxUsesByRole on a real campus so a leaked mentor or warden code can't be reused by others.
 */
export async function createJoinCodes(db: Db, campusId: string, opts: { maxUses?: number; maxUsesByRole?: Partial<Record<Role, number>>; expiresAt?: Date } = {}) {
  const hostelRows = await db.select().from(hostels).where(eq(hostels.campusId, campusId));
  const out: { code: string; role: Role; hostel?: string }[] = [];
  const add = async (role: Role, prefix: string, hostelId?: string, hostelName?: string) => {
    const code = newJoinCode(prefix);
    await db.insert(invites).values({ code, campusId, role, hostelId, maxUses: opts.maxUsesByRole?.[role] ?? opts.maxUses ?? 200, expiresAt: opts.expiresAt });
    out.push({ code, role, hostel: hostelName });
  };
  for (const h of hostelRows) await add('student', codePrefix(h.name), h.id, h.name); // GODAV-7K2M, HOSTA-…
  await add('mentor', 'MENTR');
  await add('warden', 'WARDN');
  return out;
}

/** Put a user into the campus community on Nexconn (and the private mentors room if staff). */
export async function addToCampusChat(chat: Chat, user: { id: string; campusId: string; role: Role }) {
  await chat.joinCommunity(user.campusId, user.id);
  if (user.role === 'mentor' || user.role === 'warden') {
    await chat.addPrivateSubchannelMembers(user.campusId, SUB.mentors, [user.id]);
  }
}

/** Mentor in the campus with the fewest students (ties: earliest joined). */
export async function leastLoadedMentor(db: Db, campusId: string) {
  const rows = await db
    .select({ id: users.id, n: sql<number>`count(${mentorAssignments.studentId})`.mapWith(Number) })
    .from(users)
    .leftJoin(mentorAssignments, eq(mentorAssignments.mentorId, users.id))
    .where(and(eq(users.campusId, campusId), eq(users.role, 'mentor')))
    .groupBy(users.id, users.createdAt)
    .orderBy(asc(sql`count(${mentorAssignments.studentId})`), asc(users.createdAt))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Give every unassigned student in the campus to this mentor (used when the first mentor joins). */
export async function adoptUnassignedStudents(db: Db, campusId: string, mentorId: string) {
  const orphans = await db
    .select({ id: users.id })
    .from(users)
    .leftJoin(mentorAssignments, eq(mentorAssignments.studentId, users.id))
    .where(and(eq(users.campusId, campusId), eq(users.role, 'student'), isNull(mentorAssignments.studentId)));
  if (orphans.length) await db.insert(mentorAssignments).values(orphans.map((o) => ({ studentId: o.id, mentorId })));
  return orphans.length;
}
