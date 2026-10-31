// The chat list for the logged-in user. The web app renders exactly this, so who-can-talk-to-whom
// lives in one place on the server.

import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { botIdFor } from '../campus.js';
import { SUB } from '../chat.js';
import type { Db } from '../db/client.js';
import { hostels, mentorAssignments, users } from '../db/schema.js';
import { requireSession, type AuthVars } from '../session.js';

export type ChatItem =
  | { kind: 'direct'; peerId: string; title: string; subtitle?: string; peerLang?: string; role: 'mentor' | 'student' | 'assistant' | 'staff' }
  | { kind: 'community'; channelId: string; subChannelId: string; title: string; subtitle?: string; canPost: boolean; role: 'hostel' | 'notices' | 'mentors' };

export function chatRoutes({ db, sessionSecret }: { db: Db; sessionSecret: string }) {
  const r = new Hono<AuthVars>();
  r.use('*', requireSession(sessionSecret));

  r.get('/', async (c) => {
    const { sub, campusId, role } = c.get('session');
    const [me] = await db.select().from(users).where(eq(users.id, sub));
    if (!me) return c.json({ error: 'not_found' }, 404);
    const allHostels = await db.select().from(hostels).where(eq(hostels.campusId, campusId)).orderBy(asc(hostels.name));
    const out: ChatItem[] = [];
    const notices: ChatItem = { kind: 'community', channelId: campusId, subChannelId: SUB.notices, title: 'Notices', role: 'notices', canPost: role === 'warden' };
    const mentorsRoom: ChatItem = { kind: 'community', channelId: campusId, subChannelId: SUB.mentors, title: 'Mentors room', subtitle: 'Mentors and wardens only', role: 'mentors', canPost: true };
    const hostelItem = (h: (typeof allHostels)[number]): ChatItem => ({ kind: 'community', channelId: campusId, subChannelId: h.subchannelId, title: h.name, role: 'hostel', canPost: true });

    if (role === 'student') {
      const [m] = await db
        .select({ id: users.id, name: users.name, lang: users.lang })
        .from(mentorAssignments)
        .innerJoin(users, eq(users.id, mentorAssignments.mentorId))
        .where(eq(mentorAssignments.studentId, sub));
      if (m) out.push({ kind: 'direct', peerId: m.id, title: m.name, subtitle: 'Your mentor', peerLang: m.lang, role: 'mentor' });
      const h = allHostels.find((x) => x.id === me.hostelId);
      if (h) out.push(hostelItem(h));
      out.push(notices);
      out.push({ kind: 'direct', peerId: botIdFor(campusId), title: 'Heard Assistant', subtitle: 'Hostel questions, any time', role: 'assistant' });
    } else if (role === 'mentor') {
      const students = await db
        .select({ id: users.id, name: users.name, lang: users.lang, hostelId: users.hostelId })
        .from(mentorAssignments)
        .innerJoin(users, eq(users.id, mentorAssignments.studentId))
        .where(eq(mentorAssignments.mentorId, sub))
        .orderBy(asc(users.name));
      for (const s of students) {
        out.push({ kind: 'direct', peerId: s.id, title: s.name, subtitle: allHostels.find((h) => h.id === s.hostelId)?.name, peerLang: s.lang, role: 'student' });
      }
      out.push(mentorsRoom, notices, ...allHostels.map(hostelItem));
    } else if (role === 'warden') {
      out.push(notices, ...allHostels.map(hostelItem), mentorsRoom);
    }
    return c.json(out);
  });

  /** Display names for user IDs in my campus (chat bubbles in group channels). */
  r.get('/people', async (c) => {
    const rows = await db
      .select({ id: users.id, name: users.name, role: users.role, lang: users.lang })
      .from(users)
      .where(and(eq(users.campusId, c.get('session').campusId)));
    return c.json(rows);
  });

  return r;
}
