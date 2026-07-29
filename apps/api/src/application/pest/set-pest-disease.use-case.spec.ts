import { SetPestDiseaseUseCase } from './set-pest-disease.use-case';
import { PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-28T00:00:00.000Z' };

describe('SetPestDiseaseUseCase', () => {
  it('lève PestNotFoundError si absent', async () => {
    const uc = new SetPestDiseaseUseCase(new InMemoryPestRepository(), audit() as never, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });

  it('set puis relecture : findById renvoie pathogen/propagationModes/evolutionSpeed', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Mildiou' }), type: PestType.OOMYCETE }).toSnapshot());
    const uc = new SetPestDiseaseUseCase(repo, audit() as never, clock);
    const out = await uc.execute({
      id: 'p1', actor: 'admin',
      pathogen: { fr: 'Phytophthora infestans' },
      propagationModes: ['wind', 'water'],
      evolutionSpeed: 'fast',
    });
    expect(out.pathogen).toEqual({ fr: 'Phytophthora infestans' });
    expect(out.propagationModes).toEqual(['wind', 'water']);
    expect(out.evolutionSpeed).toBe('fast');
    // identité préservée
    expect(out.id).toBe('p1');
    const reloaded = await repo.findById('p1');
    expect(reloaded?.pathogen).toEqual({ fr: 'Phytophthora infestans' });
  });

  it('remplacement complet : un 2e setDisease efface les champs non fournis', async () => {
    const repo = new InMemoryPestRepository();
    await repo.save(Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Botrytis' }), type: PestType.FUNGUS }).toSnapshot());
    const uc = new SetPestDiseaseUseCase(repo, audit() as never, clock);
    // Premier appel — on pose des données
    await uc.execute({ id: 'p1', actor: 'admin', pathogen: { fr: 'Botrytis cinerea' }, evolutionSpeed: 'medium' });
    // Second appel — on ne fournit pas evolutionSpeed
    const out = await uc.execute({ id: 'p1', actor: 'admin', pathogen: { fr: 'Botrytis cinerea' } });
    expect(out.pathogen).toEqual({ fr: 'Botrytis cinerea' });
    expect(out.evolutionSpeed).toBeUndefined();
  });
});
