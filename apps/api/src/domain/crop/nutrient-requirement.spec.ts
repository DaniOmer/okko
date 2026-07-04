import { NutrientRequirement, NutrientBasis } from './nutrient-requirement';

describe('NutrientRequirement', () => {
  it('creates a requirement and round-trips through JSON', () => {
    const r = NutrientRequirement.create({
      nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE, stage: 'couverture',
    });
    const restored = NutrientRequirement.fromJSON(r.toJSON());
    expect(restored.nutrient).toBe('N');
    expect(restored.amount).toBe(120);
    expect(restored.unit).toBe('kg/ha');
    expect(restored.basis).toBe(NutrientBasis.PER_HECTARE);
    expect(restored.stage).toBe('couverture');
  });

  it('allows an omitted stage', () => {
    const r = NutrientRequirement.create({ nutrient: 'K2O', amount: 60, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE });
    expect(r.stage).toBeUndefined();
    expect(r.toJSON().stage).toBeUndefined();
  });
});
