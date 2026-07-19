import { describe, it, expect } from 'vitest';
import { tone } from './fiche-ui';

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
