import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { fillAllSections } from './helpers/complete-crop';

/**
 * E2E — diff sémantique entre versions publiées (Lot C3, Task 2)
 *
 * Vérifie GET /crops/:id/diff?from=A&to=B :
 *   - champs cœur : détecte le renommage (field 'name')
 *   - section varieties : added/removed par clé 'id'
 *   - symétrie : from→to / to→from inversent les résultats
 *   - from==to → diff vide (fields:[], sections:[])
 *   - révision inexistante → 404
 */
describe('Crop diff e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  it('compare deux versions publiées (champ cœur + section)', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Manioc' }, scientificName: 'Manihot esculenta', family: 'Euphorbiaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;

    // v1 : nom "Manioc" + variété X (+ sections complétées)
    await request(app.getHttpServer()).post(`/crops/${id}/varieties`).send({ name: { fr: 'X' }, traits: [] }).expect(201);
    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // v2 : renommer + variété Y en plus
    await request(app.getHttpServer()).patch(`/crops/${id}`).send({ commonNames: { fr: 'Manioc doux' } }).expect(200);
    await request(app.getHttpServer()).post(`/crops/${id}/varieties`).send({ name: { fr: 'Y' }, traits: [] }).expect(201);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // diff 1 -> 2
    const d = await request(app.getHttpServer()).get(`/crops/${id}/diff?from=1&to=2`).expect(200);
    expect(d.body.from).toBe(1);
    expect(d.body.to).toBe(2);
    const nameChange = d.body.fields.find((f: any) => f.field === 'name');
    expect(nameChange).toEqual({ field: 'name', before: 'Manioc', after: 'Manioc doux' });
    const varieties = d.body.sections.find((s: any) => s.section === 'varieties');
    expect(varieties.added.map((v: any) => v.name.fr)).toEqual(['Y']);
    expect(varieties.removed).toEqual([]);

    // diff inverse 2 -> 1 : Y en removed, nom inversé
    const rev = await request(app.getHttpServer()).get(`/crops/${id}/diff?from=2&to=1`).expect(200);
    const revVar = rev.body.sections.find((s: any) => s.section === 'varieties');
    expect(revVar.removed.map((v: any) => v.name.fr)).toEqual(['Y']);
    expect(rev.body.fields.find((f: any) => f.field === 'name')).toEqual({ field: 'name', before: 'Manioc doux', after: 'Manioc' });

    // from == to -> diff vide
    const same = await request(app.getHttpServer()).get(`/crops/${id}/diff?from=1&to=1`).expect(200);
    expect(same.body).toEqual({ cropId: id, from: 1, to: 1, fields: [], sections: [] });

    // révision inexistante -> 404
    await request(app.getHttpServer()).get(`/crops/${id}/diff?from=1&to=99`).expect(404);

    // révision non-numérique -> 404
    await request(app.getHttpServer()).get(`/crops/${id}/diff?from=abc&to=1`).expect(404);
  });
});
