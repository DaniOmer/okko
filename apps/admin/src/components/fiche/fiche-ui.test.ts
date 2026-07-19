import { describe, it, expect } from 'vitest';
import { tone, optimalPercent } from './fiche-ui';

describe('tone', () => {
  it('suitability', () => {
    expect(tone('suitability', 'SUITABLE')).toBe('good');
    expect(tone('suitability', 'MARGINAL')).toBe('warn');
    expect(tone('suitability', 'UNSUITABLE')).toBe('bad');
  });
  it('susceptibility (peu sensible = bon)', () => {
    expect(tone('susceptibility', 'LOW')).toBe('good');
    expect(tone('susceptibility', 'HIGH')).toBe('bad');
  });
  it('resistance (très résistant = bon, inversé)', () => {
    expect(tone('resistance', 'HIGH')).toBe('good');
    expect(tone('resistance', 'LOW')).toBe('bad');
  });
  it('inconnu → neutral', () => {
    expect(tone('suitability', 'ZZZ')).toBe('neutral');
    expect(tone('resistance', undefined)).toBe('neutral');
  });
});

describe('optimalPercent', () => {
  it('milieu', () => { expect(optimalPercent(0, 5, 10)).toBe(50); });
  it('clampe', () => { expect(optimalPercent(10, 5, 20)).toBe(0); expect(optimalPercent(0, 30, 10)).toBe(100); });
  it('plage nulle → 50', () => { expect(optimalPercent(5, 5, 5)).toBe(50); });
});
