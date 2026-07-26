import { Pest } from './pest';
import { PestType } from './pest-type';
import { PestKind } from './pest-kind';
import { TranslatableText } from '../shared/translatable-text';

const base = () => Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chiendent' }), type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED });

describe('Pest damage nuisanceTypes', () => {
  it('setDamage enregistre nuisanceTypes et round-trip', () => {
    const s = base().setDamage({ nuisanceTypes: ['WATER_COMPETITION', 'ALLELOPATHY'], harmfulnessLevel: 'MAJOR' }).toSnapshot();
    expect(s.nuisanceTypes).toEqual(['WATER_COMPETITION', 'ALLELOPATHY']);
    expect(s.harmfulnessLevel).toBe('MAJOR');
  });
  it('setDamage sans nuisanceTypes laisse le champ absent', () => {
    const s = base().setDamage({ attackedOrgans: ['LEAF'] }).toSnapshot();
    expect(s.nuisanceTypes).toBeUndefined();
    expect(s.attackedOrgans).toEqual(['LEAF']);
  });
});
