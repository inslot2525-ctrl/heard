import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { addToCampusChat, adoptUnassignedStudents, leastLoadedMentor } from '../campus.js';
import type { Chat } from '../chat.js';
import type { Db } from '../db/client.js';
import { campuses, hostels, invites, LANGS, mentorAssignments, users, type Lang } from '../db/schema.js';
import { newId } from '../ids.js';
import { NexconnError } from '../nexconn.js';
import { createSession, requireSession, type AuthVars } from '../session.js';

export interface AuthDeps {
  db: Db;
  chat: Chat | null;
  sessionSecret: string;
  demoPasscode?: string;
}

function cleanName(name: unknown) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 64) : '';
}

export function authRoutes({ db, chat, sessionSecret, demoPasscode }: AuthDeps) {
  const r = new Hono<AuthVars>();

  /**
   * Join a campus with a code. The code decides campus, role and hostel.
   * Body: { code, name, lang } → { session, user }
   */
  r.post('/join', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { code?: string; name?: string; lang?: string };
    const code = body.code?.trim().toUpperCase();
    const name = cleanName(body.name);
    const lang = (LANGS as readonly string[]).includes(body.lang ?? '') ? (body.lang as Lang) : 'en';
    if (!code) return c.json({ error: 'missing_code' }, 400);
    if (name.length < 2) return c.json({ error: 'missing_name' }, 400);

    // Claim one use atomically, so a code can't be over-used by parallel joins.
    const [invite] = await db
      .update(invites)
      .set({ uses: sql`${invites.uses} + 1` })
      .where(
        and(
          eq(invites.code, code),
          lt(invites.uses, invites.maxUses),
          or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
        ),
      )
      .returning();
    if (!invite) return c.json({ error: 'bad_code' }, 404);
    if (invite.role === 'bot') return c.json({ error: 'bad_code' }, 404);

    const user = {
      id: newId(invite.role === 'student' ? 's' : invite.role === 'mentor' ? 'm' : 'w'),
      campusId: invite.campusId,
      role: invite.role,
      name,
      lang,
      hostelId: invite.hostelId,
    };
    await db.insert(users).values(user);

    if (user.role === 'student') {
      const mentorId = await leastLoadedMentor(db, user.campusId);
      if (mentorId) await db.insert(mentorAssignments).values({ studentId: user.id, mentorId });
    } else if (user.role === 'mentor') {
      await adoptUnassignedStudents(db, user.campusId, user.id);
    }

    if (chat) {
      try {
        await chat.issueAccessToken(user.id, user.name); // registers the user on Nexconn
        await addToCampusChat(chat, user);
      } catch (e) {
        // The account exists; chat membership can be repaired by rerunning the campus sync.
        console.error('join: chat setup failed', user.id, e instanceof NexconnError ? JSON.stringify(e.body) : e);
      }
    }

    const session = await createSession(sessionSecret, { sub: user.id, campusId: user.campusId, role: user.role });
    return c.json({ session, user });
  });

  /** Log in as a seeded demo persona. Only users marked isDemo; needs DEMO_PASSCODE. */
  r.post('/demo-login', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { passcode?: string; userId?: string };
    if (!demoPasscode || body.passcode !== demoPasscode) return c.json({ error: 'bad_passcode' }, 401);
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, body.userId ?? ''), eq(users.isDemo, true)));
    if (!user || user.role === 'bot') return c.json({ error: 'unknown_demo_user' }, 404);
    const session = await createSession(sessionSecret, { sub: user.id, campusId: user.campusId, role: user.role });
    return c.json({ session, user });
  });

  /** Demo personas for the login screen (names and roles only). */
  r.get('/demo-users', async (c) => {
    const rows = await db
      .select({ id: users.id, name: users.name, role: users.role, campusId: users.campusId })
      .from(users)
      .where(eq(users.isDemo, true));
    return c.json(rows.filter((u) => u.role !== 'bot'));
  });

  r.use('/me', requireSession(sessionSecret));
  r.get('/me', async (c) => {
    const { sub } = c.get('session');
    const [row] = await db
      .select({ user: users, campus: campuses, hostel: hostels })
      .from(users)
      .innerJoin(campuses, eq(campuses.id, users.campusId))
      .leftJoin(hostels, eq(hostels.id, users.hostelId))
      .where(eq(users.id, sub));
    if (!row) return c.json({ error: 'not_found' }, 404);
    let mentor: { id: string; name: string } | null = null;
    if (row.user.role === 'student') {
      const [m] = await db
        .select({ id: users.id, name: users.name })
        .from(mentorAssignments)
        .innerJoin(users, eq(users.id, mentorAssignments.mentorId))
        .where(eq(mentorAssignments.studentId, sub));
      mentor = m ?? null;
    }
    return c.json({ ...row, mentor });
  });

  /** Nexconn access token for the logged-in user (the App Secret stays on the server). */
  r.use('/nexconn-token', requireSession(sessionSecret));
  r.post('/nexconn-token', async (c) => {
    if (!chat) return c.json({ error: 'nexconn_not_configured' }, 503);
    const { sub } = c.get('session');
    const [user] = await db.select().from(users).where(eq(users.id, sub));
    if (!user) return c.json({ error: 'not_found' }, 404);
    try {
      const { accessToken } = await chat.issueAccessToken(user.id, user.name);
      return c.json({ userId: user.id, token: accessToken });
    } catch (e) {
      console.error('nexconn-token failed', e instanceof NexconnError ? JSON.stringify(e.body) : e);
      return c.json({ error: 'nexconn_error' }, 502);
    }
  });

  return r;
}
