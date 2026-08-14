import { SendCampaignStageAdviceUseCase } from './send-campaign-stage-advice.use-case';
import { InMemoryCampaignRepository } from '../parcel/in-memory-campaign.repository';
import { InMemoryOperationLogRepository } from '../parcel/in-memory-operation-log.repository';
import { InMemoryPublishedCropRepository } from '../crop/in-memory-published-crop.repository';
import { InMemoryNotificationLogRepository } from './in-memory-notification-log.repository';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';
import { CampaignNotFoundError } from '../parcel/errors';
import type { CropDocument } from '../crop/crop-read-model';
import type { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import type { ParcelRepository } from '../parcel/parcel.repository';
import type { UserRepository } from '../auth/repositories';
import type { User } from '../auth/types';

const PHENO: PhenologicalStageJSON[] = [{ name: { fr: 'Floraison' }, startDay: 50, endDay: 65, order: 1, recommendedWork: 'Surveiller les pucerons.' }];
const clock = { nowIso: () => '2026-08-13T00:00:00.000Z' };
const parcelRepoOf = (name: string): ParcelRepository => ({ findById: async () => ({ id: 'p1', organizationId: 'o1', name, createdAt: '' }) } as unknown as ParcelRepository);
const mkUser = (over: Partial<User>): User => ({ id: 'u', email: 'u@x.z', firstName: 'A', lastName: 'B', role: 'AGRONOMIST', organizationId: 'o1', emailVerifiedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), ...over });
const userRepoOf = (users: User[]): UserRepository => ({ listByOrganization: async () => users } as unknown as UserRepository);

function make(users: User[]) {
  let n = 0;
  const ids = { next: () => `log${++n}` };
  const campaigns = new InMemoryCampaignRepository();
  const ops = new InMemoryOperationLogRepository();
  const published = new InMemoryPublishedCropRepository();
  const prefs = new InMemoryNotificationPreferenceRepository();
  const log = new InMemoryNotificationLogRepository();
  const notifier = new FakeNotificationSender();
  const uc = new SendCampaignStageAdviceUseCase(campaigns, parcelRepoOf('Parcelle Nord'), published, ops, userRepoOf(users), prefs, log, notifier, clock, ids);
  return { campaigns, published, prefs, log, notifier, uc };
}
async function seed(m: ReturnType<typeof make>, opts: { cropId?: string; startDate?: string; pheno?: PhenologicalStageJSON[] } = {}) {
  const cropId = 'cropId' in opts ? opts.cropId : 'crop1';
  await m.campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId, season: 'Saison 2026', startDate: opts.startDate ?? '2026-06-19', status: 'ACTIVE', createdAt: '' });
  if (cropId) await m.published.save({ cropId, revision: 1, document: { phenology: opts.pheno ?? PHENO } as unknown as CropDocument, version: 1, publishedAt: '', publishedBy: '', note: null });
}
const oneAgro = [mkUser({ id: 'u1', email: 'a@x.z' })];

describe('SendCampaignStageAdviceUseCase', () => {
  it('premier envoi → conseil du stade courant, upsert sentAt', async () => {
    const m = make(oneAgro); await seed(m);
    const res = await m.uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' });
    expect(res).toEqual({ sent: 1 });
    const n = m.notifier.sent[0];
    expect(n.kind).toBe('campaign_advice');
    if (n.kind === 'campaign_advice') { expect(n.to).toBe('a@x.z'); expect(n.stageName).toBe('Floraison'); expect(n.advice).toBe('Surveiller les pucerons.'); }
    expect(await m.log.lastSentAt('campaign_advice:c1:u1')).toBe('2026-08-13T00:00:00.000Z');
  });
  it('cadence: dernier conseil hier + tous les 2 jours → passé', async () => {
    const m = make(oneAgro); await seed(m);
    await m.prefs.upsert('u1', 2);
    await m.log.recordSent({ id: 'x', organizationId: 'o1', dedupKey: 'campaign_advice:c1:u1', kind: 'campaign_advice', sentAt: '2026-08-12T00:00:00.000Z' });
    const res = await m.uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' });
    expect(res).toEqual({ sent: 0 });
    expect(m.notifier.sent).toHaveLength(0);
  });
  it('pas de cropId → no_reference', async () => {
    const m = make(oneAgro); await seed(m, { cropId: undefined });
    expect(await m.uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' })).toEqual({ sent: 0, skipped: 'no_reference' });
  });
  it('hors de tout stade → no_advice', async () => {
    const m = make(oneAgro); await seed(m, { startDate: '2026-08-01' });
    expect(await m.uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' })).toEqual({ sent: 0, skipped: 'no_advice' });
  });
  it('aucun destinataire → no_recipients', async () => {
    const m = make([mkUser({ id: 'v', email: 'v@x.z', role: 'VIEWER' })]); await seed(m);
    expect(await m.uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' })).toEqual({ sent: 0, skipped: 'no_recipients' });
  });
  it("campagne d'une autre org → CampaignNotFoundError", async () => {
    const m = make(oneAgro); await seed(m);
    await expect(m.uc.execute({ campaignId: 'c1', organizationId: 'oX', today: '2026-08-13T09:00:00.000Z' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
