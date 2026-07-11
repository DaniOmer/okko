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

  it('PUT /crops/:id/varieties/:varietyId met à jour la variété', async () => {
    const created = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Sorgho' }, scientificName: 'Sorghum bicolor', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const cropId = created.body.id;

    await request(app.getHttpServer()).post(`/crops/${cropId}/varieties`)
      .send({ name: { fr: 'Original' }, maturityDays: 90 })
      .expect(201);

    const listBefore = await request(app.getHttpServer()).get(`/crops/${cropId}/varieties`).expect(200);
    const varietyId = listBefore.body[0].id;
    expect(listBefore.body).toHaveLength(1);

    await request(app.getHttpServer()).put(`/crops/${cropId}/varieties/${varietyId}`)
      .send({ name: { fr: 'Modifié' }, maturityDays: 99 })
      .expect(200);

    const listAfter = await request(app.getHttpServer()).get(`/crops/${cropId}/varieties`).expect(200);
    expect(listAfter.body).toHaveLength(1);
    expect(listAfter.body[0].name.fr).toBe('Modifié');
    expect(listAfter.body[0].maturityDays).toBe(99);

    const crop = await request(app.getHttpServer()).get(`/crops/${cropId}`).expect(200);
    expect(crop.body.varieties).toHaveLength(1);
    expect(crop.body.varieties[0].name.fr).toBe('Modifié');
  });

  it('PUT /crops/:id/varieties/:varietyId retourne 404 pour un varietyId inexistant', async () => {
    const created = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Mil' }, scientificName: 'Pennisetum glaucum', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    const cropId = created.body.id;

    await request(app.getHttpServer()).put(`/crops/${cropId}/varieties/inexistant-id`)
      .send({ name: { fr: 'X' } })
      .expect(404);
  });
});
