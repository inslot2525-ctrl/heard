// ISO 8601 weeks ("2026-W45"): weeks start on Monday; week 1 contains the year's first Thursday.
// Pulses are keyed by ISO week. Computed in UTC so the server's time zone never shifts a week.

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** The last `n` ISO weeks ending with the week of `date`, oldest first. */
export function lastWeeks(n: number, date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(isoWeek(new Date(date.getTime() - i * 7 * 86_400_000)));
  return out;
}
