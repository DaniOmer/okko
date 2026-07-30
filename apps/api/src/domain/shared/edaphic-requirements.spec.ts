import { EdaphicRequirements } from './edaphic-requirements';
import { RangeValue } from './range-value';
import { Provenance } from './provenance';

describe('EdaphicRequirements', () => {
  it('holds pH range, texture, drainage and round-trips through JSON', () => {
    const e = EdaphicRequirements.create({
      ph: RangeValue.create({ min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' }),
      texture: 'limono-sableux',
      drainage: 'bon',
      provenance: Provenance.external({ sourceRef: 'iSDAsoil', capturedAt: '2026-07-02' }),
      notes: 'Craint l\'engorgement',
    });
    const restored = EdaphicRequirements.fromJSON(e.toJSON());
    expect(restored.ph?.optimal).toBe(6.5);
    expect(restored.texture).toBe('limono-sableux');
    expect(restored.drainage).toBe('bon');
    expect(restored.provenance?.sourceRef).toBe('iSDAsoil');
    expect(restored.notes).toBe('Craint l\'engorgement');
  });

  it('allows an empty requirement', () => {
    const e = EdaphicRequirements.create({});
    expect(e.ph).toBeUndefined();
    expect(e.toJSON().ph).toBeUndefined();
  });
});

describe('EdaphicRequirements — profondeur / fertilité / salinité (ECOCROP)', () => {
  it('round-trip conserve soilDepth, fertilityRequirement, salinityTolerance', () => {
    const e = EdaphicRequirements.create({
      soilDepth: RangeValue.create({ min: 60, optimal: 100, max: 150, unit: 'cm' }),
      fertilityRequirement: 'MEDIUM',
      salinityTolerance: 'SENSITIVE',
    });
    const json = e.toJSON();
    expect(json.soilDepth).toEqual({ min: 60, optimal: 100, max: 150, unit: 'cm' });
    expect(json.fertilityRequirement).toBe('MEDIUM');
    expect(json.salinityTolerance).toBe('SENSITIVE');
    const back = EdaphicRequirements.fromJSON(json);
    expect(back.soilDepth?.optimal).toBe(100);
    expect(back.fertilityRequirement).toBe('MEDIUM');
    expect(back.salinityTolerance).toBe('SENSITIVE');
  });
  it('champs absents → undefined', () => {
    const json = EdaphicRequirements.create({}).toJSON();
    expect(json.soilDepth).toBeUndefined();
    expect(json.fertilityRequirement).toBeUndefined();
    expect(json.salinityTolerance).toBeUndefined();
  });
});
