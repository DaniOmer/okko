import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { fillAllSections } from './helpers/complete-crop';
import { asSuperadmin } from './helpers/auth';

/**
 * E2E — brouillon/publié (Lot B, Task 6)
 *
 * Vérifie le parcours complet de sécurité éditoriale :
 *   - publier fige la version ; éditer diverge le brouillon mais pas le publié
 *   - republier (PUBLISHED→PUBLISHED autorisé) met à jour le document figé
 *   - abandonner ramène le brouillon au publié (y compris une section)
 *   - erreurs : 409 discard sans version publiée ; 404 published sur fiche jamais publiée
 */
describe('Crop versioning e2e', () => {
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

  it('publier fige la version ; éditer diverge le brouillon mais pas le publié', async () => {
    // Créer une culture
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Maïs' },
        scientificName: 'Zea mays',
        family: 'Poaceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    const id = created.body.id;

    // Publier
    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // /published renvoie le document figé
    const pub1 = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub1.body.id).toBe(id);
    expect(pub1.body.name).toBe('Maïs');

    // Éditer le brouillon (rename via PATCH)
    await request(app.getHttpServer())
      .patch(`/crops/${id}`)
      .send({ commonNames: { fr: 'Maïs modifié' } })
      .expect(200);

    // Le brouillon montre la modif + les drapeaux
    const draft = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(draft.body.name).toBe('Maïs modifié');
    expect(draft.body.hasUnpublishedChanges).toBe(true);
    expect(draft.body.hasPublishedVersion).toBe(true);

    // Le publié reste figé sur l'ancienne valeur
    const pub2 = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub2.body.name).toBe('Maïs');
  });

  it('republier met à jour le document figé', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Mil' }, scientificName: 'Pennisetum glaucum', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;

    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    const pub1 = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub1.body.name).toBe('Mil');

    // éditer le brouillon
    await request(app.getHttpServer()).patch(`/crops/${id}`).send({ commonNames: { fr: 'Mil perlé' } }).expect(200);

    // republier (PUBLISHED -> PUBLISHED désormais autorisé)
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // le figé reflète la nouvelle valeur, le brouillon n'a plus de modifs en attente
    const pub2 = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub2.body.name).toBe('Mil perlé');
    const draft = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(draft.body.hasUnpublishedChanges).toBe(false);
  });

  it('abandonner ramène le brouillon au publié (y compris une section)', async () => {
    // Créer une culture
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Sésame' },
        scientificName: 'Sesamum indicum',
        family: 'Pedaliaceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    const id = created.body.id;

    // Ajouter une première variété avant la publication
    await request(app.getHttpServer())
      .post(`/crops/${id}/varieties`)
      .send({ name: { fr: 'Inamar' }, maturityDays: 85, traits: ['précoce'] })
      .expect(201);

    // Publier
    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // Ajouter une deuxième variété (non publiée)
    await request(app.getHttpServer())
      .post(`/crops/${id}/varieties`)
      .send({ name: { fr: 'Sansun' }, maturityDays: 95, traits: ['tardif'] })
      .expect(201);

    // Vérifier qu'on voit bien Inamar + Sansun (+ Variété test de fillAllSections) dans le brouillon
    const draftVarieties = await request(app.getHttpServer()).get(`/crops/${id}/varieties`).expect(200);
    expect(draftVarieties.body).toHaveLength(3);

    // Abandonner les modifications
    await request(app.getHttpServer()).post(`/crops/${id}/discard`).expect(201);

    // Après abandon : deux variétés publiées (Variété test + Inamar)
    const afterDiscard = await request(app.getHttpServer()).get(`/crops/${id}/varieties`).expect(200);
    expect(afterDiscard.body).toHaveLength(2);
    expect(afterDiscard.body.map((v: any) => v.name.fr)).toContain('Inamar');

    // hasUnpublishedChanges est revenu à false
    const afterDraft = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(afterDraft.body.hasUnpublishedChanges).toBe(false);
  });

  it('refuse la publication d\'une fiche incomplète (422)', async () => {
    const crop = await request(app.getHttpServer()).post('/crops')
      .send({ commonNames: { fr: 'Vide' }, scientificName: 'X', family: 'X', cycleType: 'SEASONAL_ANNUAL' })
      .expect(201);
    await request(app.getHttpServer()).post(`/crops/${crop.body.id}/publish`).expect(422);
  });

  it('abandonner sans version publiée -> 409 ; /published sur fiche jamais publiée -> 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Sorgho' },
        scientificName: 'Sorghum bicolor',
        family: 'Poaceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    const id = created.body.id;

    // Jamais publié => /published doit retourner 404
    await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(404);

    // Jamais publié => /discard doit retourner 409
    await request(app.getHttpServer()).post(`/crops/${id}/discard`).expect(409);
  });
});
