import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { fillAllSections } from './helpers/complete-crop';

/**
 * E2E — historique des versions publiées (Lot C1, Task 2)
 *
 * Vérifie que chaque publication insère une révision distincte,
 * que la liste est triée décroissante (sans document), et que
 * chaque document figé reste consultable point-dans-le-temps.
 */
describe('Crop version history e2e', () => {
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

  it('conserve chaque version publiée, les liste et les consulte', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Sorgho' }, scientificName: 'Sorghum bicolor', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;

    // publier v1
    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    // éditer puis republier v2
    await request(app.getHttpServer()).patch(`/crops/${id}`).send({ commonNames: { fr: 'Sorgho commun' } }).expect(200);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // liste des versions : 2 entrées, tri décroissant, sans document
    const versions = await request(app.getHttpServer()).get(`/crops/${id}/versions`).expect(200);
    expect(versions.body.map((v: any) => v.revision)).toEqual([2, 1]);
    expect(versions.body[0].document).toBeUndefined();
    expect(versions.body[0].publishedBy).toBe('admin');

    // consulter chaque version figée
    const v1 = await request(app.getHttpServer()).get(`/crops/${id}/versions/1`).expect(200);
    expect(v1.body.name).toBe('Sorgho');
    const v2 = await request(app.getHttpServer()).get(`/crops/${id}/versions/2`).expect(200);
    expect(v2.body.name).toBe('Sorgho commun');

    // /published = dernière version
    const pub = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub.body.name).toBe('Sorgho commun');

    // révision inexistante -> 404
    await request(app.getHttpServer()).get(`/crops/${id}/versions/99`).expect(404);
  });

  it('renvoie une liste vide pour une culture jamais publiée', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Mil' }, scientificName: 'Pennisetum glaucum', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const versions = await request(app.getHttpServer()).get(`/crops/${created.body.id}/versions`).expect(200);
    expect(versions.body).toEqual([]);
  });
});
