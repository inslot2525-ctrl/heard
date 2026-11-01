// The fake demo campus. Everything here is invented; no real people or places.
// Four students carry designed stories (one per flag rule); everyone else is steady and must
// never trigger a flag. demo.test.ts checks both.

import { lastWeeks, type PulseLevel } from '@heard/shared';
import type { CampusSpec } from './campus.js';
import type { Lang, Role } from './db/schema.js';

export const DEMO_CAMPUS: CampusSpec = {
  id: 'heardDemo',
  name: 'Sahyadri College (demo)',
  hostels: [
    { id: 'hostelA', name: 'Godavari Hostel' },
    { id: 'hostelB', name: 'Krishna Hostel' },
  ],
};

export interface DemoPerson {
  id: string;
  name: string;
  role: Exclude<Role, 'bot'>;
  lang: Lang;
  hostel?: 'hostelA' | 'hostelB';
  mentor?: string;
}

export const DEMO_STAFF: DemoPerson[] = [
  { id: 'demorao', name: 'Prof. Anil Rao', role: 'mentor', lang: 'en' },
  { id: 'demokulkarni', name: 'Dr. Meera Kulkarni', role: 'mentor', lang: 'mr' },
  { id: 'demosingh', name: 'Prof. Harpreet Singh', role: 'mentor', lang: 'hi' },
  { id: 'demowarden', name: 'Mrs. Sunita Shinde', role: 'warden', lang: 'mr' },
];

const MENTOR_IDS = ['demorao', 'demokulkarni', 'demosingh'];

/** Students with a story. Levels per week, oldest first: [studies, money, health, home]. null = no reply. */
type Week = [PulseLevel, PulseLevel, PulseLevel, PulseLevel] | null;
interface Story extends DemoPerson {
  weeks: Week[];
  note?: string;
  /** Fixed tags for the hand-written demo notes (live notes are tagged by Gemini). */
  themes?: string[];
  wantsToTalk?: boolean;
}

const STORIES: Story[] = [
  {
    // repeat_struggling (money): the main demo story
    id: 'demopriya', name: 'Priya Patil', role: 'student', lang: 'mr', hostel: 'hostelA', mentor: 'demorao',
    weeks: [[2, 2, 2, 2], [2, 2, 2, 1], [2, 2, 2, 2], [1, 1, 2, 2], [1, 0, 2, 2], [1, 0, 2, 1]],
    note: 'या महिन्याची फी भरायला मदत हवी आहे',
    themes: ['fees_money'],
  },
  {
    // drop_from_baseline (health)
    id: 'demorohan', name: 'Rohan Yadav', role: 'student', lang: 'hi', hostel: 'hostelA', mentor: 'demokulkarni',
    weeks: [[2, 2, 2, 2], [2, 1, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2], [1, 2, 2, 2], [1, 2, 0, 2]],
    note: 'रात को नींद नहीं आती',
    themes: ['health_sleep'],
  },
  {
    // silent: replied for four weeks, then stopped
    id: 'demosneha', name: 'Sneha Iyer', role: 'student', lang: 'en', hostel: 'hostelB', mentor: 'demosingh',
    weeks: [[2, 2, 2, 2], [2, 2, 1, 2], [2, 1, 2, 2], [1, 2, 2, 1], null, null],
  },
  {
    // wants_to_talk
    id: 'demoaman', name: 'Aman Khan', role: 'student', lang: 'en', hostel: 'hostelB', mentor: 'demorao',
    weeks: [[2, 2, 2, 2], [2, 2, 2, 2], [1, 2, 2, 2], [1, 2, 2, 2], [2, 2, 2, 2], [1, 2, 2, 2]],
    note: 'Can we talk about my internship options?',
    themes: ['career_internship'],
    wantsToTalk: true,
  },
];

const STEADY_NAMES: [string, string, Lang][] = [
  ['demoanjali', 'Anjali Deshmukh', 'mr'],
  ['demokaran', 'Karan Mehta', 'hi'],
  ['demofatima', 'Fatima Shaikh', 'hi'],
  ['demorahul', 'Rahul Jadhav', 'mr'],
  ['demosakshi', 'Sakshi More', 'mr'],
  ['demoarjun', 'Arjun Nair', 'en'],
  ['demopooja', 'Pooja Gupta', 'hi'],
  ['demoomkar', 'Omkar Pawar', 'mr'],
  ['demoneha', 'Neha Joshi', 'en'],
  ['demovikram', 'Vikram Reddy', 'en'],
  ['demosana', 'Sana Mirza', 'hi'],
  ['demoaditi', 'Aditi Kale', 'mr'],
  ['demoyash', 'Yash Chavan', 'mr'],
  ['demoriya', 'Riya Das', 'en'],
  ['demosahil', 'Sahil Bhosale', 'mr'],
  ['demoishita', 'Ishita Sen', 'en'],
  // exchange student: shows chat translation with Chinese
  ['demolina', 'Li Na', 'zh'],
];

/** Small deterministic PRNG so the demo looks the same on every machine. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Steady students only ever answer "good" or "ok", so no rule can fire for them. */
function steadyWeeks(seed: number, n: number): Week[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => [0, 0, 0, 0].map(() => (r() < 0.75 ? 2 : 1)) as Week);
}

/** Li Na talks to an English-speaking mentor: Chinese ↔ English is the strongest translation pair. */
const MENTOR_OVERRIDE: Record<string, string> = { demolina: 'demorao' };

const STEADY: Story[] = STEADY_NAMES.map(([id, name, lang], i) => ({
  id,
  name,
  role: 'student',
  lang,
  hostel: i % 2 === 0 ? 'hostelA' : 'hostelB',
  mentor: MENTOR_OVERRIDE[id] ?? MENTOR_IDS[i % MENTOR_IDS.length],
  weeks: steadyWeeks(i + 1, 6),
}));

export const DEMO_STUDENTS: Story[] = [...STORIES, ...STEADY];

export interface DemoPulse {
  studentId: string;
  week: string;
  studies: PulseLevel;
  money: PulseLevel;
  health: PulseLevel;
  home: PulseLevel;
  note?: string;
  themes?: string[];
  wantsToTalk: boolean;
}

/** Six weeks of pulses ending with the week of `today`. The note goes on the latest reply. */
export function demoPulses(today = new Date()): DemoPulse[] {
  const weeks = lastWeeks(6, today);
  const out: DemoPulse[] = [];
  for (const s of DEMO_STUDENTS) {
    const lastReplied = s.weeks.findLastIndex((w) => w !== null);
    s.weeks.forEach((w, i) => {
      if (!w) return;
      const latest = i === lastReplied && i === s.weeks.length - 1;
      out.push({
        studentId: s.id,
        week: weeks[i],
        studies: w[0],
        money: w[1],
        health: w[2],
        home: w[3],
        note: latest ? s.note : undefined,
        themes: latest ? s.themes : undefined,
        wantsToTalk: latest ? Boolean(s.wantsToTalk) : false,
      });
    });
  }
  return out;
}

/** Story IDs and the rule each should trigger, for tests and the demo script. */
export const DEMO_EXPECTED_FLAGS: Record<string, string> = {
  demopriya: 'repeat_struggling',
  demorohan: 'drop_from_baseline',
  demosneha: 'silent',
  demoaman: 'wants_to_talk',
};
