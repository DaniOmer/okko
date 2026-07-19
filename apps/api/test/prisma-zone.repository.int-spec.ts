import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaZoneRepository } from '../src/infrastructure/zone/prisma-zone.repository';
import { PrismaCropZoneSuitabilityRepository } from '../src/infrastructure/zone/prisma-crop-zone-suitability.repository';
import { SuitabilityRating } from '../src/domain/zone/suitability-rating';

describe('Prisma zone + suitability repositories (integration)', () => {
  const prisma = new PrismaService();
  const zones = new PrismaZoneRepository(prisma);
  const suit = new PrismaCropZoneSuitabilityRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => {
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.$disconnect();
  });

  it('saves/reads a zone and upserts a suitability by composite key', async () => {
    await zones.save({
      id: 'z-int-1', name: { fr: 'Sahel' }, country: 'BJ', koppen: 'BSh',
      annualRainfall: { min: 600, optimal: 900, max: 1200, unit: 'mm' },
      metadata: {}, images: [],
    });
    const found = await zones.findById('z-int-1');
    expect(found?.name.fr).toBe('Sahel');
    expect(found?.annualRainfall?.optimal).toBe(900);

    await suit.save({ cropId: 'c-int-1', zoneId: 'z-int-1', rating: SuitabilityRating.SUITABLE, justification: 'ok' });
    // upsert on the same composite key must update, not duplicate
    await suit.save({ cropId: 'c-int-1', zoneId: 'z-int-1', rating: SuitabilityRating.MARGINAL });
    const byCrop = await suit.listByCrop('c-int-1');
    expect(byCrop).toHaveLength(1);
    expect(byCrop[0].rating).toBe(SuitabilityRating.MARGINAL);

    const byZone = await suit.listByZone('z-int-1');
    expect(byZone).toHaveLength(1);
  });
});
