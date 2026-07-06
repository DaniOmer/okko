import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Crop event sourcing e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
    await prisma.cropEvent.deleteMany();
    await prisma.crop.deleteMany();
  });

  afterAll(async () => {
    await prisma.cropEvent.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  it('populates the event stream with the expected ordered event types', async () => {
    // 1. Create a crop
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Sorgho' },
        scientificName: 'Sorghum bicolor',
        family: 'Poaceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    const cropId = created.body.id;

    // 2. Apply climatic requirements mutation
    await request(app.getHttpServer())
      .patch(`/crops/${cropId}/requirements`)
      .send({ climatic: { temperature: { min: 20, optimal: 28, max: 35, unit: '°C' } } })
      .expect(200);

    // 3. Apply phenology mutation
    await request(app.getHttpServer())
      .patch(`/crops/${cropId}/phenology`)
      .send({
        stages: [
          { name: { fr: 'Germination' }, durationDays: 7, description: { fr: 'Levée' } },
        ],
      })
      .expect(200);

    // 4. Publish
    await request(app.getHttpServer())
      .post(`/crops/${cropId}/publish`)
      .expect(201);

    // 5. Verify the event stream via PrismaService
    const events = await prisma.cropEvent.findMany({
      where: { streamId: cropId },
      orderBy: { sequence: 'asc' },
    });

    expect(events.length).toBeGreaterThanOrEqual(4);

    const types = events.map((e) => e.type);
    expect(types[0]).toBe('CropCreated');
    expect(types).toContain('ClimaticRequirementsSet');
    expect(types).toContain('PhenologySet');
    expect(types[types.length - 1]).toBe('Published');

    // Sequences are strictly increasing starting at 1
    for (let i = 0; i < events.length; i++) {
      expect(events[i].sequence).toBe(i + 1);
    }
  });

  it('GET /crops/:id returns the expected document after mutations (non-regression)', async () => {
    // Create a new crop for this test
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Maïs' },
        scientificName: 'Zea mays',
        family: 'Poaceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    const cropId = created.body.id;

    // Apply requirements
    await request(app.getHttpServer())
      .patch(`/crops/${cropId}/requirements`)
      .send({ climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } } })
      .expect(200);

    // Publish
    await request(app.getHttpServer())
      .post(`/crops/${cropId}/publish`)
      .expect(201);

    // GET must return the full document with expected fields
    const doc = await request(app.getHttpServer())
      .get(`/crops/${cropId}`)
      .expect(200);

    expect(doc.body.id).toBe(cropId);
    expect(doc.body.name).toBe('Maïs');
    expect(doc.body.status).toBe('PUBLISHED');
    expect(doc.body.climatic).toBeDefined();
    expect(doc.body.climatic.temperature.min).toBe(18);
  });
});
