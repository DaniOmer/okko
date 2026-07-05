import { UpdateZoneUseCase, ZoneNotFoundError } from './update-zone.use-case';
import { InMemoryZoneRepository } from './in-memory-zone.repository';
import { AgroEcologicalZone } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-06T00:00:00.000Z' };

describe('UpdateZoneUseCase', () => {
  it('met à jour les champs éditables et préserve le reste', async () => {
    const zones = new InMemoryZoneRepository();
    await zones.save(AgroEcologicalZone.create({ id: 'z1', name: TranslatableText.create({ fr: 'A' }), country: 'BF', notes: 'garde' }).toSnapshot());
    const uc = new UpdateZoneUseCase(zones, audit() as any, clock);
    const out = await uc.execute({ id: 'z1', name: { fr: 'B' }, country: 'NE', koppen: 'BSh', actor: 'admin' });
    expect(out.name.fr).toBe('B');
    expect(out.country).toBe('NE');
    expect(out.notes).toBe('garde');
  });

  it('lève ZoneNotFoundError si absent', async () => {
    const uc = new UpdateZoneUseCase(new InMemoryZoneRepository(), audit() as any, clock);
    await expect(uc.execute({ id: 'nope', name: { fr: 'B' }, country: 'NE', actor: 'admin' })).rejects.toBeInstanceOf(ZoneNotFoundError);
  });
});
