import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { ConcurrencyError } from './crop-event-store';

const entry = (t: string, actor = 'a') => ({ event: { type: t } as any, actor, at: '2026-07-06T00:00:00.000Z' });

describe('InMemoryCropEventStore', () => {
  it('append puis load renvoie les événements ordonnés avec séquence 1..N', async () => {
    const s = new InMemoryCropEventStore();
    await s.append('c1', 0, [entry('CropCreated'), entry('Published')]);
    const loaded = await s.load('c1');
    expect(loaded.map((e) => e.sequence)).toEqual([1, 2]);
    expect(loaded.map((e) => e.event.type)).toEqual(['CropCreated', 'Published']);
  });

  it('rejette (ConcurrencyError) si expectedSequence est périmé', async () => {
    const s = new InMemoryCropEventStore();
    await s.append('c1', 0, [entry('CropCreated')]);
    await expect(s.append('c1', 0, [entry('Published')])).rejects.toBeInstanceOf(ConcurrencyError);
    await s.append('c1', 1, [entry('Published')]); // séquence correcte -> OK
    expect((await s.load('c1')).length).toBe(2);
  });

  it('les flux sont indépendants', async () => {
    const s = new InMemoryCropEventStore();
    await s.append('c1', 0, [entry('CropCreated')]);
    await s.append('c2', 0, [entry('CropCreated')]);
    expect((await s.load('c1')).length).toBe(1);
    expect((await s.load('c2')).length).toBe(1);
  });
});
