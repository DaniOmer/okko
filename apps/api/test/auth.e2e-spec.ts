import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { NOTIFICATION_PORT } from '../src/application/notification/notification-port';
import { FakeNotificationSender } from '../src/infrastructure/notification/fake-notification-sender';

describe('Auth e2e', () => {
  let app: INestApplication; let prisma: PrismaService;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NOTIFICATION_PORT).useClass(FakeNotificationSender).compile();
    app = mod.createNestApplication(); prisma = app.get(PrismaService); await app.init();
    await prisma.invitation.deleteMany(); await prisma.authIdentity.deleteMany(); await prisma.user.deleteMany(); await prisma.organization.deleteMany();
  });
  afterAll(async () => {
    await prisma.invitation.deleteMany(); await prisma.authIdentity.deleteMany(); await prisma.user.deleteMany(); await prisma.organization.deleteMany(); await app.close();
  });

  let adminToken: string;

  it('register → login → me ; invite → accept → login editor', async () => {
    const reg = await request(app.getHttpServer()).post('/auth/register')
      .send({ email: 'admin@coop.bj', password: 'pw', name: 'Chef', organizationName: 'Coop' }).expect(201);
    adminToken = reg.body.token;
    expect(reg.body.user.role).toBe('admin');

    await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const inv = await request(app.getHttpServer()).post('/auth/invitations')
      .set('Authorization', `Bearer ${adminToken}`).send({ email: 'agent@coop.bj' }).expect(201);
    const token = inv.body.invitation.token;

    const acc = await request(app.getHttpServer()).post(`/auth/invitations/${token}/accept`)
      .send({ name: 'Agent', password: 'pw2' }).expect(201);
    expect(acc.body.user.role).toBe('editor');
    expect(acc.body.user.organizationId).toBe(reg.body.user.organizationId);

    // editor ne peut pas inviter (403)
    await request(app.getHttpServer()).post('/auth/invitations')
      .set('Authorization', `Bearer ${acc.body.token}`).send({ email: 'x@y.z' }).expect(403);

    // token d'invitation à usage unique
    await request(app.getHttpServer()).post(`/auth/invitations/${token}/accept`).send({ name: 'X', password: 'p' }).expect(410);
  });

  it('auth-contract: POST /crops sans token → 401 ; admin → 403 (superadmin only) ; GET /crops/:id/published sans token → 404 not 401', async () => {
    // POST /crops sans Authorization → AuthGuard doit rejeter → 401
    await request(app.getHttpServer()).post('/crops').send({}).expect(401);

    // POST /crops avec le token admin → RolesGuard rejette (Base est superadmin-only) → 403
    await request(app.getHttpServer()).post('/crops').set('Authorization', `Bearer ${adminToken}`).send({}).expect(403);

    // GET /crops/<id-inconnu>/published sans token → @Public() bypass, route existe → 404 (pas 401)
    await request(app.getHttpServer()).get('/crops/unknown-id-00000/published').expect(404);
  });
});
