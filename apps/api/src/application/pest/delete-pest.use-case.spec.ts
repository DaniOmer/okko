import { DeletePestUseCase, PestNotFoundError, PestInUseError } from './delete-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { InMemoryCropPestControlRepository } from './in-memory-crop-pest-control.repository';
import { PestDisease } from '../../domain/pest/pest-disease';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-06T00:00:00.000Z' };
const seedPest = async (pests: InMemoryPestRepository, id = 'p1') =>
  pests.save(PestDisease.create({ id, name: TranslatableText.create({ fr: 'Mouche' }), type: PestType.INSECT }).toSnapshot());

describe('DeletePestUseCase', () => {
  it('supprime un ravageur libre', async () => {
    const pests = new InMemoryPestRepository(); await seedPest(pests);
    const links = new InMemoryCropPestControlRepository();
    const uc = new DeletePestUseCase(pests, links, audit() as any, clock);
    await uc.execute({ id: 'p1', actor: 'admin' });
    expect(await pests.findById('p1')).toBeNull();
  });

  it('lève PestNotFoundError si absent', async () => {
    const uc = new DeletePestUseCase(new InMemoryPestRepository(), new InMemoryCropPestControlRepository(), audit() as any, clock);
    await expect(uc.execute({ id: 'nope', actor: 'admin' })).rejects.toBeInstanceOf(PestNotFoundError);
  });

  it('refuse (PestInUseError avec count) si rattaché', async () => {
    const pests = new InMemoryPestRepository(); await seedPest(pests);
    const links = new InMemoryCropPestControlRepository();
    await links.save({ cropId: 'c1', pestId: 'p1', susceptibility: 'MEDIUM', sensitiveStages: [], controlMethods: [] } as any);
    const uc = new DeletePestUseCase(pests, links, audit() as any, clock);
    await expect(uc.execute({ id: 'p1', actor: 'admin' })).rejects.toMatchObject({ name: 'PestInUseError', count: 1 });
    expect(await pests.findById('p1')).not.toBeNull(); // pas supprimé
  });
});
