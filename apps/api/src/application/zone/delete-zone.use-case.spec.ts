import { DeleteZoneUseCase, ZoneNotFoundError, ZoneInUseError } from './delete-zone.use-case';
import { InMemoryZoneRepository } from './in-memory-zone.repository';
import { InMemoryCropZoneSuitabilityRepository } from './in-memory-crop-zone-suitability.repository';
import { AgroEcologicalZone } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-06T00:00:00.000Z' };
const seedZone = async (zones: InMemoryZoneRepository, id = 'z1') =>
  zones.save(AgroEcologicalZone.create({ id, name: TranslatableText.create({ fr: 'A' }), country: 'BF' }).toSnapshot());

describe('DeleteZoneUseCase', () => {
  it('supprime une zone libre', async () => {
    const zones = new InMemoryZoneRepository(); await seedZone(zones);
    const links = new InMemoryCropZoneSuitabilityRepository();
    const uc = new DeleteZoneUseCase(zones, links, audit() as any, clock);
    await uc.execute({ id: 'z1', actor: 'admin' });
    expect(await zones.findById('z1')).toBeNull();
  });

  it('lève ZoneNotFoundError si absente', async () => {
    const uc = new DeleteZoneUseCase(new InMemoryZoneRepository(), new InMemoryCropZoneSuitabilityRepository(), audit() as any, clock);
    await expect(uc.execute({ id: 'nope', actor: 'admin' })).rejects.toBeInstanceOf(ZoneNotFoundError);
  });

  it('refuse (ZoneInUseError avec count) si rattachée', async () => {
    const zones = new InMemoryZoneRepository(); await seedZone(zones);
    const links = new InMemoryCropZoneSuitabilityRepository();
    await links.save({ cropId: 'c1', zoneId: 'z1', rating: 'SUITABLE' } as any);
    const uc = new DeleteZoneUseCase(zones, links, audit() as any, clock);
    await expect(uc.execute({ id: 'z1', actor: 'admin' })).rejects.toMatchObject({ name: 'ZoneInUseError', count: 1 });
    expect(await zones.findById('z1')).not.toBeNull(); // pas supprimée
  });
});
