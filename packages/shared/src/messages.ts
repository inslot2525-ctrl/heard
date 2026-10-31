// Custom message types sent through Nexconn. Defined once here, used by api and web.
// Object names use our own "SA:" prefix so they never collide with Nexconn built-ins ("RC:...").

export const MSG = {
  PulseCard: 'SA:PulseCard',
  PulseResponse: 'SA:PulseResp',
  FlagCard: 'SA:FlagCard',
  Notice: 'SA:Notice',
  SafetyCard: 'SA:SafetyCard',
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
