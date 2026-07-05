import { UpdatePestUseCase, PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { PestDisease } from '../../domain/pest/pest-disease';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-06T00:00:00.000Z' };

describe('UpdatePestUseCase', () => {
  it('met à jour les champs éditables et préserve le reste', async () => {
    const pests = new InMemoryPestRepository();
    await pests.save(PestDisease.create({ id: 'p1', name: TranslatableText.create({ fr: 'Mouche' }), type: PestType.INSECT, notes: 'garde', photos: ['x.jpg'] }).toSnapshot());
    const uc = new UpdatePestUseCase(pests, audit() as any, clock);
    const out = await uc.execute({ id: 'p1', name: { fr: 'Champignon' }, type: PestType.FUNGUS, scientificName: 'Fusarium sp.', actor: 'admin' });
    expect(out.name.fr).toBe('Champignon');
    expect(out.type).toBe(PestType.FUNGUS);
    expect(out.scientificName).toBe('Fusarium sp.');
    expect(out.notes).toBe('garde');
    expect(out.photos).toEqual(['x.jpg']);
  });

  it('lève PestNotFoundError si absent', async () => {
    const uc = new UpdatePestUseCase(new InMemoryPestRepository(), audit() as any, clock);
    await expect(uc.execute({ id: 'nope', name: { fr: 'X' }, type: PestType.INSECT, actor: 'admin' })).rejects.toBeInstanceOf(PestNotFoundError);
  });
});
