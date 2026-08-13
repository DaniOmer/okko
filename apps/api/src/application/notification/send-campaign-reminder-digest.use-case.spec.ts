import { SendCampaignReminderDigestUseCase, CampaignRecommendationsReader } from './send-campaign-reminder-digest.use-case';
import { InMemoryNotificationLogRepository } from './in-memory-notification-log.repository';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';
import { InMemoryCampaignRepository } from '../parcel/in-memory-campaign.repository';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';
import { CampaignNotFoundError } from '../parcel/errors';
import type { ParcelRepository } from '../parcel/parcel.repository';
import type { UserRepository } from '../auth/repositories';
import type { User } from '../auth/types';

const clock = { nowIso: () => '2026-08-13T00:00:00.000Z' };
const parcelRepoOf = (name: string): ParcelRepository => ({ findById: async () => ({ id: 'p1', organizationId: 'o1', name, createdAt: '' }) } as unknown as ParcelRepository);
const mkUser = (over: Partial<User>): User => ({ id: 'u', email: 'u@x.z', firstName: 'A', lastName: 'B', role: 'AGRONOMIST', organizationId: 'o1', emailVerifiedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), ...over });
const userRepoOf = (users: User[]): UserRepository => ({ listByOrganization: async () => users } as unknown as UserRepository);
const recoOf = (items: { label: string; dueDate?: string; status: string }[]): CampaignRecommendationsReader => ({ execute: async () => ({ items }) });

function make(opts: { items: { label: string; dueDate?: string; status: string }[]; users: User[] }) {
  let n = 0;
  const ids = { next: () => `log${++n}` };
  const campaigns = new InMemoryCampaignRepository();
  const prefs = new InMemoryNotificationPreferenceRepository();
  const log = new InMemoryNotificationLogRepository();
  const notifier = new FakeNotificationSender();
  const uc = new SendCampaignReminderDigestUseCase(campaigns, parcelRepoOf('Parcelle Nord'), recoOf(opts.items), userRepoOf(opts.users), prefs, log, notifier, clock, ids);
  return { campaigns, prefs, log, notifier, uc };
}
async function seedCampaign(campaigns: InMemoryCampaignRepository) {
  await campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', windowId: 'w1', season: 'Saison 2026', status: 'ACTIVE', createdAt: clock.nowIso() });
}
const DUE = [{ label: 'Sarclage', dueDate: '2026-05-01', status: 'OVERDUE' }, { label: 'Fumure', status: 'DUE_SOON' }, { label: 'Récolte', status: 'UPCOMING' }, { label: 'Semis', status: 'DONE' }];
const oneAgro = [mkUser({ id: 'u1', email: 'a@x.z' })];

describe('SendCampaignReminderDigestUseCase — cadence par destinataire', () => {
  it('premier envoi (aucun dernier rappel) → envoyé, filtre OVERDUE/DUE_SOON, upsert sentAt', async () => {
    const { campaigns, log, notifier, uc } = make({ items: DUE, users: oneAgro });
    await seedCampaign(campaigns);
    const res = await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' });
    expect(res).toEqual({ sent: 1 });
    const n = notifier.sent[0];
    expect(n.kind).toBe('campaign_reminder');
    if (n.kind === 'campaign_reminder') { expect(n.to).toBe('a@x.z'); expect(n.items.map((i) => i.label)).toEqual(['Sarclage', 'Fumure']); }
    expect(await log.lastSentAt('campaign_reminder:c1:u1')).toBe('2026-08-13T00:00:00.000Z');
  });
  it('cadence: dernier rappel hier + tous les 2 jours → passé (rien envoyé)', async () => {
    const { campaigns, prefs, log, notifier, uc } = make({ items: DUE, users: oneAgro });
    await seedCampaign(campaigns);
    await prefs.upsert('u1', 2);
    await log.recordSent({ id: 'x', organizationId: 'o1', dedupKey: 'campaign_reminder:c1:u1', kind: 'campaign_reminder', sentAt: '2026-08-12T00:00:00.000Z' });
    const res = await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' });
    expect(res).toEqual({ sent: 0 });
    expect(notifier.sent).toHaveLength(0);
  });
  it('cadence: dernier rappel il y a 2 jours + tous les 2 jours → envoyé', async () => {
    const { campaigns, prefs, log, notifier, uc } = make({ items: DUE, users: oneAgro });
    await seedCampaign(campaigns);
    await prefs.upsert('u1', 2);
    await log.recordSent({ id: 'x', organizationId: 'o1', dedupKey: 'campaign_reminder:c1:u1', kind: 'campaign_reminder', sentAt: '2026-08-11T00:00:00.000Z' });
    const res = await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' });
    expect(res).toEqual({ sent: 1 });
    expect(notifier.sent).toHaveLength(1);
  });
  it('aucune échéance due → no_due_items', async () => {
    const { campaigns, notifier, uc } = make({ items: [{ label: 'Récolte', status: 'UPCOMING' }], users: oneAgro });
    await seedCampaign(campaigns);
    expect(await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' })).toEqual({ sent: 0, skipped: 'no_due_items' });
    expect(notifier.sent).toHaveLength(0);
  });
  it('aucun destinataire éligible → no_recipients', async () => {
    const { campaigns, notifier, uc } = make({ items: DUE, users: [mkUser({ id: 'v', email: 'v@x.z', role: 'VIEWER' })] });
    await seedCampaign(campaigns);
    expect(await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-13T09:00:00.000Z' })).toEqual({ sent: 0, skipped: 'no_recipients' });
    expect(notifier.sent).toHaveLength(0);
  });
  it("campagne d'une autre org → CampaignNotFoundError", async () => {
    const { campaigns, uc } = make({ items: DUE, users: oneAgro });
    await seedCampaign(campaigns);
    await expect(uc.execute({ campaignId: 'c1', organizationId: 'oX', today: '2026-08-13T09:00:00.000Z' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
