import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaCropRepository } from '../src/infrastructure/crop/prisma-crop.repository';
import { CropStatus } from '../src/domain/crop/crop-status';
import { CycleType } from '../src/domain/crop/cycle-type';

describe('PrismaCropRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaCropRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.crop.deleteMany(); await prisma.$disconnect(); });

  it('sauvegarde puis relit un snapshot avec tous les champs', async () => {
    const saved = {
      id: 'itest-1',
      commonNames: { fr: 'Coton', en: 'Cotton' },
      scientificName: 'Gossypium',
      family: 'Malvaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      status: CropStatus.PUBLISHED,
      version: 2,
      metadata: { rusticite: 'élevée' },
    };
    await repo.save(saved);
    const found = await repo.findById('itest-1');
    expect(found?.id).toBe('itest-1');
    expect(found?.commonNames).toEqual({ fr: 'Coton', en: 'Cotton' });
    expect(found?.scientificName).toBe('Gossypium');
    expect(found?.family).toBe('Malvaceae');
    expect(found?.cycleType).toBe(CycleType.SEASONAL_ANNUAL);
    expect(found?.status).toBe(CropStatus.PUBLISHED);
    expect(found?.version).toBe(2);
    expect(found?.metadata).toEqual({ rusticite: 'élevée' });
  });
});
