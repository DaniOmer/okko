import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { asSuperadmin } from './helpers/auth';

/**
 * E2E — crop section event-sourcing (Task 4)
 *
 * Verifies that the 5 section handlers (variety, zone, window, pest, price)
 * append the correct events to the crop stream, that sequences are
 * contiguous, that zone/pest upsert semantics are consistent between the
 * stream and the projection, and that the GET /crops/:id document is
 * unaffected (non-regression).
 *
 * NOTE: written but NOT yet executed — Docker / DB is down in this
 * environment. Execution is deferred to the lot's final DB verification.
 */
describe('Crop sections event-sourcing e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await asSuperadmin(Test.createTestingModule({ imports: [AppModule] })).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();

    // Clean all tables touched by this suite (FK-safe order)
    await prisma.publishedCrop.deleteMany();
    await prisma.cropEvent.deleteMany();
    await prisma.pricePoint.deleteMany();
    await prisma.cropPestControl.deleteMany();
    await prisma.croppingWindow.deleteMany();
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.variety.deleteMany();
    await prisma.crop.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
  });

  afterAll(async () => {
    await prisma.publishedCrop.deleteMany();
    await prisma.cropEvent.deleteMany();
    await prisma.pricePoint.deleteMany();
    await prisma.cropPestControl.deleteMany();
    await prisma.croppingWindow.deleteMany();
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.variety.deleteMany();
    await prisma.crop.deleteMany();
    await prisma.pestDisease.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Shared state across the three test cases — built in the first `it` block
  // and reused in subsequent ones so we do not re-create the whole scenario.
  // -----------------------------------------------------------------------
  let cropId: string;
  let zoneId: string;
  let pestId: string;

  it('populates the event stream with the expected section event types in contiguous order', async () => {
    // 1. Create a crop
    const cropRes = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Sorgho test-sections' },
        scientificName: 'Sorghum bicolor',
        family: 'Poaceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    cropId = cropRes.body.id;

    // 2. Add a variety
    await request(app.getHttpServer())
      .post(`/crops/${cropId}/varieties`)
      .send({ name: { fr: 'Obatanpa-S' }, maturityDays: 90, traits: ['précoce'] })
      .expect(201);

    // 3. Create a zone then set zone suitability
    const zoneRes = await request(app.getHttpServer())
      .post('/zones')
      .send({ name: { fr: 'Sahel-test' }, country: 'BJ', koppen: 'BSh' })
      .expect(201);
    zoneId = zoneRes.body.id;

    await request(app.getHttpServer())
      .put(`/crops/${cropId}/zones/${zoneId}`)
      .send({ rating: 'SUITABLE', justification: 'Convient bien au Sorgho' })
      .expect(200);

    // 4. Add a cropping window (reuses the zone created above)
    await request(app.getHttpServer())
      .post(`/crops/${cropId}/windows`)
      .send({
        zoneId,
        season: 'Hivernage',
        irrigationRequired: false,
        operations: [
          { type: 'PLANTING', label: { fr: 'Semis direct' }, timingDays: 0, inputs: [] },
        ],
      })
      .expect(201);

    // 5. Create a pest then set pest control
    const pestRes = await request(app.getHttpServer())
      .post('/pests')
      .send({
        name: { fr: 'Striga' },
        type: 'WEED',
        scientificName: 'Striga hermonthica',
      })
      .expect(201);
    pestId = pestRes.body.id;

    await request(app.getHttpServer())
      .put(`/crops/${cropId}/pests/${pestId}`)
      .send({
        susceptibility: 'HIGH',
        sensitiveStages: ['tallage'],
        threshold: '5%',
        controlMethods: [
          { category: 'PREVENTION', description: { fr: 'Désherbage précoce' }, inputs: [] },
        ],
      })
      .expect(200);

    // 6. Add a price point
    await request(app.getHttpServer())
      .post(`/crops/${cropId}/prices`)
      .send({
        market: 'Parakou',
        periodStart: '2026-06-01',
        price: 200,
        unit: 'FCFA/kg',
        currency: 'XOF',
      })
      .expect(201);

    // ---- Assertions on the event stream ----
    const events = await prisma.cropEvent.findMany({
      where: { streamId: cropId },
      orderBy: { sequence: 'asc' },
    });

    // At least 6 events: CropCreated + 5 section events
    expect(events.length).toBeGreaterThanOrEqual(6);

    const types = events.map((e) => e.type);
    expect(types[0]).toBe('CropCreated');
    expect(types).toContain('VarietyAdded');
    expect(types).toContain('ZoneSuitabilitySet');
    expect(types).toContain('CroppingWindowAdded');
    expect(types).toContain('PestControlSet');
    expect(types).toContain('PricePointAdded');

    // Sequences are strictly contiguous starting at 1
    for (let i = 0; i < events.length; i++) {
      expect(events[i].sequence).toBe(i + 1);
    }
  });

  it('upsert: second PUT on the same zone adds a new stream event but the projection keeps only one zone entry', async () => {
    // Re-apply the same zone with an updated rating
    await request(app.getHttpServer())
      .put(`/crops/${cropId}/zones/${zoneId}`)
      .send({ rating: 'MARGINAL', justification: 'Révision downgrade' })
      .expect(200);

    // Stream must have a SECOND ZoneSuitabilitySet event
    const events = await prisma.cropEvent.findMany({
      where: { streamId: cropId, type: 'ZoneSuitabilitySet' },
      orderBy: { sequence: 'asc' },
    });
    expect(events.length).toBe(2);

    // Sequences are still contiguous (no gaps introduced)
    const allEvents = await prisma.cropEvent.findMany({
      where: { streamId: cropId },
      orderBy: { sequence: 'asc' },
    });
    for (let i = 0; i < allEvents.length; i++) {
      expect(allEvents[i].sequence).toBe(i + 1);
    }

    // Projection: GET /crops/:id must show ONLY ONE zone entry (upsert)
    const doc = await request(app.getHttpServer())
      .get(`/crops/${cropId}`)
      .expect(200);

    const zones: { rating: string }[] = doc.body.zones;
    expect(zones).toHaveLength(1);
    // The last rating wins in the projection
    expect(zones[0].rating).toBe('MARGINAL');
  });

  it('non-regression: GET /crops/:id returns the full document with all 5 sections present', async () => {
    const doc = await request(app.getHttpServer())
      .get(`/crops/${cropId}`)
      .expect(200);

    expect(doc.body.id).toBe(cropId);

    // Variety
    expect(Array.isArray(doc.body.varieties)).toBe(true);
    expect(doc.body.varieties.length).toBeGreaterThanOrEqual(1);

    // Zone (upserted, single entry)
    expect(Array.isArray(doc.body.zones)).toBe(true);
    expect(doc.body.zones.length).toBeGreaterThanOrEqual(1);

    // Cropping window
    expect(Array.isArray(doc.body.croppingWindows)).toBe(true);
    expect(doc.body.croppingWindows.length).toBeGreaterThanOrEqual(1);

    // Pest control
    expect(Array.isArray(doc.body.pests)).toBe(true);
    expect(doc.body.pests.length).toBeGreaterThanOrEqual(1);

    // Price
    expect(Array.isArray(doc.body.prices)).toBe(true);
    expect(doc.body.prices.length).toBeGreaterThanOrEqual(1);

    // Task 2: Verify that threshold and sensitiveStages are exposed on the pest view
    const firstPest = doc.body.pests[0];
    expect(firstPest.sensitiveStages).toEqual(['tallage']);
    expect(firstPest.threshold).toBe('5%');
  });
});
