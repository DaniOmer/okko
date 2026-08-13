import { UserRepository } from '../auth/repositories';
import { NotificationPreferenceRepository } from './notification-preference.repository';

const FIELD_ROLES = new Set(['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT']);

export async function resolveCampaignRecipients(
  users: UserRepository,
  prefs: NotificationPreferenceRepository,
  organizationId: string,
): Promise<{ userId: string; email: string; everyNDays: number }[]> {
  const members = await users.listByOrganization(organizationId);
  const eligible = members.filter((u) => FIELD_ROLES.has(u.role) && u.emailVerifiedAt != null);
  const out: { userId: string; email: string; everyNDays: number }[] = [];
  for (const u of eligible) {
    const pref = await prefs.findByUserId(u.id);
    const everyNDays = pref ? pref.reminderEveryNDays : 1;
    if (everyNDays === 0) continue;
    out.push({ userId: u.id, email: u.email, everyNDays });
  }
  return out;
}
