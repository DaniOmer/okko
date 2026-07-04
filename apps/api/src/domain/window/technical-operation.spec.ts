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
