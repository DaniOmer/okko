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

describe('PhenologicalStage — description + recommendedWork', () => {
  it('round-trip conserve les nouveaux champs', () => {
    const s = PhenologicalStage.create({
      name: TranslatableText.create({ fr: 'Floraison' }), startDay: 40, endDay: 55, order: 3,
      description: 'Apparition des fleurs', recommendedWork: 'Surveiller les pollinisateurs',
    });
    const json = s.toJSON();
    expect(json.description).toBe('Apparition des fleurs');
    expect(json.recommendedWork).toBe('Surveiller les pollinisateurs');
    const back = PhenologicalStage.fromJSON(json);
    expect(back.description).toBe('Apparition des fleurs');
    expect(back.recommendedWork).toBe('Surveiller les pollinisateurs');
  });
  it('champs absents → undefined', () => {
    const json = PhenologicalStage.create({ name: TranslatableText.create({ fr: 'Levée' }), startDay: 0, endDay: 7, order: 0 }).toJSON();
    expect(json.description).toBeUndefined();
    expect(json.recommendedWork).toBeUndefined();
  });
});
