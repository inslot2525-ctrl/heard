// Database schema (spec §7). IDs that are also Nexconn IDs (campus = community channel,
// hostel = subchannel, user = Nexconn user) are letters and digits only, as Nexconn requires.

import { boolean, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const ROLES = ['student', 'mentor', 'warden', 'bot'] as const;
export type Role = (typeof ROLES)[number];
export const LANGS = ['en', 'hi', 'mr'] as const;
export type Lang = (typeof LANGS)[number];
export const FLAG_STATUSES = ['open', 'contacted', 'resolved', 'dismissed'] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** One campus = one Nexconn community channel (same ID). */
export const campuses = pgTable('campuses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** False for the seeded demo campus; true for real pilot campuses. */
  isPilot: boolean('is_pilot').notNull().default(false),
  createdAt: createdAt(),
});

/** One hostel = one public subchannel in the campus community (subchannel ID ≤ 20 chars). */
export const hostels = pgTable('hostels', {
  id: text('id').primaryKey(),
  campusId: text('campus_id').notNull().references(() => campuses.id),
  name: text('name').notNull(),
  subchannelId: text('subchannel_id').notNull(),
});

export const users = pgTable(
  'users',
  {
    /** Also the Nexconn user ID. */
    id: text('id').primaryKey(),
    campusId: text('campus_id').notNull().references(() => campuses.id),
    role: text('role', { enum: ROLES }).notNull(),
    name: text('name').notNull(),
    lang: text('lang', { enum: LANGS }).notNull().default('en'),
    hostelId: text('hostel_id').references(() => hostels.id),
    /** Seeded fake users for the demo. Never mixed with pilot data. */
    isDemo: boolean('is_demo').notNull().default(false),
    /** sha256 of the personal login code (shown to the user once). Never store the code itself. */
    loginCodeHash: text('login_code_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('users_campus_idx').on(t.campusId), uniqueIndex('users_login_code_uq').on(t.loginCodeHash)],
);

/** Join codes. The code decides campus, role and hostel, so nobody picks their own role. */
export const invites = pgTable('invites', {
  code: text('code').primaryKey(),
  campusId: text('campus_id').notNull().references(() => campuses.id),
  role: text('role', { enum: ROLES }).notNull(),
  hostelId: text('hostel_id').references(() => hostels.id),
  maxUses: integer('max_uses').notNull().default(100),
  uses: integer('uses').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: createdAt(),
});

/** Each student has at most one mentor. */
export const mentorAssignments = pgTable('mentor_assignments', {
  studentId: text('student_id')
    .primaryKey()
    .references(() => users.id),
  mentorId: text('mentor_id')
    .notNull()
    .references(() => users.id),
});

/** Weekly pulse answers. Levels: 2 good, 1 ok, 0 struggling. One row per student per ISO week. */
export const pulses = pgTable(
  'pulses',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    week: text('week').notNull(),
    studies: smallint('studies').notNull(),
    money: smallint('money').notNull(),
    health: smallint('health').notNull(),
    home: smallint('home').notNull(),
    note: text('note'),
    wantsToTalk: boolean('wants_to_talk').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('pulses_student_week_uq').on(t.studentId, t.week)],
);

export const flags = pgTable(
  'flags',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    mentorId: text('mentor_id')
      .notNull()
      .references(() => users.id),
    rule: text('rule').notNull(),
    // '' for rules without an area, so the dedupe index below works (NULLs never collide)
    area: text('area').notNull().default(''),
    week: text('week').notNull(),
    reason: text('reason').notNull(),
    /** FlagHit history + student words, as shown on the FlagCard. */
    evidence: jsonb('evidence').notNull(),
    status: text('status', { enum: FLAG_STATUSES }).notNull().default('open'),
    openerDraft: text('opener_draft'),
    openerSent: text('opener_sent'),
    dismissReason: text('dismiss_reason'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('flags_mentor_status_idx').on(t.mentorId, t.status),
    // the same rule/area can't open twice in the same week
    uniqueIndex('flags_dedupe_uq').on(t.studentId, t.rule, t.area, t.week),
  ],
);

export const safetyEvents = pgTable('safety_events', {
  id: text('id').primaryKey(),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id),
  messageId: text('message_id'),
  matchedTerm: text('matched_term').notNull(),
  alertedAt: timestamp('alerted_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const consents = pgTable(
  'consents',
  {
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind', { enum: ['parent_digest'] }).notNull(),
    granted: boolean('granted').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.kind] })],
);
