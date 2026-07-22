import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { asSuperadmin } from './helpers/auth';

describe('Zone & Pest CRUD e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await asSuperadmin(Test.createTestingModule({ imports: [AppModule] })).compile();
    app = mod.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.cropPestControl.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.pest.deleteMany();
    await prisma.crop.deleteMany();
  });

  afterAll(async () => {
    await prisma.cropZoneSuitability.deleteMany();
    await prisma.cropPestControl.deleteMany();
    await prisma.agroEcologicalZone.deleteMany();
    await prisma.pest.deleteMany();
    await prisma.crop.deleteMany();
    await app.close();
  });

  // ── ZONE ──────────────────────────────────────────────────────────────────

  it('PATCH /zones/:id renomme la zone (200, nom mis à jour)', async () => {
    const zone = await request(app.getHttpServer())
      .post('/zones')
      .send({ name: { fr: 'Sahel' }, country: 'BJ', koppen: 'BSh' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/zones/${zone.body.id}`)
      .send({ name: { fr: 'Sahel Nord' }, country: 'BJ', koppen: 'BSh' })
      .expect(200);

    expect(res.body.name).toBe('Sahel Nord');
  });

  it('PATCH /zones/:id inexistant → 404', async () => {
    await request(app.getHttpServer())
      .patch('/zones/non-existent-id')
      .send({ name: { fr: 'Test' }, country: 'BJ' })
      .expect(404);
  });

  it('DELETE /zones/:id libre → 204 puis GET → 404', async () => {
    const zone = await request(app.getHttpServer())
      .post('/zones')
      .send({ name: { fr: 'Zone à supprimer' }, country: 'BJ' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/zones/${zone.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/zones/${zone.body.id}`)
      .expect(404);
  });

  it('DELETE /zones/:id inexistant → 404', async () => {
    await request(app.getHttpServer())
      .delete('/zones/non-existent-id')
      .expect(404);
  });

  it('DELETE /zones/:id rattaché à une culture → 409 avec body.count === 1', async () => {
    const crop = await request(app.getHttpServer())
      .post('/crops')
      .send({ commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);

    const zone = await request(app.getHttpServer())
      .post('/zones')
      .send({ name: { fr: 'Zone liée' }, country: 'BJ', koppen: 'BSh' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/zones/${zone.body.id}`)
      .send({ rating: 'SUITABLE', justification: 'ok' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .delete(`/zones/${zone.body.id}`)
      .expect(409);

    expect(res.body.count).toBe(1);
  });

  // ── PEST ──────────────────────────────────────────────────────────────────

  it('PATCH /pests/:id renomme le ravageur (200, nom mis à jour)', async () => {
    const pest = await request(app.getHttpServer())
      .post('/pests')
      .send({ name: { fr: 'Chenille' }, type: 'INSECT', scientificName: 'Spodoptera frugiperda' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/pests/${pest.body.id}`)
      .send({ name: { fr: 'Chenille légionnaire' }, type: 'INSECT', scientificName: 'Spodoptera frugiperda' })
      .expect(200);

    expect(res.body.name).toBe('Chenille légionnaire');
  });

  it('PATCH /pests/:id inexistant → 404', async () => {
    await request(app.getHttpServer())
      .patch('/pests/non-existent-id')
      .send({ name: { fr: 'Test' }, type: 'INSECT' })
      .expect(404);
  });

  it('DELETE /pests/:id libre → 204 puis GET → 404', async () => {
    const pest = await request(app.getHttpServer())
      .post('/pests')
      .send({ name: { fr: 'Ravageur à supprimer' }, type: 'FUNGUS' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/pests/${pest.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/pests/${pest.body.id}`)
      .expect(404);
  });

  it('DELETE /pests/:id inexistant → 404', async () => {
    await request(app.getHttpServer())
      .delete('/pests/non-existent-id')
      .expect(404);
  });

  it('DELETE /pests/:id rattaché à une culture → 409 avec body.count === 1', async () => {
    const crop = await request(app.getHttpServer())
      .post('/crops')
      .send({ commonNames: { fr: 'Manguier' }, scientificName: 'Mangifera indica', family: 'Anacardiaceae', cycleType: 'PERENNIAL_WOODY_FRUIT' })
      .expect(201);

    const pest = await request(app.getHttpServer())
      .post('/pests')
      .send({ name: { fr: 'Mouche des fruits' }, type: 'INSECT', scientificName: 'Bactrocera dorsalis' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/crops/${crop.body.id}/pests/${pest.body.id}`)
      .send({ susceptibility: 'HIGH', sensitiveStages: ['fruit'],
              controlMethods: [{ category: 'PREVENTION', description: { fr: 'Ensachage' }, inputs: [] }] })
      .expect(200);

    const res = await request(app.getHttpServer())
      .delete(`/pests/${pest.body.id}`)
      .expect(409);

    expect(res.body.count).toBe(1);
  });
});
