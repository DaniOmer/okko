import { ControlMethod } from './control-method';
import { ControlCategory } from './control-category';
import { TranslatableText } from '../shared/translatable-text';

describe('ControlMethod', () => {
  it('creates a method and round-trips through JSON', () => {
    const m = ControlMethod.create({
      category: ControlCategory.BIOLOGICAL,
      description: TranslatableText.create({ fr: 'Piégeage à phéromones' }),
      inputs: ['pièges', 'phéromone'],
    });
    const restored = ControlMethod.fromJSON(m.toJSON());
    expect(restored.category).toBe(ControlCategory.BIOLOGICAL);
    expect(restored.description.getOrDefault('fr')).toBe('Piégeage à phéromones');
    expect(restored.inputs).toEqual(['pièges', 'phéromone']);
  });

  it('defaults inputs to []', () => {
    const m = ControlMethod.create({ category: ControlCategory.PREVENTION, description: TranslatableText.create({ fr: 'Rotation' }) });
    expect(m.inputs).toEqual([]);
  });
});
