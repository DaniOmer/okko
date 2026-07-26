import { Pest } from './pest';
import { PestType } from './pest-type';
import { PestKind } from './pest-kind';
import { TranslatableText } from '../shared/translatable-text';

const base = () => Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chiendent' }), type: PestType.PERENNIAL_GRASS, kind: PestKind.WEED });

describe('Pest setWeed', () => {
  it('enregistre les traits adventice et round-trip', () => {
    const s = base().setWeed({
      reproductionMode: ['SEEDS', 'RHIZOMES'],
      disseminationCapacity: 'HIGH',
      emergenceDepth: { min: 0, max: 5, unit: 'cm' },
      seedBankLongevity: { min: 2, max: 10, unit: 'ans' },
    }).toSnapshot();
    expect(s.reproductionMode).toEqual(['SEEDS', 'RHIZOMES']);
    expect(s.disseminationCapacity).toBe('HIGH');
    expect(s.emergenceDepth).toEqual({ min: 0, max: 5, unit: 'cm' });
    expect(s.seedBankLongevity).toEqual({ min: 2, max: 10, unit: 'ans' });
  });
  it('remplace le bloc en entier et préserve kind + autres blocs', () => {
    const p = base().setBiology({ lifeCycle: { fr: 'annuel' } }).setWeed({ disseminationCapacity: 'LOW' });
    const s = p.setWeed({ reproductionMode: ['SEEDS'] }).toSnapshot();
    expect(s.disseminationCapacity).toBeUndefined();      // remplacement complet
    expect(s.reproductionMode).toEqual(['SEEDS']);
    expect(s.lifeCycle).toEqual({ fr: 'annuel' });          // autre bloc préservé
    expect(s.kind).toBe(PestKind.WEED);                     // kind préservé
  });
  it('création : bloc weed vide (champs absents)', () => {
    const s = base().toSnapshot();
    expect(s.reproductionMode).toBeUndefined();
    expect(s.emergenceDepth).toBeUndefined();
  });
  it('valide min<=max sur les plages', () => {
    expect(() => base().setWeed({ emergenceDepth: { min: 5, max: 1 } })).toThrow();
  });
});
