// Safety path (spec F7). Fixed keyword lists matched in code: never an LLM, never a score.
// On a match: the student immediately gets helpline info, their mentor gets an urgent flag, and every
// warden on the campus gets a direct alert. The bot never gives crisis advice.
// The lists are deliberately short and specific. Have a counsellor and native speakers review them
// before the pilot; false negatives matter more than false positives here.

import { HELPLINES, MSG, type SafetyCard } from '@heard/shared';
import { and, eq } from 'drizzle-orm';
import { botIdFor } from './campus.js';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { flags, mentorAssignments, safetyEvents, users } from './db/schema.js';
import { isoWeek } from '@heard/shared';
import { newId } from './ids.js';
import { NexconnError } from './nexconn.js';

export type SafetyKind = 'self_harm' | 'ragging';

const TERMS: Record<SafetyKind, string[]> = {
  self_harm: [
    // English
    'suicide', 'suicidal', 'kill myself', 'killing myself', 'end my life', 'ending my life', 'want to die',
    'wanna die', 'better off dead', 'no reason to live', 'self harm', 'self-harm', 'hurt myself', 'cut myself',
    // Hindi
    'आत्महत्या', 'खुदकुशी', 'ख़ुदकुशी', 'मरना चाहता', 'मरना चाहती', 'जान दे दूँ', 'जान दे दूं', 'जीना नहीं चाहता', 'जीना नहीं चाहती',
    // Marathi
    'मरायचे आहे', 'मरायचंय', 'जीव द्यायचा', 'जगायचे नाही', 'जगायचं नाही', 'जीव देईन',
    // Chinese
    '自杀', '不想活', '想死', '结束生命', '伤害自己', '割腕',
  ],
  ragging: ['ragging', 'ragged', 'रैगिंग', 'रॅगिंग', '霸凌'],
};


function normalize(text: string) {
  return text.toLowerCase().normalize('NFC').replace(/\s+/g, ' ');
}

/** The first matching term, or null. Pure; easy to test and review. */
export function matchSafety(text: string): { kind: SafetyKind; term: string } | null {
  const t = normalize(text);
  for (const kind of Object.keys(TERMS) as SafetyKind[]) {
    for (const term of TERMS[kind]) if (t.includes(term)) return { kind, term };
  }
  return null;
}

/**
 * Run the safety path for a student's text. Returns the match (or null). Safe to call on every
 * message: it does nothing without a match.
 */
export async function checkAndAlert(db: Db, chat: Chat | null, studentId: string, text: string, messageId?: string, now = new Date()) {
  const hit = matchSafety(text);
  if (!hit) return null;
  const [student] = await db.select().from(users).where(eq(users.id, studentId));
  if (!student || student.role !== 'student') return null;

  const [claimed] = await db
    .insert(safetyEvents)
    .values({ id: newId('x'), studentId, messageId: messageId ?? null, matchedTerm: hit.term, alertedAt: now })
    .onConflictDoNothing()
    .returning();
  if (!claimed) return { ...hit, flagId: null, duplicate: true as const }; // already alerted for this message

  const [assignment] = await db.select().from(mentorAssignments).where(eq(mentorAssignments.studentId, studentId));
  const wardens = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.campusId, student.campusId), eq(users.role, 'warden')));

  const reason =
    hit.kind === 'ragging'
      ? 'Mentioned ragging in a message. Please check on them today.'
      : 'Wrote something that may mean they are not safe. Please contact them now; helpline details were shown to them.';
  let flagId: string | null = null;
  if (assignment) {
    const [f] = await db
      .insert(flags)
      .values({
        id: newId('f'),
        studentId,
        mentorId: assignment.mentorId,
        rule: hit.kind === 'ragging' ? 'safety_ragging' : 'safety',
        area: '',
        week: isoWeek(now),
        reason,
        evidence: { history: null, studentWords: text.slice(0, 500) },
        openerDraft: null,
      })
      .onConflictDoNothing()
      .returning();
    flagId = f?.id ?? null;
  }

  if (chat) {
    const bot = botIdFor(student.campusId);
    const send = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        console.error(`safety: ${label} failed`, e instanceof NexconnError ? JSON.stringify(e.body) : e);
      }
    };
    if (hit.kind === 'self_harm') {
      const card: SafetyCard = { helplines: HELPLINES };
      await send('helpline card', () =>
        chat.sendDirect({ from: bot, to: [studentId], messageType: MSG.SafetyCard, content: JSON.stringify(card), pushContent: 'You are not alone. Help is available now.' }),
      );
    }
    const staff = [...(assignment ? [assignment.mentorId] : []), ...wardens.map((w) => w.id)];
    if (staff.length) {
      const alert = `URGENT: ${student.name}. ${reason}`;
      await send('staff alert', () =>
        chat.sendDirect({ from: bot, to: staff, messageType: 'RC:TxtMsg', content: JSON.stringify({ content: alert }), pushContent: alert }),
      );
    }
  }
  return { ...hit, flagId };
}
