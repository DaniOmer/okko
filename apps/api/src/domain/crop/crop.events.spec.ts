import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { ClimaticRequirements } from '../shared/climatic-requirements';

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
