import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaPestRepository } from '../src/infrastructure/pest/prisma-pest.repository';
import { PrismaCropPestControlRepository } from '../src/infrastructure/pest/prisma-crop-pest-control.repository';
import { PestType } from '../src/domain/pest/pest-type';
import { SusceptibilityLevel } from '../src/domain/pest/susceptibility-level';
import { ControlCategory } from '../src/domain/pest/control-category';

describe('Prisma pest + control repositories (integration)', () => {
  const prisma = new PrismaService();
  const pests = new PrismaPestRepository(prisma);
  const controls = new PrismaCropPestControlRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => {
    await prisma.cropPestControl.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.$disconnect();
  });

  it('saves/reads a pest and upserts a control by composite key', async () => {
    await pests.save({
      id: 'p-int-1', name: { fr: 'Mouche' }, type: PestType.INSECT,
      photos: ['x.jpg'], metadata: {},
    });
    const found = await pests.findById('p-int-1');
    expect(found?.name.fr).toBe('Mouche');
    expect(found?.photos).toEqual(['x.jpg']);

    await controls.save({
      cropId: 'c-int-1', pestId: 'p-int-1', susceptibility: SusceptibilityLevel.HIGH,
      sensitiveStages: ['fruit'], controlMethods: [{ category: ControlCategory.PREVENTION, description: { fr: 'Ensachage' }, inputs: [] }],
    });
    await controls.save({
      cropId: 'c-int-1', pestId: 'p-int-1', susceptibility: SusceptibilityLevel.MEDIUM,
      sensitiveStages: [], controlMethods: [],
    });
    const byCrop = await controls.listByCrop('c-int-1');
    expect(byCrop).toHaveLength(1);
    expect(byCrop[0].susceptibility).toBe(SusceptibilityLevel.MEDIUM);

    const byPest = await controls.listByPest('p-int-1');
    expect(byPest).toHaveLength(1);
  });
});
