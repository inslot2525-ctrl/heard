// Mentor inbox. A mentor sees only their own students' flags, edits the drafted opener, and sends
// it as themselves. Dismissing needs a reason (kept for the record).

import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Chat } from '../chat.js';
import type { Db } from '../db/client.js';
import { FLAG_STATUSES, flags, interventions, users, type FlagStatus } from '../db/schema.js';
import { isoWeek } from '@heard/shared';
import { newId } from '../ids.js';
import { NexconnError } from '../nexconn.js';
import { checkOpener } from '../openers.js';
import { requireSession, type AuthVars } from '../session.js';
import { requireRole } from '../session-guards.js';

export interface FlagDeps {
  db: Db;
  chat: Chat | null;
  sessionSecret: string;
  now?: () => Date;
}

export function flagRoutes({ db, chat, sessionSecret, now = () => new Date() }: FlagDeps) {
  const r = new Hono<AuthVars>();
  r.use('*', requireSession(sessionSecret), requireRole('mentor'));

  async function ownFlag(mentorId: string, flagId: string) {
    const [row] = await db
      .select({ flag: flags, student: { id: users.id, name: users.name, lang: users.lang } })
      .from(flags)
      .innerJoin(users, eq(users.id, flags.studentId))
      .where(and(eq(flags.id, flagId), eq(flags.mentorId, mentorId)));
    return row;
  }

  /** ?status=open,contacted (default: open,contacted) */
  r.get('/', async (c) => {
    const wanted = (c.req.query('status') ?? 'open,contacted').split(',').filter((s): s is FlagStatus => (FLAG_STATUSES as readonly string[]).includes(s));
    const rows = await db
      .select({ flag: flags, student: { id: users.id, name: users.name, lang: users.lang } })
      .from(flags)
      .innerJoin(users, eq(users.id, flags.studentId))
      .where(and(eq(flags.mentorId, c.get('session').sub), inArray(flags.status, wanted.length ? wanted : ['open'])))
      .orderBy(desc(flags.createdAt));
    return c.json(rows.map(({ flag, student }) => ({ ...flag, student })));
  });

  r.get('/:id', async (c) => {
    const row = await ownFlag(c.get('session').sub, c.req.param('id'));
    if (!row) return c.json({ error: 'not_found' }, 404);
    return c.json({ ...row.flag, student: row.student });
  });

  /** Send the (edited) opener to the student, as the mentor. Body: { text } */
  r.post('/:id/opener', async (c) => {
    const mentorId = c.get('session').sub;
    const row = await ownFlag(mentorId, c.req.param('id'));
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (row.flag.status === 'resolved' || row.flag.status === 'dismissed') return c.json({ error: 'flag_closed' }, 409);
    const { text } = (await c.req.json().catch(() => ({}))) as { text?: string };
    const problem = checkOpener(text ?? '');
    if (problem) return c.json({ error: problem }, 400);
    if (chat) {
      try {
        await chat.sendDirect({
          from: mentorId,
          to: [row.student.id],
          messageType: 'RC:TxtMsg',
          content: JSON.stringify({ content: text!.trim() }),
          echo: true, // so it shows in the mentor's own chat with the student
        });
      } catch (e) {
        console.error('opener send failed', row.flag.id, e instanceof NexconnError ? JSON.stringify(e.body) : e);
        return c.json({ error: 'send_failed' }, 502);
      }
    }
    const [updated] = await db.update(flags).set({ status: 'contacted', openerSent: text!.trim() }).where(eq(flags.id, row.flag.id)).returning();
    // Reaching out counts as help, for "improved after help".
    await db.insert(interventions).values({ id: newId('i'), studentId: row.student.id, mentorId, kind: 'reached_out', week: isoWeek(now()), flagId: row.flag.id });
    return c.json(updated);
  });

  /** Body: { reason } */
  r.post('/:id/dismiss', async (c) => {
    const row = await ownFlag(c.get('session').sub, c.req.param('id'));
    if (!row) return c.json({ error: 'not_found' }, 404);
    const { reason } = (await c.req.json().catch(() => ({}))) as { reason?: string };
    if (!reason?.trim()) return c.json({ error: 'reason_required' }, 400);
    const [updated] = await db.update(flags).set({ status: 'dismissed', dismissReason: reason.trim().slice(0, 500) }).where(eq(flags.id, row.flag.id)).returning();
    return c.json(updated);
  });

  r.post('/:id/resolve', async (c) => {
    const row = await ownFlag(c.get('session').sub, c.req.param('id'));
    if (!row) return c.json({ error: 'not_found' }, 404);
    const [updated] = await db.update(flags).set({ status: 'resolved' }).where(eq(flags.id, row.flag.id)).returning();
    return c.json(updated);
  });

  return r;
}
