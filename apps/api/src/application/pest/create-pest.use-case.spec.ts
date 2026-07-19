import { CreatePestUseCase } from './create-pest.use-case';
import { ListPestsUseCase } from './list-pests.use-case';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { PestType } from '../../domain/pest/pest-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `pest-${++seq}` };

describe('CreatePestUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('creates a pest, audits, and lists it', async () => {
    const repo = new InMemoryPestRepository();
    const audit = { record: jest.fn() };
    const out = await new CreatePestUseCase(repo, audit, clock, ids).execute({
      name: { fr: 'Mouche des fruits' }, type: PestType.INSECT,
      images: [{ key: 'images/mouche.jpg', caption: 'Larve' }], actor: 'a',
    });
    expect(out.id).toBe('pest-1');
    expect(out.name.fr).toBe('Mouche des fruits');
    expect(out.type).toBe(PestType.INSECT);
    expect(out.images).toEqual([{ key: 'images/mouche.jpg', caption: 'Larve' }]);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListPestsUseCase(repo).execute();
    expect(list).toHaveLength(1);
  });
});
