import { YieldReference, InputLevel, YieldReferenceError } from './yield-reference';

describe('YieldReference', () => {
  it('creates a yield reference and round-trips through JSON', () => {
    const y = YieldReference.create({
      inputLevel: InputLevel.MEDIUM, min: 2, average: 4, potential: 6, unit: 't/ha', zoneId: 'zone-1',
    });
    const restored = YieldReference.fromJSON(y.toJSON());
    expect(restored.inputLevel).toBe(InputLevel.MEDIUM);
    expect(restored.min).toBe(2);
    expect(restored.average).toBe(4);
    expect(restored.potential).toBe(6);
    expect(restored.unit).toBe('t/ha');
    expect(restored.zoneId).toBe('zone-1');
  });

  it('rejects min > average', () => {
    expect(() => YieldReference.create({ inputLevel: InputLevel.LOW, min: 5, average: 3, potential: 6, unit: 't/ha' }))
      .toThrow(YieldReferenceError);
  });
});
