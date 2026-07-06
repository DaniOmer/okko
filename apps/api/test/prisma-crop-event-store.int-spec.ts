import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaCropEventStore } from '../src/infrastructure/crop/prisma-crop-event-store';
import { ConcurrencyError } from '../src/application/crop/crop-event-store';
import { CycleType } from '../src/domain/crop/cycle-type';

describe('PrismaCropEventStore (integration)', () => {
  const prisma = new PrismaService();
  const store = new PrismaCropEventStore(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.cropEvent.deleteMany();
  });

  afterAll(async () => {
    await prisma.cropEvent.deleteMany();
    await prisma.$disconnect();
  });

  it('append then load returns events ordered by sequence with correct payload round-trip', async () => {
    const streamId = 'crop-stream-1';
    const at = '2026-01-15T10:00:00.000Z';

    await store.append(streamId, 0, [
      { event: { type: 'CropCreated', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL }, actor: 'user-1', at },
      { event: { type: 'Published' }, actor: 'user-1', at },
    ]);

    const events = await store.load(streamId);

    expect(events).toHaveLength(2);

    expect(events[0].streamId).toBe(streamId);
    expect(events[0].sequence).toBe(1);
    expect(events[0].actor).toBe('user-1');
    expect(events[0].at).toBe(at);
    expect(events[0].event).toMatchObject({ type: 'CropCreated', commonNames: { fr: 'Maïs' } });

    expect(events[1].sequence).toBe(2);
    expect(events[1].event).toMatchObject({ type: 'Published' });
  });

  it('append with stale expectedSequence throws ConcurrencyError', async () => {
    const streamId = 'crop-stream-2';
    const at = '2026-01-15T10:00:00.000Z';

    await store.append(streamId, 0, [
      { event: { type: 'CropCreated', commonNames: { fr: 'Sorgho' }, scientificName: 'Sorghum bicolor', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL }, actor: 'user-1', at },
    ]);

    // now the stream has 1 event, passing expectedSequence=0 again should fail
    await expect(
      store.append(streamId, 0, [
        { event: { type: 'Published' }, actor: 'user-1', at },
      ]),
    ).rejects.toThrow(ConcurrencyError);
  });

  it('load returns empty array for unknown streamId', async () => {
    const events = await store.load('unknown-stream');
    expect(events).toHaveLength(0);
  });
});
