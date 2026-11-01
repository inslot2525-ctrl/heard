// Custom message types sent through Nexconn. Defined once here, used by api and web.
// Object names use our own "SA:" prefix so they never collide with Nexconn built-ins ("RC:...").

export const MSG = {
  PulseCard: 'SA:PulseCard',
  PulseResponse: 'SA:PulseResp',
  FlagCard: 'SA:FlagCard',
  Notice: 'SA:Notice',
  SafetyCard: 'SA:SafetyCard',
  AskAnswer: 'SA:AskAnswer',
} as const;

export type MsgObjectName = (typeof MSG)[keyof typeof MSG];

export const PULSE_AREAS = ['studies', 'money', 'health', 'home'] as const;
export type PulseArea = (typeof PULSE_AREAS)[number];

/** 2 = good, 1 = ok, 0 = struggling */
export type PulseLevel = 0 | 1 | 2;

/** Sent by the server to each student once a week. */
export interface PulseCard {
  pulseId: string;
  /** ISO week, e.g. "2026-W46" */
  week: string;
  areas: readonly PulseArea[];
}

/** Sent by the student when they tap their answers. */
export interface PulseResponse {
  pulseId: string;
  week: string;
  levels: Record<PulseArea, PulseLevel>;
  /** Optional free text, "anything on your mind?" */
  note?: string;
  /** Student tapped "I'd like to talk" */
  wantsToTalk?: boolean;
}

/** Shown to a mentor. Evidence only: no score, no label. */
export interface FlagCard {
  flagId: string;
  studentId: string;
  studentName: string;
  rule: string;
  /** Plain-English reason, shown as is. */
  reason: string;
  /** Last weeks of the area that fired, oldest first, for the sparkline. */
  history?: { week: string; level: PulseLevel | null }[];
  studentWords?: string;
}

export interface Notice {
  noticeId: string;
  title: string;
  body: string;
  requireAck: boolean;
}

/** Shown to a student right after a safety keyword match. */
export interface SafetyCard {
  helplines: { name: string; number: string }[];
  campusContact?: string;
}

/** India helplines shown on the safety card. Tele-MANAS: national tele-mental-health line, free, 24×7. */
export const HELPLINES: SafetyCard['helplines'] = [
  { name: 'Tele-MANAS (free, 24×7, many languages)', number: '14416' },
  { name: 'Tele-MANAS toll-free', number: '1-800-891-4416' },
  { name: 'Emergency', number: '112' },
];

/** Bump when the privacy notice text changes (apps/web/src/i18n.ts privacy* strings, docs/pilot/PRIVACY.md). */
export const PRIVACY_NOTICE_VERSION = '2026-11-01';

/** One claim's evidence in an Ask Heard answer; `verified` is set by code, not by the model. */
export interface AskReceipt {
  student: string;
  studentId: string | null;
  week: string;
  area: string;
  value: string;
  verified: boolean;
}

/** Ask Heard's reply to a mentor, sent by the campus bot. */
export interface AskAnswer {
  question: string;
  answer: string;
  receipts: AskReceipt[];
  unavailable?: boolean;
}

/** Topics a check-in note can be tagged with: what the student wrote ABOUT, never how they feel. */
export const THEMES = ['fees_money', 'homesick', 'exams_studies', 'health_sleep', 'mess_food', 'friends_roommates', 'family', 'career_internship', 'hostel_facilities', 'other'] as const;
export type Theme = (typeof THEMES)[number];
