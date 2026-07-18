import { ClimaticRequirements } from './climatic-requirements';
import { RangeValue } from './range-value';
import { Provenance } from './provenance';

describe('ClimaticRequirements — altitude + waterNeed + droughtSensitivity', () => {
  it('round-trip toJSON/fromJSON conserve les nouveaux champs', () => {
    const c = ClimaticRequirements.create({
      altitude: RangeValue.create({ min: 0, optimal: 800, max: 2000, unit: 'm' }),
      waterNeed: 'MEDIUM', droughtSensitivity: 'LOW',
    });
    const json = c.toJSON();
    expect(json.altitude).toEqual({ min: 0, optimal: 800, max: 2000, unit: 'm' });
    expect(json.waterNeed).toBe('MEDIUM');
    expect(json.droughtSensitivity).toBe('LOW');
    const back = ClimaticRequirements.fromJSON(json);
    expect(back.altitude?.optimal).toBe(800);
    expect(back.waterNeed).toBe('MEDIUM');
    expect(back.droughtSensitivity).toBe('LOW');
  });
  it('champs absents → undefined', () => {
    const json = ClimaticRequirements.create({}).toJSON();
    expect(json.altitude).toBeUndefined();
    expect(json.waterNeed).toBeUndefined();
    expect(json.droughtSensitivity).toBeUndefined();
  });
});

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
