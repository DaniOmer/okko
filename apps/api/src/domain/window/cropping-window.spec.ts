import { CroppingWindow } from './cropping-window';
import { TechnicalOperation } from './technical-operation';
import { OperationType } from './operation-type';
import { TranslatableText } from '../shared/translatable-text';

describe('CroppingWindow', () => {
  const base = () => CroppingWindow.create({
    id: 'w-1', cropId: 'crop-1', zoneId: 'zone-1', season: 'Saison sèche',
    sowingStart: 'novembre', sowingEnd: 'février', irrigationRequired: true,
    operations: [
      TechnicalOperation.create({ type: OperationType.PLANTING, label: TranslatableText.create({ fr: 'Semis' }), timingDays: 0 }),
    ],
    notes: 'Irrigation obligatoire',
  });

  it('exposes its attributes', () => {
    const w = base();
    expect(w.cropId).toBe('crop-1');
    expect(w.zoneId).toBe('zone-1');
    expect(w.season).toBe('Saison sèche');
    expect(w.irrigationRequired).toBe(true);
    expect(w.operations).toHaveLength(1);
  });

  it('round-trips through snapshot', () => {
    const restored = CroppingWindow.fromSnapshot(base().toSnapshot());
    expect(restored.season).toBe('Saison sèche');
    expect(restored.operations[0].label.getOrDefault('fr')).toBe('Semis');
  });

  it('defaults irrigationRequired to false and operations to []', () => {
    const w = CroppingWindow.create({ id: 'w', cropId: 'c', zoneId: 'z', season: 'Pluies' });
    expect(w.irrigationRequired).toBe(false);
    expect(w.operations).toEqual([]);
  });
});
