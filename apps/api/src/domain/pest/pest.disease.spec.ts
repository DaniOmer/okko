import { Pest } from './pest';
import { PestType } from './pest-type';
import { PestKind } from './pest-kind';
import { TranslatableText } from '../shared/translatable-text';

const base = () => Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Mildiou' }), type: PestType.OOMYCETE, kind: PestKind.DISEASE });

describe('Pest setDisease', () => {
  it('enregistre les champs maladie et round-trip', () => {
    const s = base().setDisease({
      firstSymptoms: { fr: 'taches huileuses' }, advancedSymptoms: { fr: 'nécroses' }, confusionRisk: { fr: 'alternariose' },
      pathogen: { fr: 'Phytophthora infestans' }, propagationModes: ['WIND', 'WATER'],
      potentialLosses: { fr: '20-40%' }, evolutionSpeed: 'FAST',
    }).toSnapshot();
    expect(s.firstSymptoms).toEqual({ fr: 'taches huileuses' });
    expect(s.pathogen).toEqual({ fr: 'Phytophthora infestans' });
    expect(s.propagationModes).toEqual(['WIND', 'WATER']);
    expect(s.evolutionSpeed).toBe('FAST');
  });
  it('remplace le bloc en entier et préserve kind + autres blocs', () => {
    const p = base().setBiology({ lifeCycle: { fr: 'annuel' } }).setDisease({ evolutionSpeed: 'SLOW' });
    const s = p.setDisease({ pathogen: { fr: 'Botrytis' } }).toSnapshot();
    expect(s.evolutionSpeed).toBeUndefined();          // remplacement complet
    expect(s.pathogen).toEqual({ fr: 'Botrytis' });
    expect(s.lifeCycle).toEqual({ fr: 'annuel' });      // autre bloc préservé
    expect(s.kind).toBe(PestKind.DISEASE);              // kind préservé
  });
  it('setBiology enregistre le vent dans les conditions favorables', () => {
    const s = base().setBiology({ favorableConditions: { wind: { min: 10, max: 30, unit: 'km/h' } } }).toSnapshot();
    expect(s.favorableConditions?.wind).toEqual({ min: 10, max: 30, unit: 'km/h' });
  });
  it('création : bloc disease vide', () => {
    const s = base().toSnapshot();
    expect(s.pathogen).toBeUndefined();
    expect(s.propagationModes).toBeUndefined();
  });
});
