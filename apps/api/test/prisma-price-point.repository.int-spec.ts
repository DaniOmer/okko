import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaPricePointRepository } from '../src/infrastructure/price/prisma-price-point.repository';

describe('PrismaPricePointRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaPricePointRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.pricePoint.deleteMany(); await prisma.$disconnect(); });

  it('appends price points and lists them by crop, most recent first', async () => {
    await repo.save({ id: 'pp-int-1', cropId: 'c-int-1', market: 'Dantokpa', periodStart: '2026-05-01', periodEnd: '2026-05-01', price: 300, unit: 'FCFA/kg', currency: 'XOF' });
    await repo.save({ id: 'pp-int-2', cropId: 'c-int-1', market: 'Dantokpa', periodStart: '2026-06-01', periodEnd: '2026-06-01', price: 350, unit: 'FCFA/kg', currency: 'XOF' });
    const list = await repo.listByCrop('c-int-1');
    expect(list).toHaveLength(2);
    expect(list[0].periodEnd).toBe('2026-06-01'); // most recent first
    expect(list[0].price).toBe(350);
  });
});
