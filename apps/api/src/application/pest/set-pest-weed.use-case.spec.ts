import { SetPestWeedUseCase } from './set-pest-weed.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-26T00:00:00.000Z' };

describe('SetPestWeedUseCase', () => {
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestWeedUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });

  it('set puis relecture : findById renvoie les traits weed', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chiendent' }), type: PestType.ANNUAL_GRASS }).toSnapshot());
    const uc = new SetPestWeedUseCase(repo, audit() as never, clock);
    const out = await uc.execute({
      id: 'p1', actor: 'admin',
      reproductionMode: ['rhizome', 'seed'],
      disseminationCapacity: 'high',
      emergenceDepth: { min: 0, max: 5, unit: 'cm' },
      seedBankLongevity: { min: 5, max: 20, unit: 'years' },
    });
    expect(out.reproductionMode).toEqual(['rhizome', 'seed']);
    expect(out.disseminationCapacity).toBe('high');
    expect(out.emergenceDepth).toEqual({ min: 0, max: 5, unit: 'cm' });
    expect(out.seedBankLongevity).toEqual({ min: 5, max: 20, unit: 'years' });
    // identité préservée
    expect(out.id).toBe('p1');
    const reloaded = await repo.findById('p1');
    expect(reloaded?.reproductionMode).toEqual(['rhizome', 'seed']);
  });

  it('remplacement complet : un 2e setWeed efface les champs non fournis', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Mouron' }), type: PestType.ANNUAL_GRASS }).toSnapshot());
    const uc = new SetPestWeedUseCase(repo, audit() as never, clock);
    // Premier appel — on pose des données
    await uc.execute({ id: 'p1', actor: 'admin', reproductionMode: ['seed'], disseminationCapacity: 'low' });
    // Second appel — on ne fournit pas disseminationCapacity
    const out = await uc.execute({ id: 'p1', actor: 'admin', reproductionMode: ['rhizome'] });
    expect(out.reproductionMode).toEqual(['rhizome']);
    expect(out.disseminationCapacity).toBeUndefined();
  });
});
