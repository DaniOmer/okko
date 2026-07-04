import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Requirements & varieties e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.variety.deleteMany();
    await prisma.crop.deleteMany();
  });
  afterAll(async () => {
    await prisma.variety.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('sets requirements and adds a variety, visible on the crop', async () => {
    const created = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const id = created.body.id;

    await request(app.getHttpServer()).patch(`/crops/${id}/requirements`)
      .send({ climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
              edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' } } })
      .expect(200);

    await request(app.getHttpServer()).post(`/crops/${id}/varieties`)
      .send({ name: { fr: 'Obatanpa' }, maturityDays: 120, traits: ['précoce'] })
      .expect(201);

    const list = await request(app.getHttpServer()).get(`/crops/${id}/varieties`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name.fr).toBe('Obatanpa');

    const crop = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(crop.body.climatic.temperature.optimal).toBe(25);
    expect(crop.body.varieties).toHaveLength(1);
  });
});
