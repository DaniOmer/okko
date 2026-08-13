import { daysBetween } from './days';

describe('daysBetween', () => {
  it('compte les jours UTC entiers, heures ignorées', () => {
    expect(daysBetween('2026-08-11T23:00:00.000Z', '2026-08-13T01:00:00.000Z')).toBe(2);
    expect(daysBetween('2026-08-13T00:00:00.000Z', '2026-08-13T23:00:00.000Z')).toBe(0);
  });
});
