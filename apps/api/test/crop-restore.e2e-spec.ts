import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { fillAllSections } from './helpers/complete-crop';

/**
 * E2E — restauration d'une version publiée (Lot C2, Task 3)
 *
 * Vérifie :
 *   - restaurer une révision passée ramène le brouillon à cet état exact
 *   - le brouillon restauré est republié en tant que nouvelle révision
 *   - culture jamais publiée → 409
 *   - révision inexistante → 404
 */
describe('Crop restore e2e', () => {
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

  it('restaure une version passée dans le brouillon, republié ensuite comme v3', async () => {
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Igname' },
        scientificName: 'Dioscorea',
        family: 'Dioscoreaceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    const id = created.body.id;

    // v1 : avec variété X
    await request(app.getHttpServer())
      .post(`/crops/${id}/varieties`)
      .send({ name: { fr: 'X' }, traits: [] })
      .expect(201);
    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // v2 : ajouter variété Y
    await request(app.getHttpServer())
      .post(`/crops/${id}/varieties`)
      .send({ name: { fr: 'Y' }, traits: [] })
      .expect(201);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // restaurer la révision 1 dans le brouillon
    await request(app.getHttpServer())
      .post(`/crops/${id}/versions/1/restore`)
      .expect(201);

    // le brouillon ne montre plus que les variétés de v1 (X + Variété test), avec modifs non publiées
    const draft = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    const draftVarNames = draft.body.varieties.map((x: any) => x.name.fr);
    expect(draftVarNames).toContain('X');
    expect(draftVarNames).not.toContain('Y');
    expect(draft.body.hasUnpublishedChanges).toBe(true);

    // republier → nouvelle révision 3
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    const versions = await request(app.getHttpServer())
      .get(`/crops/${id}/versions`)
      .expect(200);
    expect(versions.body.map((v: any) => v.revision)).toEqual([3, 2, 1]);
  });

  it('révision inexistante -> 404 ; culture jamais publiée -> 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Taro' },
        scientificName: 'Colocasia',
        family: 'Araceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    const id = created.body.id;

    // jamais publiée → restore → 409
    await request(app.getHttpServer())
      .post(`/crops/${id}/versions/1/restore`)
      .expect(409);

    // publier puis demander une révision inexistante → 404
    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    await request(app.getHttpServer())
      .post(`/crops/${id}/versions/99/restore`)
      .expect(404);
  });
});
