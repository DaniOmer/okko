import { Crop, NoPublishedVersionError } from './crop';
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

describe('Crop draft/published editorial safety', () => {
  const v = (id: string): VarietySnapshot =>
    ({ id, cropId: 'c1', name: { fr: `V${id}` }, traits: [] } as VarietySnapshot);

  it('publish pose hasPublishedVersion et remet hasUnpublishedChanges à false', () => {
    const c = make();
    c.rename(TranslatableText.create({ fr: 'Nouveau' }));
    expect(c.hasUnpublishedChanges).toBe(true);
    c.publish();
    expect(c.hasPublishedVersion).toBe(true);
    expect(c.hasUnpublishedChanges).toBe(false);
  });

  it('éditer après publication remet hasUnpublishedChanges à true sans toucher hasPublishedVersion', () => {
    const c = make();
    c.publish();
    c.addVariety(v('a'));
    expect(c.hasUnpublishedChanges).toBe(true);
    expect(c.hasPublishedVersion).toBe(true);
  });

  it('discardDraft restaure cœur + sections à l\'état publié et remet le drapeau à false', () => {
    const c = make();
    c.addVariety(v('a'));
    c.publish();
    const versionAtPublish = c.version;
    c.addVariety(v('b'));
    c.rename(TranslatableText.create({ fr: 'Brouillon modifié' }));
    expect(c.varieties).toHaveLength(2);
    c.discardDraft();
    expect(c.varieties).toEqual([v('a')]);
    expect(c.version).toBe(versionAtPublish);
    expect(c.commonNames.toJSON()).toEqual(make().commonNames.toJSON());
    expect(c.hasUnpublishedChanges).toBe(false);
  });

  it('republier re-fige le point de contrôle sur la tête courante', () => {
    const c = make();
    c.addVariety(v('a'));
    c.publish();
    c.addVariety(v('b'));
    expect(c.hasUnpublishedChanges).toBe(true);
    c.publish(); // republication : PUBLISHED -> PUBLISHED autorisé
    expect(c.hasUnpublishedChanges).toBe(false);
    expect(c.hasPublishedVersion).toBe(true);
    // une édition postérieure puis un abandon reviennent à la version RE-publiée (a + b), pas à la 1re
    c.addVariety(v('c'));
    c.discardDraft();
    expect(c.varieties).toEqual([v('a'), v('b')]);
  });

  it('discardDraft lève NoPublishedVersionError si jamais publié', () => {
    const c = make();
    c.addVariety(v('a'));
    expect(() => c.discardDraft()).toThrow(NoPublishedVersionError);
  });

  it('repli déterministe : [Created, éditions, Published, éditions, DraftDiscarded] == état au Published', () => {
    // Accumulate ALL events in one pass (do not drain mid-stream)
    const built = make();
    built.addVariety(v('a'));
    built.publish();
    // Snapshot state at publish (without draining the buffer)
    const atPublish = built.toSnapshot();
    built.addVariety(v('b'));
    built.discardDraft();
    // Reconstruct from the full event stream
    const rebuilt = Crop.fromEvents(stored(built.pullPendingEvents()));
    expect(rebuilt.toSnapshot()).toEqual(atPublish);
    expect(rebuilt.varieties).toEqual([v('a')]);
  });
});
