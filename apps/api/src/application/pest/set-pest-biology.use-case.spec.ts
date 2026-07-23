import { SetPestBiologyUseCase } from './set-pest-biology.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-22T00:00:00.000Z' };

describe('SetPestBiologyUseCase', () => {
  it('applique la biologie et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestBiologyUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', biology: { generationsPerYear: { min: 2, max: 4 }, activityPeriods: ['JUN'] } });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.generationsPerYear).toEqual({ min: 2, max: 4 });
    expect(out.activityPeriods).toEqual(['JUN']);
  });
  it('efface la biologie quand le payload est vide (remplacement complet)', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setBiology({ generationsPerYear: { min: 1, max: 2 } }).toSnapshot());
    const uc = new SetPestBiologyUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', biology: {} });
    expect(out.generationsPerYear).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestBiologyUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a', biology: {} })).rejects.toThrow(PestNotFoundError);
  });
});
