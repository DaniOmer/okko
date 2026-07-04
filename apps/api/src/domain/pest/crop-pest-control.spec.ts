import { CropPestControl } from './crop-pest-control';
import { SusceptibilityLevel } from './susceptibility-level';
import { ControlMethod } from './control-method';
import { ControlCategory } from './control-category';
import { TranslatableText } from '../shared/translatable-text';
import { Provenance, ProvenanceSource } from '../shared/provenance';

describe('CropPestControl', () => {
  const base = () => CropPestControl.create({
    cropId: 'crop-1', pestId: 'pest-1',
    susceptibility: SusceptibilityLevel.HIGH,
    sensitiveStages: ['maturation des fruits'],
    threshold: '3 captures/piège/semaine',
    controlMethods: [
      ControlMethod.create({ category: ControlCategory.PREVENTION, description: TranslatableText.create({ fr: 'Ensachage' }) }),
    ],
    provenance: Provenance.external({ sourceRef: 'IITA', capturedAt: '2026-07-04' }),
  });

  it('exposes its attributes', () => {
    const c = base();
    expect(c.cropId).toBe('crop-1');
    expect(c.pestId).toBe('pest-1');
    expect(c.susceptibility).toBe(SusceptibilityLevel.HIGH);
    expect(c.sensitiveStages).toEqual(['maturation des fruits']);
    expect(c.threshold).toBe('3 captures/piège/semaine');
    expect(c.controlMethods).toHaveLength(1);
  });

  it('round-trips through snapshot including provenance and control methods', () => {
    const restored = CropPestControl.fromSnapshot(base().toSnapshot());
    expect(restored.controlMethods[0].description.getOrDefault('fr')).toBe('Ensachage');
    expect(restored.provenance?.source).toBe(ProvenanceSource.EXTERNAL);
  });

  it('defaults sensitiveStages and controlMethods to []', () => {
    const c = CropPestControl.create({ cropId: 'c', pestId: 'p', susceptibility: SusceptibilityLevel.LOW });
    expect(c.sensitiveStages).toEqual([]);
    expect(c.controlMethods).toEqual([]);
  });
});
