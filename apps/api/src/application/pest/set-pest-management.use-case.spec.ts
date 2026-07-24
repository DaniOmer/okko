import { SetPestManagementUseCase } from './set-pest-management.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-24T00:00:00.000Z' };

describe('SetPestManagementUseCase', () => {
  it('applique la gestion et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestManagementUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', prevention: { fr: 'Rotation' }, predators: ['Coccinelle'], approvedProducts: [{ name: 'Bt' }] });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.prevention).toEqual({ fr: 'Rotation' });
    expect(out.predators).toEqual(['Coccinelle']);
    expect(out.approvedProducts).toEqual([{ name: 'Bt' }]);
  });
  it('efface la gestion quand le payload est vide', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setManagement({ predators: ['Coccinelle'] }).toSnapshot());
    const uc = new SetPestManagementUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin' });
    expect(out.predators).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestManagementUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
