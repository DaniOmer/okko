import { TechnicalOperation } from './technical-operation';
import { OperationType } from './operation-type';
import { TranslatableText } from '../shared/translatable-text';

describe('TechnicalOperation', () => {
  it('creates an operation and round-trips through JSON', () => {
    const op = TechnicalOperation.create({
      type: OperationType.FERTILIZATION,
      label: TranslatableText.create({ fr: 'Apport NPK de fond' }),
      timingDays: 0,
      inputs: ['NPK 15-15-15'],
      notes: 'Avant semis',
    });
    const restored = TechnicalOperation.fromJSON(op.toJSON());
    expect(restored.type).toBe(OperationType.FERTILIZATION);
    expect(restored.label.getOrDefault('fr')).toBe('Apport NPK de fond');
    expect(restored.timingDays).toBe(0);
    expect(restored.inputs).toEqual(['NPK 15-15-15']);
    expect(restored.notes).toBe('Avant semis');
  });

  it('defaults inputs to an empty array', () => {
    const op = TechnicalOperation.create({
      type: OperationType.WEEDING, label: TranslatableText.create({ fr: 'Sarclage' }), timingDays: 21,
    });
    expect(op.inputs).toEqual([]);
  });
});

describe('TechnicalOperation — equipment', () => {
  it('round-trip conserve equipment', () => {
    const op = TechnicalOperation.create({
      type: OperationType.PLANTING, label: TranslatableText.create({ fr: 'Plantation' }), timingDays: 0,
      inputs: ['plants'], equipment: ['semoir', 'tracteur'],
    });
    const json = op.toJSON();
    expect(json.equipment).toEqual(['semoir', 'tracteur']);
    expect(TechnicalOperation.fromJSON(json).equipment).toEqual(['semoir', 'tracteur']);
  });
  it('equipment absent → [] (par défaut)', () => {
    const json = TechnicalOperation.create({ type: OperationType.PLANTING, label: TranslatableText.create({ fr: 'Plantation' }), timingDays: 0 }).toJSON();
    expect(json.equipment).toEqual([]);
  });
});
