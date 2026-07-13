import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { fillAllSections } from './helpers/complete-crop';
import { asSuperadmin } from './helpers/auth';

describe('Crop e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await asSuperadmin(Test.createTestingModule({ imports: [AppModule] })).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.cropEvent.deleteMany();
    await prisma.publishedCrop.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.cropEvent.deleteMany();
    await prisma.publishedCrop.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('édite l\'identité via PATCH et GET reflète les nouvelles valeurs', async () => {
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({ commonNames: { fr: 'Soja' }, scientificName: 'Glycine max',
              family: 'Leguminosae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const id = created.body.id;

    await request(app.getHttpServer())
      .patch(`/crops/${id}`)
      .send({ family: 'Fabaceae', cycleType: 'PERENNIAL_HERBACEOUS' })
      .expect(200);

    const got = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(got.body.family).toBe('Fabaceae');
    expect(got.body.cycleType).toBe('PERENNIAL_HERBACEOUS');
  });

  it('crée puis publie une culture', async () => {
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({ commonNames: { fr: 'Ananas' }, scientificName: 'Ananas comosus',
              family: 'Bromeliaceae', cycleType: 'PERENNIAL_HERBACEOUS' })
      .expect(201);
    const id = created.body.id;

    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    const got = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(got.body.status).toBe('PUBLISHED');
    expect(got.body.name).toBe('Ananas');

    // Re-publishing an already-PUBLISHED crop is now allowed (PUBLISHED→PUBLISHED)
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
  });
});
