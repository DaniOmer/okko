import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaCropRepository } from '../src/infrastructure/crop/prisma-crop.repository';
import { CropStatus } from '../src/domain/crop/crop-status';
import { CycleType } from '../src/domain/crop/cycle-type';

describe('PrismaCropRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaCropRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.crop.deleteMany(); await prisma.$disconnect(); });

  it('sauvegarde puis relit un snapshot', async () => {
    await repo.save({
      id: 'itest-1',
      commonNames: { fr: 'Coton' },
      scientificName: 'Gossypium',
      family: 'Malvaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      status: CropStatus.DRAFT,
      version: 1,
      metadata: {},
    });
    const found = await repo.findById('itest-1');
    expect(found?.scientificName).toBe('Gossypium');
    expect(found?.commonNames.fr).toBe('Coton');
  });
});
