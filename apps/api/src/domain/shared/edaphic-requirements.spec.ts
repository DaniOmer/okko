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
