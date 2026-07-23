import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT,
  scientificName: 'Spodoptera', family: 'Noctuidae',
});

describe('Pest.setBiology', () => {
  it('remplace en bloc et préserve identité + valide les plages', () => {
    const p = base().setBiology({
      lifeCycle: { fr: 'Holométabole' },
      cycleDurationDays: { min: 20, max: 40, unit: 'j' },
      developmentStages: [{ name: { fr: 'Œuf' }, durationDays: { min: 3, max: 5, unit: 'j' } }, { name: { fr: 'Larve' } }],
      generationsPerYear: { min: 3, max: 6 },
      activityPeriods: ['JUN', 'JUL', 'AUG'],
      favorableConditions: { temperature: { min: 20, max: 30, unit: '°C' }, humidity: { min: 60, max: 90, unit: '%' }, notes: { fr: 'Humidité élevée' } },
    });
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');        // identité préservée
    expect(s.family).toBe('Noctuidae');
    expect(s.lifeCycle).toEqual({ fr: 'Holométabole' });
    expect(s.cycleDurationDays).toEqual({ min: 20, max: 40, unit: 'j' });
    expect(s.developmentStages?.[0]).toEqual({ name: { fr: 'Œuf' }, durationDays: { min: 3, max: 5, unit: 'j' } });
    expect(s.activityPeriods).toEqual(['JUN', 'JUL', 'AUG']);
    expect(s.favorableConditions?.temperature).toEqual({ min: 20, max: 30, unit: '°C' });
  });

  it('rejette une plage invalide (min > max)', () => {
    expect(() => base().setBiology({ cycleDurationDays: { min: 40, max: 20 } })).toThrow();
  });

  it('efface les champs biologie absents du payload (remplacement complet)', () => {
    const withBio = base().setBiology({ lifeCycle: { fr: 'X' }, generationsPerYear: { min: 1, max: 2 } });
    const cleared = withBio.setBiology({});
    const s = cleared.toSnapshot();
    expect(s.lifeCycle).toBeUndefined();
    expect(s.generationsPerYear).toBeUndefined();
  });
});
