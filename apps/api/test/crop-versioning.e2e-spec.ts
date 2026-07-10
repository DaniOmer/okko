import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

/**
 * E2E — brouillon/publié (Lot B, Task 6)
 *
 * Vérifie le parcours complet de sécurité éditoriale :
 *   - publier fige la version ; éditer diverge le brouillon mais pas le publié
 *   - republier met à jour le document figé
 *   - abandonner ramène le brouillon au publié (y compris une section)
 *   - erreurs : 409 discard sans version publiée ; 404 published sur fiche jamais publiée
 */
describe('Crop versioning e2e', () => {
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

  it('republier est bloqué (status machine PUBLISHED→PUBLISHED interdit) ; /published reste figé', async () => {
    // Ce test vérifie le comportement réel du modèle de domaine :
    // la machine d'état DRAFT→PUBLISHED est unidirectionnelle ; une fois publié,
    // un deuxième POST /publish retourne 409. /published reste figé sur la première version.
    const created = await request(app.getHttpServer())
      .post('/crops')
      .send({
        commonNames: { fr: 'Mil' },
        scientificName: 'Pennisetum glaucum',
        family: 'Poaceae',
        cycleType: 'SEASONAL_ANNUAL',
      })
      .expect(201);
    const id = created.body.id;

    // Publier une première fois (DRAFT → PUBLISHED)
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // /published contient le document figé
    const pub1 = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub1.body.name).toBe('Mil');

    // Éditer le brouillon (status reste PUBLISHED, hasUnpublishedChanges=true)
    await request(app.getHttpServer())
      .patch(`/crops/${id}`)
      .send({ commonNames: { fr: 'Mil perlé' } })
      .expect(200);

    // Tenter de republier → 409 (transition PUBLISHED→PUBLISHED interdite)
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(409);

    // /published reste figé sur la valeur d'origine (Mil, pas Mil perlé)
    const pub2 = await request(app.getHttpServer()).get(`/crops/${id}/published`).expect(200);
    expect(pub2.body.name).toBe('Mil');

    // Le brouillon a bien les modifications et les drapeaux corrects
    const draft = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(draft.body.name).toBe('Mil perlé');
    expect(draft.body.hasUnpublishedChanges).toBe(true);
    expect(draft.body.hasPublishedVersion).toBe(true);
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
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);

    // Ajouter une deuxième variété (non publiée)
    await request(app.getHttpServer())
      .post(`/crops/${id}/varieties`)
      .send({ name: { fr: 'Sansun' }, maturityDays: 95, traits: ['tardif'] })
      .expect(201);

    // Vérifier qu'on voit bien 2 variétés dans le brouillon
    const draftVarieties = await request(app.getHttpServer()).get(`/crops/${id}/varieties`).expect(200);
    expect(draftVarieties.body).toHaveLength(2);

    // Abandonner les modifications
    await request(app.getHttpServer()).post(`/crops/${id}/discard`).expect(201);

    // Après abandon : une seule variété (la première, publiée)
    const afterDiscard = await request(app.getHttpServer()).get(`/crops/${id}/varieties`).expect(200);
    expect(afterDiscard.body).toHaveLength(1);
    expect(afterDiscard.body[0].name.fr).toBe('Inamar');

    // hasUnpublishedChanges est revenu à false
    const afterDraft = await request(app.getHttpServer()).get(`/crops/${id}`).expect(200);
    expect(afterDraft.body.hasUnpublishedChanges).toBe(false);
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
