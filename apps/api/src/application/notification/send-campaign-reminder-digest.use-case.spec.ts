import { SendCampaignReminderDigestUseCase, CampaignRecommendationsReader } from './send-campaign-reminder-digest.use-case';
import { InMemoryNotificationLogRepository } from './in-memory-notification-log.repository';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';
import { InMemoryCampaignRepository } from '../parcel/in-memory-campaign.repository';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';
import { CampaignNotFoundError } from '../parcel/errors';
import type { ParcelRepository } from '../parcel/parcel.repository';
import type { UserRepository } from '../auth/repositories';
import type { User } from '../auth/types';

const clock = { nowIso: () => '2026-08-12T00:00:00.000Z' };
const ids = (() => { let n = 0; return { next: () => `log${++n}` }; })();
const parcelRepoOf = (name: string): ParcelRepository => ({ findById: async () => ({ id: 'p1', organizationId: 'o1', name, createdAt: '' }) } as unknown as ParcelRepository);
const mkUser = (over: Partial<User>): User => ({ id: 'u', email: 'u@x.z', firstName: 'A', lastName: 'B', role: 'AGRONOMIST', organizationId: 'o1', emailVerifiedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), ...over });
const userRepoOf = (users: User[]): UserRepository => ({ listByOrganization: async () => users } as unknown as UserRepository);
const recoOf = (items: { label: string; dueDate?: string; status: string }[]): CampaignRecommendationsReader => ({ execute: async () => ({ items }) });

function make(opts: { items: { label: string; dueDate?: string; status: string }[]; users: User[] }) {
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
const oneAgro = [mkUser({ id: '1', email: 'agro@x.z' })];

describe('SendCampaignReminderDigestUseCase', () => {
  it('envoie un digest aux destinataires ; ne garde que OVERDUE + DUE_SOON', async () => {
    const { campaigns, notifier, uc } = make({ items: DUE, users: oneAgro });
    await seedCampaign(campaigns);
    const res = await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-12T09:00:00.000Z' });
    expect(res).toEqual({ sent: 1 });
    expect(notifier.sent).toHaveLength(1);
    const n = notifier.sent[0];
    expect(n.kind).toBe('campaign_reminder');
    if (n.kind === 'campaign_reminder') {
      expect(n.to).toBe('agro@x.z');
      expect(n.items.map((i) => i.label)).toEqual(['Sarclage', 'Fumure']);
      expect(n.campaignLabel).toBe('Parcelle Nord — Saison 2026');
      expect(n.journalUrl).toContain('/parcelles/p1/campagnes/c1');
    }
  });
  it('idempotent : 2e appel le même jour → already_sent, aucun envoi de plus', async () => {
    const { campaigns, notifier, uc } = make({ items: DUE, users: oneAgro });
    await seedCampaign(campaigns);
    await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-12T09:00:00.000Z' });
    const res2 = await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-12T18:00:00.000Z' });
    expect(res2).toEqual({ sent: 0, skipped: 'already_sent' });
    expect(notifier.sent).toHaveLength(1);
  });
  it('aucune échéance due → no_due_items, journal non écrit', async () => {
    const { campaigns, log, notifier, uc } = make({ items: [{ label: 'Récolte', status: 'UPCOMING' }], users: oneAgro });
    await seedCampaign(campaigns);
    const res = await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-12T09:00:00.000Z' });
    expect(res).toEqual({ sent: 0, skipped: 'no_due_items' });
    expect(notifier.sent).toHaveLength(0);
    expect(await log.existsByDedupKey('campaign_reminder:c1:2026-08-12')).toBe(false);
  });
  it('aucun destinataire éligible → no_recipients', async () => {
    const { campaigns, notifier, uc } = make({ items: DUE, users: [mkUser({ id: '9', email: 'v@x.z', role: 'VIEWER' })] });
    await seedCampaign(campaigns);
    const res = await uc.execute({ campaignId: 'c1', organizationId: 'o1', today: '2026-08-12T09:00:00.000Z' });
    expect(res).toEqual({ sent: 0, skipped: 'no_recipients' });
    expect(notifier.sent).toHaveLength(0);
  });
  it("campagne d'une autre org → CampaignNotFoundError", async () => {
    const { campaigns, uc } = make({ items: DUE, users: oneAgro });
    await seedCampaign(campaigns);
    await expect(uc.execute({ campaignId: 'c1', organizationId: 'oX', today: '2026-08-12T09:00:00.000Z' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
