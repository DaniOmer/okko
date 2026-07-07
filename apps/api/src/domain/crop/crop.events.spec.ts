import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { ClimaticRequirements } from '../shared/climatic-requirements';
import { VarietySnapshot } from './variety';

const make = () => Crop.create({
  id: 'c1', commonNames: TranslatableText.create({ fr: 'Maïs' }),
  scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL,
});
const stored = (events: ReturnType<Crop['pullPendingEvents']>) => events.map((event) => ({ event, streamId: 'c1' }));

describe('Crop event sourcing', () => {
  it('create émet CropCreated et le tampon se vide', () => {
    const c = make();
    const evs = c.pullPendingEvents();
    expect(evs).toEqual([{ type: 'CropCreated', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL }]);
    expect(c.pullPendingEvents()).toEqual([]); // vidé
  });

  it('une mutation de contenu émet son événement et incrémente version', () => {
    const c = make(); c.pullPendingEvents();
    c.setClimaticRequirements(ClimaticRequirements.fromJSON({ temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } }));
    const evs = c.pullPendingEvents();
    expect(evs[0].type).toBe('ClimaticRequirementsSet');
    expect(c.version).toBe(2);
  });

  it('publish émet Published sans changer version', () => {
    const c = make(); c.pullPendingEvents();
    c.publish();
    expect(c.pullPendingEvents()).toEqual([{ type: 'Published' }]);
    expect(c.version).toBe(1);
    expect(c.status).toBe('PUBLISHED');
  });

  it('fromEvents reconstruit un état identique à la même séquence de mutations', () => {
    const built = make();
    built.setClimaticRequirements(ClimaticRequirements.fromJSON({ temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } }));
    built.publish();
    const events = stored(built.pullPendingEvents());
    const rebuilt = Crop.fromEvents(events);
    expect(rebuilt.toSnapshot()).toEqual(built.toSnapshot());
  });
});

describe('Crop sections event sourcing', () => {
  const v = (id: string): VarietySnapshot => ({ id, cropId: 'c1', name: { fr: `V${id}` }, traits: [] } as VarietySnapshot);

  it('addVariety émet VarietyAdded, pousse dans la collection, sans changer version', () => {
    const c = make(); c.pullPendingEvents();          // make() = Crop.create(...) du bloc Lot A
    c.addVariety(v('a'));
    expect(c.pullPendingEvents()).toEqual([{ type: 'VarietyAdded', variety: v('a') }]);
    expect(c.varieties).toEqual([v('a')]);
    expect(c.version).toBe(1);                          // inchangé
  });

  it('setZoneSuitability fait un upsert par zoneId', () => {
    const c = make(); c.pullPendingEvents();
    const s1 = { cropId: 'c1', zoneId: 'z1', rating: 'SUITABLE' } as any;
    const s2 = { cropId: 'c1', zoneId: 'z1', rating: 'MARGINAL' } as any;
    c.setZoneSuitability(s1); c.setZoneSuitability(s2);
    expect(c.zones).toEqual([s2]);                      // remplacé, pas dupliqué
  });

  it('fromEvents d\'un flux mixte reconstruit cœur + sections', () => {
    const built = make();
    built.addVariety(v('a'));
    built.setZoneSuitability({ cropId: 'c1', zoneId: 'z1', rating: 'SUITABLE' } as any);
    const rebuilt = Crop.fromEvents(stored(built.pullPendingEvents()));  // stored() du bloc Lot A (ajoute streamId:'c1')
    expect(rebuilt.varieties).toEqual(built.varieties);
    expect(rebuilt.zones).toEqual(built.zones);
    expect(rebuilt.toSnapshot()).toEqual(built.toSnapshot());  // cœur identique
  });
});
