import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { fillAllSections } from './helpers/complete-crop';
import { asSuperadmin } from './helpers/auth';

/**
 * E2E — note de publication (E1)
 *
 * Vérifie que :
 *   - publier avec { note } stocke la note et la renvoie dans /versions
 *   - republier sans corps -> note null (rétro-compat)
 *   - les révisions sont renvoyées en ordre décroissant
 */
describe('Crop publish note e2e', () => {
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

  it('publier avec une note la renvoie dans /versions ; sans corps -> null', async () => {
    const created = await request(app.getHttpServer()).post('/crops').send({
      commonNames: { fr: 'Arachide' }, scientificName: 'Arachis hypogaea', family: 'Fabaceae', cycleType: 'SEASONAL_ANNUAL',
    }).expect(201);
    const id = created.body.id;

    // publier avec note
    await fillAllSections(app, id);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).send({ note: 'MAJ prix' }).expect(201);
    const v1 = await request(app.getHttpServer()).get(`/crops/${id}/versions`).expect(200);
    expect(v1.body[0].note).toBe('MAJ prix');

    // éditer puis republier SANS corps -> note null
    await request(app.getHttpServer()).patch(`/crops/${id}`).send({ commonNames: { fr: 'Arachide 2' } }).expect(200);
    await request(app.getHttpServer()).post(`/crops/${id}/publish`).expect(201);
    const v2 = await request(app.getHttpServer()).get(`/crops/${id}/versions`).expect(200);
    expect(v2.body.map((v: any) => v.revision)).toEqual([2, 1]);
    expect(v2.body[0].note).toBeNull();      // révision 2 (la plus récente), publiée sans note
    expect(v2.body[1].note).toBe('MAJ prix'); // révision 1
  });
});
