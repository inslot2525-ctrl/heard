import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { codePrefix, createJoinCodes, provisionCampus } from './campus.js';
import { openDb } from './db/client.js';
import { invites } from './db/schema.js';

describe('join codes for a real campus', () => {
  it('gives hostels named "Hostel A/B/C" distinct prefixes', () => {
    expect(codePrefix('Godavari Hostel')).toBe('Godavari Hostel'); // newJoinCode trims to GODAV
    expect(['Hostel A', 'Hostel B', 'Hostel C'].map(codePrefix)).toEqual(['HostA', 'HostB', 'HostC']);
    expect(codePrefix('Block 12')).toBe('Blo12');
  });

  it('limits uses per role', async () => {
    const { db, close } = await openDb({ memory: true });
    try {
      await provisionCampus(db, null, { id: 'testuni', name: 'Test Uni', hostels: [{ id: 'hostelA', name: 'Hostel A' }], isPilot: true });
      await createJoinCodes(db, 'testuni', { maxUsesByRole: { student: 10, mentor: 3, warden: 1 } });
      const rows = await db.select().from(invites).where(eq(invites.campusId, 'testuni'));
      const by = Object.fromEntries(rows.map((r) => [r.role, r]));
      expect(by.student.code).toMatch(/^HOSTA-/);
      expect([by.student.maxUses, by.mentor.maxUses, by.warden.maxUses]).toEqual([10, 3, 1]);
    } finally {
      await close();
    }
  });
});
