import { UpdatePestUseCase, PestNotFoundError } from './update-pest.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { Pest } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';

const audit = () => ({ record: jest.fn() });
const clock = { nowIso: () => '2026-07-06T00:00:00.000Z' };

describe('UpdatePestUseCase', () => {
  it('met à jour les champs éditables et préserve le reste', async () => {
    const pests = new InMemoryPestRepository();
    await pests.save(Pest.create({
      id: 'p1', name: TranslatableText.create({ fr: 'Mouche' }), type: PestType.INSECT,
      notes: 'garde', images: [{ key: 'images/x.jpg' }],
    }).toSnapshot());
    const uc = new UpdatePestUseCase(pests, audit() as any, clock);
    const out = await uc.execute({ id: 'p1', name: { fr: 'Insecte' }, type: PestType.MITE, scientificName: 'Fusarium sp.', actor: 'admin' });
    expect(out.name.fr).toBe('Insecte');
    expect(out.type).toBe(PestType.MITE);
    expect(out.scientificName).toBe('Fusarium sp.');
    expect(out.notes).toBe('garde');
    expect(out.images).toEqual([{ key: 'images/x.jpg' }]);
  });

  it('lève PestNotFoundError si absent', async () => {
    const uc = new UpdatePestUseCase(new InMemoryPestRepository(), audit() as any, clock);
    await expect(uc.execute({ id: 'nope', name: { fr: 'X' }, type: PestType.INSECT, actor: 'admin' })).rejects.toBeInstanceOf(PestNotFoundError);
  });

  it('efface la description quand elle est absente du payload (full-replace)', async () => {
    const pests = new InMemoryPestRepository();
    await pests.save(Pest.create({
      id: 'p2', name: TranslatableText.create({ fr: 'Mouche' }), type: PestType.INSECT,
      description: TranslatableText.create({ fr: 'Une description existante' }),
    }).toSnapshot());
    const uc = new UpdatePestUseCase(pests, audit() as any, clock);
    // No description in payload → must clear the existing one
    const out = await uc.execute({ id: 'p2', name: { fr: 'Mouche' }, type: PestType.INSECT, actor: 'admin' });
    expect(out.description).toBeUndefined();
  });

  it('remplace la description quand une nouvelle valeur est fournie', async () => {
    const pests = new InMemoryPestRepository();
    await pests.save(Pest.create({
      id: 'p3', name: TranslatableText.create({ fr: 'Mouche' }), type: PestType.INSECT,
      description: TranslatableText.create({ fr: 'Ancienne description' }),
    }).toSnapshot());
    const uc = new UpdatePestUseCase(pests, audit() as any, clock);
    const out = await uc.execute({ id: 'p3', name: { fr: 'Mouche' }, type: PestType.INSECT, description: { fr: 'Nouvelle description' }, actor: 'admin' });
    expect(out.description).toEqual({ fr: 'Nouvelle description' });
  });
});
