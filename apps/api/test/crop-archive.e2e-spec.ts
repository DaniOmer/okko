import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { asSuperadmin } from './helpers/auth';

/**
 * E2E — archivage réversible d'une culture (Task 2)
 *
 * Vérifie :
 *   - POST /crops/:id/archive → statut ARCHIVED
 *   - POST /crops/:id/unarchive → statut DRAFT
 *   - re-archive après unarchive → OK
 *   - POST /unarchive sur une culture non archivée → 409
 */
describe('Crop archive e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await asSuperadmin(Test.createTestingModule({ imports: [AppModule] })).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();

    await prisma.publishedCrop.deleteMany();
    await prisma.cropEvent.deleteMany();
    await prisma.pricePoint.deleteMany();
    await prisma.cropPestControl.deleteMany();
    await prisma.croppingWindow.deleteMany();
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.variety.deleteMany();
    await prisma.crop.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
  });

  afterAll(async () => {
    await prisma.publishedCrop.deleteMany();
    await prisma.cropEvent.deleteMany();
    await prisma.pricePoint.deleteMany();
    await prisma.cropPestControl.deleteMany();
    await prisma.croppingWindow.deleteMany();
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.variety.deleteMany();
    await prisma.crop.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await app.close();
  });

  async function createDraftCrop(name: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/crops')
      .send({ commonNames: { fr: name }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    return res.body.id;
  }

  it('archive une culture DRAFT → statut ARCHIVED, puis GET confirme', async () => {
    const id = await createDraftCrop('Maïs archive');
    const res = await request(app.getHttpServer()).post(`/crops/${id}/archive`).expect(201);
    expect(res.body.status).toBe('ARCHIVED');

    const get = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(get.body.status).toBe('ARCHIVED');
  });

  it('désarchive une culture ARCHIVED → statut DRAFT', async () => {
    const id = await createDraftCrop('Sorgho unarchive');
    await request(app.getHttpServer()).post(`/crops/${id}/archive`).expect(201);
    const res = await request(app.getHttpServer()).post(`/crops/${id}/unarchive`).expect(201);
    expect(res.body.status).toBe('DRAFT');

    const get = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(get.body.status).toBe('DRAFT');
  });

  it('re-archive après unarchive → OK (ARCHIVED)', async () => {
    const id = await createDraftCrop('Mil re-archive');
    await request(app.getHttpServer()).post(`/crops/${id}/archive`).expect(201);
    await request(app.getHttpServer()).post(`/crops/${id}/unarchive`).expect(201);
    const res = await request(app.getHttpServer()).post(`/crops/${id}/archive`).expect(201);
    expect(res.body.status).toBe('ARCHIVED');
  });

  it('unarchive sur une culture DRAFT (non archivée) → 409', async () => {
    const id = await createDraftCrop('Arachide non-archivee');
    await request(app.getHttpServer()).post(`/crops/${id}/unarchive`).expect(409);
  });
});
