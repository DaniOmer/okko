import { SetPestDistributionUseCase } from './set-pest-distribution.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-24T00:00:00.000Z' };

describe('SetPestDistributionUseCase', () => {
  it('applique la répartition et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestDistributionUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', geographicAreas: ['Afrique'], favorableClimate: { fr: 'Tropical' }, knownPresence: { fr: 'Signalé' } });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.geographicAreas).toEqual(['Afrique']);
    expect(out.favorableClimate).toEqual({ fr: 'Tropical' });
    expect(out.knownPresence).toEqual({ fr: 'Signalé' });
  });
  it('efface la répartition quand le payload est vide', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setDistribution({ geographicAreas: ['Afrique'] }).toSnapshot());
    const uc = new SetPestDistributionUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin' });
    expect(out.geographicAreas).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestDistributionUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
