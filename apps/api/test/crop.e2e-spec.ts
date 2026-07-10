import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Crop e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.publishedCrop.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.publishedCrop.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('crée puis publie une culture', async () => {
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({ commonNames: { fr: 'Ananas' }, scientificName: 'Ananas comosus',
              family: 'Bromeliaceae', cycleType: 'PERENNIAL_HERBACEOUS' })
      .expect(201);
    const id = created.body.id;

    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    const got = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(got.body.status).toBe('PUBLISHED');
    expect(got.body.name).toBe('Ananas');

    // Publishing an already-PUBLISHED crop must return 409 Conflict
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(409);
  });
});
