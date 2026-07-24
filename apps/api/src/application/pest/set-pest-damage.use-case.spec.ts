import { SetPestDamageUseCase } from './set-pest-damage.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-23T00:00:00.000Z' };

describe('SetPestDamageUseCase', () => {
  it('applique les dégâts et préserve identité', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera' }).toSnapshot());
    const uc = new SetPestDamageUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin', symptoms: { fr: 'Trous' }, attackedOrgans: ['LEAVES'], damageTypes: ['BITES'], harmfulnessLevel: 'MAJOR' });
    expect(out.scientificName).toBe('Spodoptera');
    expect(out.symptoms).toEqual({ fr: 'Trous' });
    expect(out.attackedOrgans).toEqual(['LEAVES']);
    expect(out.harmfulnessLevel).toBe('MAJOR');
  });
  it('efface les dégâts quand le payload est vide', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'X' }), type: PestType.INSECT }).setDamage({ attackedOrgans: ['ROOTS'] }).toSnapshot());
    const uc = new SetPestDamageUseCase(repo, audit() as never, clock);
    const out = await uc.execute({ id: 'p1', actor: 'admin' });
    expect(out.attackedOrgans).toBeUndefined();
  });
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestDamageUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
