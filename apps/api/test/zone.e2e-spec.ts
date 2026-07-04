import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Zones e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('creates a zone, sets crop suitability, and exposes it on the crop', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const zone = await request(app.getHttpServer()).post('/zones')
      .send({ name: { fr: 'Sahel' }, country: 'BJ', koppen: 'BSh' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/zones/${zone.body.id}`)
      .send({ rating: 'SUITABLE', justification: 'ok' })
      .expect(200);

    const zonesList = await request(app.getHttpServer()).get(`/crops/${crop.body.id}/zones`).expect(200);
    expect(zonesList.body).toHaveLength(1);
    expect(zonesList.body[0].zoneName.fr).toBe('Sahel');

    const cropDoc = await request(app.getHttpServer()).get(`/crops/${crop.body.id}`).expect(200);
    expect(cropDoc.body.zones).toHaveLength(1);
    expect(cropDoc.body.zones[0].rating).toBe('SUITABLE');

    const allZones = await request(app.getHttpServer()).get('/zones').expect(200);
    expect(allZones.body.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 404 setting suitability for an unknown zone', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Coton' }, scientificName: 'Gossypium', family: 'Malvaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/zones/does-not-exist`)
      .send({ rating: 'MARGINAL' })
      .expect(404);
  });
});
