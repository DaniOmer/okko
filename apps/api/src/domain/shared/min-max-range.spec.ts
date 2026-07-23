import { MinMaxRange, MinMaxRangeError } from './min-max-range';

describe('MinMaxRange', () => {
  it('crée et round-trip avec unité', () => {
    const r = MinMaxRange.create({ min: 10, max: 30, unit: 'j' });
    expect(r.min).toBe(10); expect(r.max).toBe(30); expect(r.unit).toBe('j');
    expect(r.toJSON()).toEqual({ min: 10, max: 30, unit: 'j' });
  });
  it('accepte min == max et omet unit absente', () => {
    expect(MinMaxRange.create({ min: 5, max: 5 }).toJSON()).toEqual({ min: 5, max: 5 });
  });
  it('rejette min > max', () => {
    expect(() => MinMaxRange.create({ min: 30, max: 10 })).toThrow(MinMaxRangeError);
  });
});
