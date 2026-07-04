import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Nutrition, yields & prices e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.pricePoint.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.pricePoint.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('sets nutrition + yields and adds a price, visible on the crop', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const id = crop.body.id;

    await request(app.getHttpServer()).patch(`/crops/${id}/nutrition`)
      .send({ requirements: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: 'PER_HECTARE' }] })
      .expect(200);

    await request(app.getHttpServer()).patch(`/crops/${id}/yields`)
      .send({ yields: [{ inputLevel: 'MEDIUM', min: 2, average: 4, potential: 6, unit: 't/ha' }] })
      .expect(200);

    await request(app.getHttpServer()).post(`/crops/${id}/prices`)
      .send({ market: 'Dantokpa', date: '2026-06-01', price: 350, unit: 'FCFA/kg', currency: 'XOF' })
      .expect(201);

    const prices = await request(app.getHttpServer()).get(`/crops/${id}/prices`).expect(200);
    expect(prices.body).toHaveLength(1);
    expect(prices.body[0].market).toBe('Dantokpa');

    const doc = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(doc.body.nutrition).toHaveLength(1);
    expect(doc.body.yields).toHaveLength(1);
    expect(doc.body.prices).toHaveLength(1);
  });

  it('returns 404 adding a price for an unknown crop', async () => {
    await request(app.getHttpServer()).post('/crops/does-not-exist/prices')
      .send({ market: 'M', date: '2026-06-01', price: 1, unit: 'u', currency: 'XOF' })
      .expect(404);
  });
});
