import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Phenology & windows e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.croppingWindow.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.croppingWindow.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('sets phenology and adds a cropping window, visible on the crop', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const zone = await request(app.getHttpServer()).post('/zones')
      .send({ name: { fr: 'Sahel' }, country: 'BJ' }).expect(201);

    await request(app.getHttpServer()).patch(`/crops/${crop.body.id}/phenology`)
      .send({ stages: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }] })
      .expect(200);

    await request(app.getHttpServer()).post(`/crops/${crop.body.id}/windows`)
      .send({ zoneId: zone.body.id, season: 'Saison sèche', irrigationRequired: true,
              operations: [{ type: 'PLANTING', label: { fr: 'Semis' }, timingDays: 0, inputs: [] }] })
      .expect(201);

    const list = await request(app.getHttpServer()).get(`/crops/${crop.body.id}/windows`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].season).toBe('Saison sèche');

    const doc = await request(app.getHttpServer()).get(`/crops/${crop.body.id}`).expect(200);
    expect(doc.body.phenology).toHaveLength(1);
    expect(doc.body.croppingWindows).toHaveLength(1);
  });

  it('returns 404 adding a window for an unknown zone', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Coton' }, scientificName: 'Gossypium', family: 'Malvaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    await request(app.getHttpServer()).post(`/crops/${crop.body.id}/windows`)
      .send({ zoneId: 'nope', season: 'S' }).expect(404);
  });
});
