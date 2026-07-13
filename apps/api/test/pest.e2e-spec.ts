import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { asSuperadmin } from './helpers/auth';

describe('Pests e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await asSuperadmin(Test.createTestingModule({ imports: [AppModule] })).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.cropPestControl.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.cropPestControl.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('creates a pest, sets crop control, and exposes it on the crop', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Manguier' }, scientificName: 'Mangifera indica', family: 'Anacardiaceae', cycleType: 'PERENNIAL_WOODY_FRUIT' })
      .expect(201);
    const pest = await request(app.getHttpServer()).post('/pests')
      .send({ name: { fr: 'Mouche des fruits' }, type: 'INSECT', scientificName: 'Bactrocera dorsalis' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/pests/${pest.body.id}`)
      .send({ susceptibility: 'HIGH', sensitiveStages: ['fruit'],
              controlMethods: [{ category: 'PREVENTION', description: { fr: 'Ensachage' }, inputs: [] }] })
      .expect(200);

    const list = await request(app.getHttpServer()).get(`/crops/${crop.body.id}/pests`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].pestName.fr).toBe('Mouche des fruits');

    const doc = await request(app.getHttpServer()).get(`/crops/${crop.body.id}`).expect(200);
    expect(doc.body.pests).toHaveLength(1);
    expect(doc.body.pests[0].susceptibility).toBe('HIGH');

    const all = await request(app.getHttpServer()).get('/pests').expect(200);
    expect(all.body.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 404 setting control for an unknown pest', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Coton' }, scientificName: 'Gossypium', family: 'Malvaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/pests/does-not-exist`)
      .send({ susceptibility: 'LOW' })
      .expect(404);
  });
});
