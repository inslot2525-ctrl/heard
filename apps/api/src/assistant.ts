// Heard Assistant (spec F6): answers routine hostel questions from the campus handbook, in the
// student's language. Order of checks:
//   1. safety keywords (code, not AI): the safety path takes over, no AI reply
//   2. Gemini answers ONLY from the handbook; anything else or anything personal → hand-off
//   3. hand-off: tells the student their mentor will be in touch, and opens an "asked_for_help" flag
// The reply is sent as the campus bot through Nexconn, so it shows in the student's chat.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { englishLanguageName, isoWeek, languageName, MSG, uiLangFor, type FlagCard, type UiLang } from '@heard/shared';
import { eq } from 'drizzle-orm';
import { botIdFor } from './campus.js';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { flags, mentorAssignments, users } from './db/schema.js';
import { newId } from './ids.js';
import { LlmError, type Llm } from './llm.js';
import { NexconnError } from './nexconn.js';
import { checkAndAlert } from './safety.js';

const HANDBOOK_DIR = fileURLToPath(new URL('../../../data/handbook/', import.meta.url));
const cache = new Map<string, string | null>();

export async function loadHandbook(campusId: string): Promise<string | null> {
  if (!/^[a-zA-Z0-9]+$/.test(campusId)) return null;
  if (!cache.has(campusId)) cache.set(campusId, await readFile(`${HANDBOOK_DIR}${campusId}.md`, 'utf8').catch(() => null));
  return cache.get(campusId)!;
}

export const HANDOFF = 'HANDOFF';
export const QUESTION_MAX = 1000;

export function assistantSystem(handbook: string, lang: string) {
  return [
    'You are the Heard Assistant for a college hostel. You answer routine questions about hostel life using ONLY the handbook below.',
    `Reply in ${englishLanguageName(lang)} (${languageName(lang)}, code ${lang}), in at most 3 short sentences, plainly and kindly.`,
    `Reply with exactly ${HANDOFF} and nothing else if ANY of these is true:`,
    '- the answer is not in the handbook;',
    '- the student is asking for advice about their feelings, health, family, money troubles, relationships, or a personal problem;',
    '- the student seems upset or in difficulty.',
    'Never give medical, legal or crisis advice. Never invent rules, times, numbers or names.',
    '',
    'HANDBOOK:',
    handbook,
  ].join('\n');
}

const HANDOFF_REPLY: Record<UiLang, string> = {
  en: 'I’ve passed this to your mentor, who will get back to you here soon. If it’s urgent, talk to the warden or call 112.',
  hi: 'मैंने यह आपके मेंटर तक पहुँचा दिया है। वे जल्द ही यहीं जवाब देंगे। अगर कुछ ज़रूरी है, तो वार्डन से बात करें या 112 पर कॉल करें।',
  mr: 'मी हे तुमच्या मेंटरपर्यंत पोहोचवले आहे. ते लवकरच इथे उत्तर देतील. काही तातडीचे असेल तर वॉर्डनशी बोला किंवा 112 वर कॉल करा.',
  zh: '我已经把你的问题转告给你的导师，他们很快会在这里回复你。如果情况紧急，请联系宿管或拨打 112。',
};

const UNAVAILABLE_REPLY: Record<UiLang, string> = {
  en: 'Sorry, I can’t answer right now. Please try again in a few minutes, or ask the hostel office.',
  hi: 'माफ़ कीजिए, अभी जवाब नहीं दे पा रहा। कुछ मिनट बाद फिर पूछें, या हॉस्टल ऑफ़िस से पूछें।',
  mr: 'माफ करा, आत्ता उत्तर देता येत नाही. थोड्या वेळाने पुन्हा विचारा, किंवा हॉस्टेल ऑफिसमध्ये विचारा.',
  zh: '抱歉，我现在无法回答。请几分钟后再试，或直接询问宿舍办公室。',
};

export type AssistantOutcome = 'answered' | 'handoff' | 'safety' | 'unavailable';

export async function ask(
  deps: { db: Db; chat: Chat | null; llm: Llm | null },
  student: { id: string; campusId: string },
  question: string,
  messageId?: string,
  now = new Date(),
): Promise<{ outcome: AssistantOutcome; reply?: string }> {
  const { db, chat, llm } = deps;
  const q = question.trim().slice(0, QUESTION_MAX);
  if (await checkAndAlert(db, chat, student.id, q, messageId, now)) return { outcome: 'safety' };

  const [me] = await db.select().from(users).where(eq(users.id, student.id));
  const lang = me?.lang ?? 'en';
  const ui = uiLangFor(lang);
  const handbook = await loadHandbook(student.campusId);

  let outcome: AssistantOutcome = 'handoff';
  let reply = HANDOFF_REPLY[ui];
  if (llm && handbook) {
    try {
      const out = (await llm.complete({ system: assistantSystem(handbook, lang), user: q, maxOutputTokens: 400 })).trim();
      if (out && !out.includes(HANDOFF)) {
        outcome = 'answered';
        reply = out;
      }
    } catch (e) {
      if (!(e instanceof LlmError)) throw e;
      console.error('assistant:', e.message);
      outcome = 'unavailable';
      reply = UNAVAILABLE_REPLY[ui];
    }
  }

  if (outcome === 'handoff') await openHelpFlag(db, chat, student, q, now);
  if (chat) {
    try {
      await chat.sendDirectText(botIdFor(student.campusId), student.id, reply);
    } catch (e) {
      console.error('assistant reply failed', e instanceof NexconnError ? JSON.stringify(e.body) : e);
    }
  }
  return { outcome, reply };
}

async function openHelpFlag(db: Db, chat: Chat | null, student: { id: string; campusId: string }, question: string, now: Date) {
  const [row] = await db
    .select({ mentorId: mentorAssignments.mentorId, name: users.name })
    .from(mentorAssignments)
    .innerJoin(users, eq(users.id, mentorAssignments.studentId))
    .where(eq(mentorAssignments.studentId, student.id));
  if (!row) return;
  const reason = 'Asked the assistant something it can’t answer. Their question is below.';
  // One open help flag per week; later questions update the student's words.
  const [f] = await db
    .insert(flags)
    .values({
      id: newId('f'),
      studentId: student.id,
      mentorId: row.mentorId,
      rule: 'asked_for_help',
      area: '',
      week: isoWeek(now),
      reason,
      evidence: { history: null, studentWords: question },
      openerDraft: null,
    })
    .onConflictDoUpdate({
      target: [flags.studentId, flags.rule, flags.area, flags.week],
      set: { evidence: { history: null, studentWords: question }, status: 'open' },
    })
    .returning();
  if (chat && f) {
    const card: FlagCard = { flagId: f.id, studentId: student.id, studentName: row.name, rule: 'asked_for_help', reason, studentWords: question };
    try {
      await chat.sendDirect({ from: botIdFor(student.campusId), to: [row.mentorId], messageType: MSG.FlagCard, content: JSON.stringify(card), pushContent: `${row.name} asked for help` });
    } catch (e) {
      console.error('help flag card failed', e instanceof NexconnError ? JSON.stringify(e.body) : e);
    }
  }
}
