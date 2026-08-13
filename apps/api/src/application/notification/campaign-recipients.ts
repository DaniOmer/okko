import { UserRepository } from '../auth/repositories';
import { NotificationPreferenceRepository } from './notification-preference.repository';

const FIELD_ROLES = new Set(['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT']);

export async function resolveCampaignRecipients(
  users: UserRepository,
  prefs: NotificationPreferenceRepository,
  organizationId: string,
): Promise<string[]> {
  const members = await users.listByOrganization(organizationId);
  const eligible = members.filter((u) => FIELD_ROLES.has(u.role) && u.emailVerifiedAt != null);
  const out: string[] = [];
  for (const u of eligible) {
    const pref = await prefs.findByUserId(u.id);
    if (pref && pref.remindersEnabled === false) continue;
    out.push(u.email);
  }
  return out;
}
