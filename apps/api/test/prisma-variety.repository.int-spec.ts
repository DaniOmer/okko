import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaVarietyRepository } from '../src/infrastructure/crop/prisma-variety.repository';

describe('PrismaVarietyRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaVarietyRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.variety.deleteMany(); await prisma.$disconnect(); });

  it('saves and lists varieties by crop', async () => {
    await repo.save({
      id: 'v-int-1', cropId: 'crop-int-1', name: { fr: 'Obatanpa' },
      maturityDays: 120, yieldPotential: { min: 2, optimal: 4, max: 6, unit: 't/ha' },
      traits: ['précoce'], provenance: undefined,
      diseaseResistances: [], zoneAdaptations: [],
    });
    const list = await repo.listByCrop('crop-int-1');
    expect(list).toHaveLength(1);
    expect(list[0].name.fr).toBe('Obatanpa');
    expect(list[0].traits).toEqual(['précoce']);
  });
});
