import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('History & completeness e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.auditLog.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('exposes crop history and a completeness report', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const id = crop.body.id;

    // a second crop-level mutation to grow the history
    await request(app.getHttpServer()).patch(`/crops/${id}/requirements`)
      .send({ climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } } })
      .expect(200);

    const history = await request(app.getHttpServer()).get(`/crops/${id}/history`).expect(200);
    expect(history.body.length).toBeGreaterThanOrEqual(2); // create + requirements
    expect(history.body[0]).toHaveProperty('entityType', 'Crop');

    const doc = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(doc.body.completeness.total).toBe(10);
    expect(doc.body.completeness.categories.climatic).toBe(true); // set via requirements
  });

  it('returns 404 for the history of an unknown crop', async () => {
    await request(app.getHttpServer()).get('/crops/does-not-exist/history').expect(404);
  });
});
