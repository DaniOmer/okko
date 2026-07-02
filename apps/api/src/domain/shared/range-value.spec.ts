import { RangeValue, RangeValueError } from './range-value';

describe('RangeValue', () => {
  it('crée une plage valide et expose ses bornes', () => {
    const r = RangeValue.create({ min: 5, optimal: 6.5, max: 7.5, unit: 'pH' });
    expect(r.min).toBe(5);
    expect(r.optimal).toBe(6.5);
    expect(r.max).toBe(7.5);
    expect(r.unit).toBe('pH');
  });

  it('rejette min > optimal', () => {
    expect(() => RangeValue.create({ min: 7, optimal: 6, max: 8, unit: 'pH' }))
      .toThrow(RangeValueError);
  });

  it('rejette optimal > max', () => {
    expect(() => RangeValue.create({ min: 5, optimal: 9, max: 8, unit: 'pH' }))
      .toThrow(RangeValueError);
  });

  it('sérialise en objet plat', () => {
    const r = RangeValue.create({ min: 400, optimal: 800, max: 1200, unit: 'mm' });
    expect(r.toJSON()).toEqual({ min: 400, optimal: 800, max: 1200, unit: 'mm' });
  });

  it('RangeValueError.name est correctement fixé', () => {
    expect.assertions(1);
    try {
      RangeValue.create({ min: 7, optimal: 6, max: 8, unit: 'pH' });
    } catch (err) {
      expect((err as Error).name).toBe('RangeValueError');
    }
  });
});
