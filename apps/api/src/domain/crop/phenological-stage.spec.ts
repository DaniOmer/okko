import { PhenologicalStage, PhenologicalStageError } from './phenological-stage';
import { TranslatableText } from '../shared/translatable-text';

describe('PhenologicalStage', () => {
  it('creates a stage and round-trips through JSON', () => {
    const s = PhenologicalStage.create({
      name: TranslatableText.create({ fr: 'Levée' }), startDay: 5, endDay: 12, order: 1,
    });
    const restored = PhenologicalStage.fromJSON(s.toJSON());
    expect(restored.name.getOrDefault('fr')).toBe('Levée');
    expect(restored.startDay).toBe(5);
    expect(restored.endDay).toBe(12);
    expect(restored.order).toBe(1);
  });

  it('rejects startDay > endDay', () => {
    expect(() => PhenologicalStage.create({
      name: TranslatableText.create({ fr: 'X' }), startDay: 20, endDay: 10, order: 1,
    })).toThrow(PhenologicalStageError);
  });
});
