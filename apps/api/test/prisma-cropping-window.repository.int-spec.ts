import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaCroppingWindowRepository } from '../src/infrastructure/window/prisma-cropping-window.repository';
import { OperationType } from '../src/domain/window/operation-type';

describe('PrismaCroppingWindowRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaCroppingWindowRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.croppingWindow.deleteMany(); await prisma.$disconnect(); });

  it('saves and lists windows with embedded operations', async () => {
    await repo.save({
      id: 'w-int-1', cropId: 'c-int-1', zoneId: 'z-int-1', season: 'Saison sèche',
      sowingStart: 'novembre', sowingEnd: 'février', irrigationRequired: true,
      operations: [{ type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] }],
      notes: 'test',
    });
    const list = await repo.listByCrop('c-int-1');
    expect(list).toHaveLength(1);
    expect(list[0].irrigationRequired).toBe(true);
    expect(list[0].operations[0].label.fr).toBe('Semis');
  });
});
