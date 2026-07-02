import { ClimaticRequirements } from './climatic-requirements';
import { RangeValue } from './range-value';
import { Provenance } from './provenance';

describe('ClimaticRequirements', () => {
  it('holds temperature and rainfall ranges and round-trips through JSON', () => {
    const c = ClimaticRequirements.create({
      temperature: RangeValue.create({ min: 15, optimal: 22, max: 30, unit: '°C' }),
      rainfall: RangeValue.create({ min: 400, optimal: 700, max: 1100, unit: 'mm' }),
      provenance: Provenance.external({ sourceRef: 'ECOCROP', capturedAt: '2026-07-02', confidence: 'medium' }),
      notes: 'Sensible au gel',
    });
    const restored = ClimaticRequirements.fromJSON(c.toJSON());
    expect(restored.temperature?.optimal).toBe(22);
    expect(restored.rainfall?.max).toBe(1100);
    expect(restored.notes).toBe('Sensible au gel');
    expect(restored.provenance?.sourceRef).toBe('ECOCROP');
  });

  it('allows a partial requirement (only temperature)', () => {
    const c = ClimaticRequirements.create({
      temperature: RangeValue.create({ min: 10, optimal: 18, max: 25, unit: '°C' }),
    });
    expect(c.rainfall).toBeUndefined();
    expect(c.toJSON().rainfall).toBeUndefined();
  });
});
