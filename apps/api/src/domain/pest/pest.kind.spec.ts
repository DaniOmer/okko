import { Pest } from './pest';
import { PestKind } from './pest-kind';
import { PestType } from './pest-type';
import { TranslatableText } from '../shared/translatable-text';

describe('Pest kind', () => {
  it('défaut ANIMAL à la création', () => {
    const p = Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT });
    expect(p.toSnapshot().kind).toBe(PestKind.ANIMAL);
  });
  it('création en WEED avec catégorie adventice', () => {
    const p = Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chiendent' }), type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED });
    const s = p.toSnapshot();
    expect(s.kind).toBe(PestKind.WEED);
    expect(s.type).toBe(PestType.PERENNIAL_GRASS);
  });
  it('update change le kind et préserve les blocs', () => {
    const p = Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT })
      .setBiology({ generationsPerYear: { min: 1, max: 2 } });
    const u = p.update({ name: TranslatableText.create({ fr: 'X' }), type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED });
    const s = u.toSnapshot();
    expect(s.kind).toBe(PestKind.WEED);
    expect(s.generationsPerYear).toEqual({ min: 1, max: 2 });
  });
});
