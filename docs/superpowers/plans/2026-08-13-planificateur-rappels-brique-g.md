# Module 2 / Brique G « Planificateur de rappels » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un cron in-process quotidien parcourt les campagnes actives (toutes orgs) et envoie les rappels selon une cadence par utilisateur (quotidien par défaut, ou tous les 2/3/7 jours, ou jamais), en remaniant la décision d'envoi de la brique F.

**Architecture:** La préférence passe de `remindersEnabled: boolean` à `reminderEveryNDays: number`. `NotificationLog` suit le « dernier rappel » par (campagne, utilisateur) en upsert. Le use-case de F devient une décision **par destinataire** (cadence). `RunDueRemindersUseCase` itère `CampaignRepository.listActive()` et un `RemindersScheduler` (`@nestjs/schedule`, `@Cron`) le déclenche chaque jour. L'UI de préférence devient un `Select` shadcn.

**Tech Stack:** NestJS + Prisma (Postgres) + `@nestjs/schedule` + Jest (API) ; Next.js App Router + shadcn/ui (admin).

**Spec de référence :** `docs/superpowers/specs/2026-08-13-planificateur-rappels-brique-g-design.md`

## Global Constraints

- `organizationId`/identité (`user.sub`) proviennent TOUJOURS du JWT côté endpoints ; le cron s'exécute en contexte système et lit `organizationId` **depuis la campagne**, jamais d'un JWT.
- **La suite de tests API complète est destructrice** (efface la base de dev). Ne lancer QUE les specs ciblées par chemin exact (repos in-memory / stubs, aucune I/O). NE JAMAIS lancer `npx jest` seul.
- Migration Prisma : créer le `migration.sql` à la main puis `npx prisma generate`. NE JAMAIS lancer `prisma migrate dev`/`reset`/`db push`. **Exception à la règle « additif seulement » :** la migration de préférence fait un `DROP COLUMN remindersEnabled` — c'est sûr ici car la brique F **n'est jamais déployée** (table vide, aucune donnée réelle).
- Installer les dépendances avec **pnpm** (le repo est en pnpm), pas npm.
- Portes de type-check : `npx tsc --noEmit` vert côté API **et** admin.
- Valeurs de cadence : `0` = jamais, `1` = quotidien (défaut), `2`, `3`, `7`. Toute autre valeur reçue par l'API → ramenée à `1`.
- Cron : `process.env.REMINDERS_CRON ?? '0 5 * * *'` (UTC). Calculs de jour en UTC (`iso.slice(0,10)`).
- Apostrophes : aucune apostrophe courbe (`’`) dans un littéral JS entre guillemets simples (utiliser guillemets doubles, backticks, ou `’`) ; `&apos;` dans le JSX.
- Messages de commit terminés par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

**API**
- `src/domain/notification/notification-preference.ts` — snapshot `reminderEveryNDays`.
- `src/application/notification/notification-preference.repository.ts` + 2 repos — `upsert(userId, reminderEveryNDays)`.
- `src/presentation/notification/notification-preference.controller.ts` — body `reminderEveryNDays` + clamp.
- `src/application/notification/campaign-recipients.ts` — retour `{ userId, email, everyNDays }[]`.
- `src/application/notification/send-campaign-reminder-digest.use-case.ts` — décision par destinataire + cadence.
- `src/application/notification/notification-log.repository.ts` + 2 repos — `lastSentAt`/`recordSent`.
- `src/application/notification/run-due-reminders.use-case.ts` (nouveau) — boucle sur les campagnes actives.
- `src/application/parcel/campaign.repository.ts` + 2 repos — `listActive()`.
- `src/presentation/notification/reminders.scheduler.ts` (nouveau) — `@Cron`.
- `prisma/schema.prisma` + migration ; `src/suivi.module.ts` ; `package.json`.

**Admin**
- `src/lib/suivi-actions.ts` — `reminderEveryNDays` + retrait `already_sent`.
- `src/app/parcelles/[id]/campagnes/[cid]/SendReminderButton.client.tsx` — messages.
- `src/app/membres/NotificationFrequencySelect.tsx` (remplace le toggle) + `src/app/membres/page.tsx`.

---

## Task 1: Préférence → `reminderEveryNDays` (cadence)

**Files:**
- Modify: `apps/api/src/domain/notification/notification-preference.ts`
- Modify: `apps/api/src/application/notification/notification-preference.repository.ts`
- Modify: `apps/api/src/infrastructure/notification/prisma-notification-preference.repository.ts`
- Modify: `apps/api/src/application/notification/in-memory-notification-preference.repository.ts`
- Modify: `apps/api/src/presentation/notification/notification-preference.controller.ts`
- Modify: `apps/api/src/application/notification/campaign-recipients.ts`
- Modify: `apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts` (adaptation au nouveau retour du résolveur uniquement)
- Modify: `apps/api/prisma/schema.prisma` + Create migration
- Test: `apps/api/src/application/notification/notification-repositories.spec.ts` (part préférence), `campaign-recipients.spec.ts`, Create `notification-preference.controller.spec.ts`

**Interfaces:**
- Produces :
  - `NotificationPreferenceSnapshot { userId: string; reminderEveryNDays: number }`.
  - `NotificationPreferenceRepository.upsert(userId: string, reminderEveryNDays: number)`.
  - `resolveCampaignRecipients(users, prefs, organizationId): Promise<{ userId: string; email: string; everyNDays: number }[]>`.

- [ ] **Step 1: Mettre à jour les tests (échouent)**

Dans `notification-repositories.spec.ts`, remplacer le `it` de préférence par :
```ts
  it('preference: absente → null ; upsert (nombre) → relecture', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    expect(await prefs.findByUserId('u1')).toBeNull();
    await prefs.upsert('u1', 2);
    expect(await prefs.findByUserId('u1')).toEqual({ userId: 'u1', reminderEveryNDays: 2 });
  });
```

Réécrire `campaign-recipients.spec.ts` en entier :
```ts
import { resolveCampaignRecipients } from './campaign-recipients';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';
import type { UserRepository } from '../auth/repositories';
import type { User } from '../auth/types';

const mkUser = (over: Partial<User>): User => ({ id: 'u', email: 'u@x.z', firstName: 'A', lastName: 'B', role: 'AGRONOMIST', organizationId: 'o1', emailVerifiedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), ...over });
const userRepoOf = (users: User[]): UserRepository => ({ listByOrganization: async () => users } as unknown as UserRepository);

describe('resolveCampaignRecipients', () => {
  it('renvoie {userId,email,everyNDays} ; défaut 1 sans préférence ; exclut VIEWER et non confirmés', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    const users = [
      mkUser({ id: '1', email: 'agro@x.z', role: 'AGRONOMIST' }),
      mkUser({ id: '2', email: 'agent@x.z', role: 'FIELD_AGENT' }),
      mkUser({ id: '3', email: 'admin@x.z', role: 'ORG_ADMIN' }),
      mkUser({ id: '4', email: 'viewer@x.z', role: 'VIEWER' }),
      mkUser({ id: '5', email: 'pending@x.z', role: 'AGRONOMIST', emailVerifiedAt: null }),
    ];
    const out = await resolveCampaignRecipients(userRepoOf(users), prefs, 'o1');
    expect(out.map((r) => r.email).sort()).toEqual(['admin@x.z', 'agent@x.z', 'agro@x.z']);
    expect(out.every((r) => r.everyNDays === 1)).toBe(true);
  });
  it('exclut everyNDays === 0 (jamais) ; conserve la valeur choisie', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    await prefs.upsert('1', 0);
    await prefs.upsert('2', 3);
    const users = [mkUser({ id: '1', email: 'off@x.z' }), mkUser({ id: '2', email: 'every3@x.z' })];
    const out = await resolveCampaignRecipients(userRepoOf(users), prefs, 'o1');
    expect(out).toEqual([{ userId: '2', email: 'every3@x.z', everyNDays: 3 }]);
  });
});
```

Créer `notification-preference.controller.spec.ts` :
```ts
import { NotificationPreferenceController } from './notification-preference.controller';
import { InMemoryNotificationPreferenceRepository } from '../../application/notification/in-memory-notification-preference.repository';
import type { AuthUser } from '../auth/decorators';

const user = { sub: 'u1', email: 'u@x.z', role: 'AGRONOMIST', organizationId: 'o1' } as AuthUser;

describe('NotificationPreferenceController', () => {
  it('GET défaut 1 sans préférence ; PATCH stocke et relit', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    const ctrl = new NotificationPreferenceController(prefs);
    expect(await ctrl.get(user)).toEqual({ reminderEveryNDays: 1 });
    expect(await ctrl.patch(user, { reminderEveryNDays: 2 })).toEqual({ reminderEveryNDays: 2 });
    expect(await ctrl.get(user)).toEqual({ reminderEveryNDays: 2 });
  });
  it('PATCH ramène une valeur hors {0,1,2,3,7} à 1', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    const ctrl = new NotificationPreferenceController(prefs);
    expect(await ctrl.patch(user, { reminderEveryNDays: 99 })).toEqual({ reminderEveryNDays: 1 });
    expect(await ctrl.patch(user, { reminderEveryNDays: 0 })).toEqual({ reminderEveryNDays: 0 });
  });
});
```

- [ ] **Step 2: Lancer les tests — ils échouent**

Run: `cd apps/api && npx jest src/application/notification/notification-repositories.spec.ts src/application/notification/campaign-recipients.spec.ts src/presentation/notification/notification-preference.controller.spec.ts`
Expected: FAIL (types `reminderEveryNDays` inexistants, `ctrl.get/patch` signatures).

- [ ] **Step 3: Snapshot + port + repos préférence**

`domain/notification/notification-preference.ts` :
```ts
export interface NotificationPreferenceSnapshot { userId: string; reminderEveryNDays: number; }
```
`application/notification/notification-preference.repository.ts` :
```ts
import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

export const NOTIFICATION_PREFERENCE_REPOSITORY = Symbol('NOTIFICATION_PREFERENCE_REPOSITORY');
export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null>;
  upsert(userId: string, reminderEveryNDays: number): Promise<void>;
}
```
`infrastructure/notification/prisma-notification-preference.repository.ts` — corps :
```ts
  async findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null> {
    const r = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return r ? { userId: r.userId, reminderEveryNDays: r.reminderEveryNDays } : null;
  }
  async upsert(userId: string, reminderEveryNDays: number): Promise<void> {
    await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId, reminderEveryNDays }, update: { reminderEveryNDays } });
  }
```
`application/notification/in-memory-notification-preference.repository.ts` :
```ts
import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

export class InMemoryNotificationPreferenceRepository implements NotificationPreferenceRepository {
  private store = new Map<string, number>();
  async findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null> {
    return this.store.has(userId) ? { userId, reminderEveryNDays: this.store.get(userId)! } : null;
  }
  async upsert(userId: string, reminderEveryNDays: number): Promise<void> { this.store.set(userId, reminderEveryNDays); }
}
```

- [ ] **Step 4: Contrôleur (clamp)**

`presentation/notification/notification-preference.controller.ts` — remplacer les 2 handlers + ajouter la constante :
```ts
const ALLOWED_FREQUENCIES = new Set([0, 1, 2, 3, 7]);

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async get(@CurrentUser() user: AuthUser) {
    const pref = await this.prefs.findByUserId(user.sub);
    return { reminderEveryNDays: pref ? pref.reminderEveryNDays : 1 };
  }

  @Patch() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async patch(@CurrentUser() user: AuthUser, @Body() body: { reminderEveryNDays: number }) {
    const value = ALLOWED_FREQUENCIES.has(body.reminderEveryNDays) ? body.reminderEveryNDays : 1;
    await this.prefs.upsert(user.sub, value);
    return { reminderEveryNDays: value };
  }
```
(Placer `const ALLOWED_FREQUENCIES` au niveau module, avant la classe.)

- [ ] **Step 5: Résolveur (nouveau retour)**

`application/notification/campaign-recipients.ts` :
```ts
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
```

- [ ] **Step 6: Adapter la boucle du use-case au nouveau retour (dédup par jour conservée)**

Dans `application/notification/send-campaign-reminder-digest.use-case.ts`, remplacer UNIQUEMENT la boucle d'envoi par :
```ts
    for (const r of recipients) {
      await this.notifier.send({ kind: 'campaign_reminder', to: r.email, campaignLabel, items: payloadItems, journalUrl });
    }
```
(Le reste — dédup `existsByDedupKey`/`record`, `no_due_items`, `no_recipients`, `sent: recipients.length` — reste inchangé pour cette tâche.)

- [ ] **Step 7: Schéma + migration**

`schema.prisma`, modèle `NotificationPreference` :
```prisma
model NotificationPreference {
  userId             String   @id
  reminderEveryNDays Int      @default(1)
  updatedAt          DateTime @updatedAt
}
```
Créer `apps/api/prisma/migrations/20260813100000_notification_preference_frequency/migration.sql` :
```sql
ALTER TABLE "NotificationPreference" ADD COLUMN "reminderEveryNDays" INTEGER NOT NULL DEFAULT 1;
UPDATE "NotificationPreference" SET "reminderEveryNDays" = CASE WHEN "remindersEnabled" = false THEN 0 ELSE 1 END;
ALTER TABLE "NotificationPreference" DROP COLUMN "remindersEnabled";
```

- [ ] **Step 8: Régénérer le client Prisma**

Run: `cd apps/api && npx prisma generate`
Expected: « Generated Prisma Client » — `notificationPreference.reminderEveryNDays` disponible.

- [ ] **Step 9: Lancer les tests — ils passent + non-régression use-case**

Run: `cd apps/api && npx jest src/application/notification/notification-repositories.spec.ts src/application/notification/campaign-recipients.spec.ts src/presentation/notification/notification-preference.controller.spec.ts src/application/notification/send-campaign-reminder-digest.use-case.spec.ts`
Expected: PASS (les specs de préférence/résolveur/contrôleur au vert ; la spec du use-case F **toujours verte** — comportement inchangé).

- [ ] **Step 10: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/domain/notification/notification-preference.ts apps/api/src/application/notification/notification-preference.repository.ts apps/api/src/infrastructure/notification/prisma-notification-preference.repository.ts apps/api/src/application/notification/in-memory-notification-preference.repository.ts apps/api/src/presentation/notification/notification-preference.controller.ts apps/api/src/presentation/notification/notification-preference.controller.spec.ts apps/api/src/application/notification/campaign-recipients.ts apps/api/src/application/notification/campaign-recipients.spec.ts apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts apps/api/src/application/notification/notification-repositories.spec.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260813100000_notification_preference_frequency
git commit -m "feat(notif): préférence reminderEveryNDays (cadence) + résolveur avec fréquence"
```

---

## Task 2: `NotificationLog` par (campagne, utilisateur) + use-case cadence

**Files:**
- Modify: `apps/api/src/application/notification/notification-log.repository.ts`
- Modify: `apps/api/src/infrastructure/notification/prisma-notification-log.repository.ts`
- Modify: `apps/api/src/application/notification/in-memory-notification-log.repository.ts`
- Modify: `apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts`
- Test: `apps/api/src/application/notification/notification-repositories.spec.ts` (part log), `send-campaign-reminder-digest.use-case.spec.ts`

**Interfaces:**
- Consumes : préférence/résolveur de Task 1.
- Produces :
  - `NotificationLogRepository { lastSentAt(dedupKey): Promise<string|null>; recordSent(entry: NotificationLogSnapshot): Promise<void> }`.
  - `SendReminderResult { sent: number; skipped?: 'no_due_items' | 'no_recipients' }` (plus de `already_sent`).
  - Clé de dédup `campaign_reminder:{campaignId}:{userId}`.

- [ ] **Step 1: Mettre à jour les tests (échouent)**

Dans `notification-repositories.spec.ts`, remplacer le `it` du log par :
```ts
  it('log: lastSentAt null puis date ; recordSent en upsert (une seule ligne par clé)', async () => {
    const log = new InMemoryNotificationLogRepository();
    expect(await log.lastSentAt('k')).toBeNull();
    await log.recordSent({ id: '1', organizationId: 'o1', dedupKey: 'k', kind: 'campaign_reminder', sentAt: '2026-08-12T00:00:00.000Z' });
    expect(await log.lastSentAt('k')).toBe('2026-08-12T00:00:00.000Z');
    await log.recordSent({ id: '2', organizationId: 'o1', dedupKey: 'k', kind: 'campaign_reminder', sentAt: '2026-08-14T00:00:00.000Z' });
    expect(await log.lastSentAt('k')).toBe('2026-08-14T00:00:00.000Z');
    expect(log.entries).toHaveLength(1);
  });
```

Réécrire `send-campaign-reminder-digest.use-case.spec.ts` en entier :
```ts
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
```

- [ ] **Step 2: Lancer les tests — ils échouent**

Run: `cd apps/api && npx jest src/application/notification/notification-repositories.spec.ts src/application/notification/send-campaign-reminder-digest.use-case.spec.ts`
Expected: FAIL (`lastSentAt`/`recordSent` inexistants ; use-case fait encore la dédup par jour).

- [ ] **Step 3: Port + repos log**

`application/notification/notification-log.repository.ts` :
```ts
import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');
export interface NotificationLogRepository {
  lastSentAt(dedupKey: string): Promise<string | null>;
  recordSent(entry: NotificationLogSnapshot): Promise<void>;
}
```
`infrastructure/notification/prisma-notification-log.repository.ts` — corps :
```ts
  async lastSentAt(dedupKey: string): Promise<string | null> {
    const r = await this.prisma.notificationLog.findUnique({ where: { dedupKey } });
    return r ? r.sentAt.toISOString() : null;
  }
  async recordSent(entry: NotificationLogSnapshot): Promise<void> {
    await this.prisma.notificationLog.upsert({
      where: { dedupKey: entry.dedupKey },
      create: { id: entry.id, organizationId: entry.organizationId, dedupKey: entry.dedupKey, kind: entry.kind, sentAt: new Date(entry.sentAt) },
      update: { sentAt: new Date(entry.sentAt) },
    });
  }
```
`application/notification/in-memory-notification-log.repository.ts` :
```ts
import { NotificationLogRepository } from './notification-log.repository';
import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

export class InMemoryNotificationLogRepository implements NotificationLogRepository {
  public readonly entries: NotificationLogSnapshot[] = [];
  async lastSentAt(dedupKey: string): Promise<string | null> {
    const e = this.entries.find((x) => x.dedupKey === dedupKey);
    return e ? e.sentAt : null;
  }
  async recordSent(entry: NotificationLogSnapshot): Promise<void> {
    const i = this.entries.findIndex((x) => x.dedupKey === entry.dedupKey);
    if (i >= 0) this.entries[i] = entry; else this.entries.push(entry);
  }
}
```

- [ ] **Step 4: Use-case — décision par destinataire + cadence**

Dans `send-campaign-reminder-digest.use-case.ts` : changer le type de résultat, ajouter `daysBetween`, et remplacer la logique de dédup+boucle. Le fichier résultant (à partir de `SendReminderResult`) :
```ts
export interface SendReminderResult { sent: number; skipped?: 'no_due_items' | 'no_recipients'; }

function daysBetween(aIso: string, bIso: string): number {
  return Math.floor((Date.parse(bIso.slice(0, 10)) - Date.parse(aIso.slice(0, 10))) / 86400000);
}

export class SendCampaignReminderDigestUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly parcels: ParcelRepository,
    private readonly reco: CampaignRecommendationsReader,
    private readonly users: UserRepository,
    private readonly prefs: NotificationPreferenceRepository,
    private readonly log: NotificationLogRepository,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: { campaignId: string; organizationId: string; today: string }): Promise<SendReminderResult> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    const reco = await this.reco.execute({ campaignId: input.campaignId, organizationId: input.organizationId });
    const items = reco.items.filter((i) => i.status === 'OVERDUE' || i.status === 'DUE_SOON');
    if (items.length === 0) return { sent: 0, skipped: 'no_due_items' };
    const recipients = await resolveCampaignRecipients(this.users, this.prefs, input.organizationId);
    if (recipients.length === 0) return { sent: 0, skipped: 'no_recipients' };
    const parcel = await this.parcels.findById(campaign.parcelId);
    const campaignLabel = `${parcel?.name ?? 'Parcelle'} — ${campaign.season}`;
    const base = process.env.INVITE_BASE_URL ?? 'http://localhost:3000';
    const journalUrl = `${base}/parcelles/${campaign.parcelId}/campagnes/${input.campaignId}`;
    const payloadItems = items.map((i) => ({ label: i.label, dueDate: i.dueDate, status: i.status as 'OVERDUE' | 'DUE_SOON' }));
    let sent = 0;
    for (const r of recipients) {
      const dedupKey = `campaign_reminder:${input.campaignId}:${r.userId}`;
      const last = await this.log.lastSentAt(dedupKey);
      if (last && daysBetween(last, input.today) < r.everyNDays) continue;
      await this.notifier.send({ kind: 'campaign_reminder', to: r.email, campaignLabel, items: payloadItems, journalUrl });
      await this.log.recordSent({ id: this.ids.next(), organizationId: input.organizationId, dedupKey, kind: 'campaign_reminder', sentAt: this.clock.nowIso() });
      sent += 1;
    }
    return { sent };
  }
}
```
(Les imports en tête du fichier restent inchangés — `CampaignRepository`, `ParcelRepository`, `UserRepository`, `NotificationPreferenceRepository`, `NotificationLogRepository`, `NotificationPort`, `resolveCampaignRecipients`, `CampaignNotFoundError`, `Clock`, `IdGenerator` — et l'interface `CampaignRecommendationsReader`.)

- [ ] **Step 5: Lancer les tests — ils passent**

Run: `cd apps/api && npx jest src/application/notification/notification-repositories.spec.ts src/application/notification/send-campaign-reminder-digest.use-case.spec.ts`
Expected: PASS.

- [ ] **Step 6: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/application/notification/notification-log.repository.ts apps/api/src/infrastructure/notification/prisma-notification-log.repository.ts apps/api/src/application/notification/in-memory-notification-log.repository.ts apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts apps/api/src/application/notification/notification-repositories.spec.ts apps/api/src/application/notification/send-campaign-reminder-digest.use-case.spec.ts
git commit -m "feat(notif): NotificationLog par (campagne,utilisateur) + envoi selon cadence"
```

---

## Task 3: `listActive` + `RunDueRemindersUseCase`

**Files:**
- Modify: `apps/api/src/application/parcel/campaign.repository.ts`
- Modify: `apps/api/src/infrastructure/parcel/prisma-campaign.repository.ts`
- Modify: `apps/api/src/application/parcel/in-memory-campaign.repository.ts`
- Create: `apps/api/src/application/notification/run-due-reminders.use-case.ts`
- Test: `apps/api/src/application/notification/run-due-reminders.use-case.spec.ts`

**Interfaces:**
- Produces :
  - `CampaignRepository.listActive(): Promise<CampaignSnapshot[]>`.
  - `CampaignReminderSender { execute(input: { campaignId: string; organizationId: string; today: string }): Promise<{ sent: number }> }` (satisfait par `SendCampaignReminderDigestUseCase`).
  - `RunDueRemindersUseCase.execute({ today }): Promise<{ campaigns: number; sent: number; failed: number }>`.

- [ ] **Step 1: Écrire le test (échoue)**

Créer `apps/api/src/application/notification/run-due-reminders.use-case.spec.ts` :
```ts
import { RunDueRemindersUseCase, CampaignReminderSender } from './run-due-reminders.use-case';
import { InMemoryCampaignRepository } from '../parcel/in-memory-campaign.repository';

const senderOf = (impl: CampaignReminderSender['execute']): CampaignReminderSender => ({ execute: impl });
async function seed(campaigns: InMemoryCampaignRepository) {
  await campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', season: 'S', status: 'ACTIVE', createdAt: '' });
  await campaigns.save({ id: 'c2', organizationId: 'o2', parcelId: 'p2', season: 'S', status: 'ACTIVE', createdAt: '' });
  await campaigns.save({ id: 'c3', organizationId: 'o1', parcelId: 'p3', season: 'S', status: 'CLOSED', createdAt: '' });
}

describe('RunDueRemindersUseCase', () => {
  it('parcourt seulement les campagnes ACTIVE (toutes orgs) et agrège sent', async () => {
    const campaigns = new InMemoryCampaignRepository();
    await seed(campaigns);
    const seen: string[] = [];
    const uc = new RunDueRemindersUseCase(campaigns, senderOf(async (i) => { seen.push(i.campaignId); return { sent: 1 }; }));
    const res = await uc.execute({ today: '2026-08-13T00:00:00.000Z' });
    expect(res).toEqual({ campaigns: 2, sent: 2, failed: 0 });
    expect(seen.sort()).toEqual(['c1', 'c2']);
  });
  it("une campagne dont l'envoi lève n'interrompt pas le passage", async () => {
    const campaigns = new InMemoryCampaignRepository();
    await seed(campaigns);
    const uc = new RunDueRemindersUseCase(campaigns, senderOf(async (i) => { if (i.campaignId === 'c1') throw new Error('boom'); return { sent: 1 }; }));
    const res = await uc.execute({ today: '2026-08-13T00:00:00.000Z' });
    expect(res).toEqual({ campaigns: 2, sent: 1, failed: 1 });
  });
});
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/application/notification/run-due-reminders.use-case.spec.ts`
Expected: FAIL (`run-due-reminders` + `listActive` inexistants).

- [ ] **Step 3: `listActive` sur le repo campagne**

`application/parcel/campaign.repository.ts` — ajouter à l'interface :
```ts
  listActive(): Promise<CampaignSnapshot[]>;
```
`application/parcel/in-memory-campaign.repository.ts` — ajouter la méthode :
```ts
  async listActive(): Promise<CampaignSnapshot[]> { return [...this.store.values()].filter((c) => c.status === 'ACTIVE'); }
```
`infrastructure/parcel/prisma-campaign.repository.ts` — ajouter la méthode (utilise le `toSnap` privé existant) :
```ts
  async listActive(): Promise<CampaignSnapshot[]> {
    const rows = await this.prisma.campaign.findMany({ where: { status: 'ACTIVE' } });
    return rows.map((r) => this.toSnap(r));
  }
```

- [ ] **Step 4: `RunDueRemindersUseCase`**

Créer `apps/api/src/application/notification/run-due-reminders.use-case.ts` :
```ts
import { CampaignRepository } from '../parcel/campaign.repository';

export interface CampaignReminderSender {
  execute(input: { campaignId: string; organizationId: string; today: string }): Promise<{ sent: number }>;
}

export class RunDueRemindersUseCase {
  constructor(private readonly campaigns: CampaignRepository, private readonly sender: CampaignReminderSender) {}
  async execute(input: { today: string }): Promise<{ campaigns: number; sent: number; failed: number }> {
    const active = await this.campaigns.listActive();
    let sent = 0;
    let failed = 0;
    for (const c of active) {
      try {
        const r = await this.sender.execute({ campaignId: c.id, organizationId: c.organizationId, today: input.today });
        sent += r.sent;
      } catch {
        failed += 1;
      }
    }
    return { campaigns: active.length, sent, failed };
  }
}
```

- [ ] **Step 5: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/application/notification/run-due-reminders.use-case.spec.ts`
Expected: PASS.

- [ ] **Step 6: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/application/parcel/campaign.repository.ts apps/api/src/infrastructure/parcel/prisma-campaign.repository.ts apps/api/src/application/parcel/in-memory-campaign.repository.ts apps/api/src/application/notification/run-due-reminders.use-case.ts apps/api/src/application/notification/run-due-reminders.use-case.spec.ts
git commit -m "feat(notif): CampaignRepository.listActive + RunDueRemindersUseCase (boucle robuste)"
```

---

## Task 4: `@nestjs/schedule` + `RemindersScheduler` + câblage module

**Files:**
- Modify: `apps/api/package.json` (dépendance)
- Create: `apps/api/src/presentation/notification/reminders.scheduler.ts`
- Modify: `apps/api/src/suivi.module.ts`
- Test: `apps/api/src/presentation/notification/reminders.scheduler.spec.ts`

**Interfaces:**
- Consumes : `RunDueRemindersUseCase` (Task 3), `CLOCK`/`Clock`, `SendCampaignReminderDigestUseCase`, `CAMPAIGN_REPOSITORY`.
- Produces : `RemindersScheduler.handleCron()` (déclenché par `@Cron`), délègue à `RunDueRemindersUseCase`.

- [ ] **Step 1: Installer `@nestjs/schedule`**

Run: `cd apps/api && pnpm add @nestjs/schedule@^4`
Expected: `@nestjs/schedule` ajouté aux dépendances de `apps/api/package.json`.

- [ ] **Step 2: Écrire le test (échoue)**

Créer `apps/api/src/presentation/notification/reminders.scheduler.spec.ts` :
```ts
import { RemindersScheduler } from './reminders.scheduler';
import type { RunDueRemindersUseCase } from '../../application/notification/run-due-reminders.use-case';

describe('RemindersScheduler', () => {
  it('handleCron délègue à RunDueReminders avec le today de l horloge', async () => {
    const calls: { today: string }[] = [];
    const runDue = { execute: async (i: { today: string }) => { calls.push(i); return { campaigns: 1, sent: 1, failed: 0 }; } } as unknown as RunDueRemindersUseCase;
    const clock = { nowIso: () => '2026-08-13T00:00:00.000Z' };
    const sched = new RemindersScheduler(runDue, clock);
    await sched.handleCron();
    expect(calls).toEqual([{ today: '2026-08-13T00:00:00.000Z' }]);
  });
});
```

- [ ] **Step 3: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/presentation/notification/reminders.scheduler.spec.ts`
Expected: FAIL (`reminders.scheduler` inexistant).

- [ ] **Step 4: Le scheduler**

Créer `apps/api/src/presentation/notification/reminders.scheduler.ts` :
```ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RunDueRemindersUseCase } from '../../application/notification/run-due-reminders.use-case';
import { CLOCK, Clock } from '../../application/shared/clock';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger('RemindersScheduler');
  private running = false;

  constructor(
    private readonly runDue: RunDueRemindersUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Cron(process.env.REMINDERS_CRON ?? '0 5 * * *')
  async handleCron(): Promise<void> {
    if (this.running) { this.logger.warn('Passage de rappels déjà en cours, saut.'); return; }
    this.running = true;
    try {
      const r = await this.runDue.execute({ today: this.clock.nowIso() });
      this.logger.log(`Rappels: ${r.campaigns} campagnes, ${r.sent} envois, ${r.failed} échecs.`);
    } finally {
      this.running = false;
    }
  }
}
```

- [ ] **Step 5: Câbler le `SuiviModule`**

Dans `apps/api/src/suivi.module.ts` :

Ajouter les imports :
```ts
import { ScheduleModule } from '@nestjs/schedule';
import { RunDueRemindersUseCase } from './application/notification/run-due-reminders.use-case';
import { RemindersScheduler } from './presentation/notification/reminders.scheduler';
```

Ajouter `ScheduleModule.forRoot()` aux imports du module :
```ts
  imports: [AuthModule, ScheduleModule.forRoot()],
```

Ajouter dans `providers` (après le provider `SendCampaignReminderDigestUseCase`) :
```ts
    { provide: RunDueRemindersUseCase, useFactory: (c, sender) => new RunDueRemindersUseCase(c, sender), inject: [CAMPAIGN_REPOSITORY, SendCampaignReminderDigestUseCase] },
    RemindersScheduler,
```

- [ ] **Step 6: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/presentation/notification/reminders.scheduler.spec.ts`
Expected: PASS.

- [ ] **Step 7: Type-check API + re-run des specs notification**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.
Run: `cd apps/api && npx jest src/application/notification src/presentation/notification`
Expected: PASS (tous les specs notification).

- [ ] **Step 8: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/presentation/notification/reminders.scheduler.ts apps/api/src/presentation/notification/reminders.scheduler.spec.ts apps/api/src/suivi.module.ts
git commit -m "feat(notif): planificateur @Cron quotidien (RemindersScheduler) + câblage module"
```
(Si `pnpm-lock.yaml` est à la racine du monorepo, l'ajouter depuis la racine : `git add pnpm-lock.yaml`.)

---

## Task 5: Admin — sélecteur de fréquence + messages

**Files:**
- Modify: `apps/admin/src/lib/suivi-actions.ts`
- Modify: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/SendReminderButton.client.tsx`
- Create: `apps/admin/src/app/membres/NotificationFrequencySelect.tsx`
- Delete: `apps/admin/src/app/membres/NotificationPreferenceToggle.tsx`
- Modify: `apps/admin/src/app/membres/page.tsx`

**Interfaces:**
- Consumes : endpoints remaniés (`{ reminderEveryNDays }` ; `notifyCampaignReminder` sans `already_sent`). `Select` shadcn (`@/components/ui/select`).

- [ ] **Step 1: Actions serveur**

Dans `apps/admin/src/lib/suivi-actions.ts`, remplacer les 3 actions notification par :
```ts
export async function notifyCampaignReminder(campaignId: string): Promise<{ sent: number; skipped?: 'no_due_items' | 'no_recipients' }> {
  const res = await authFetch(`/campaigns/${campaignId}/notify-reminder`, { method: 'POST' });
  return res.json();
}
export async function getNotificationPreference(): Promise<{ reminderEveryNDays: number }> {
  const res = await authFetch('/me/notification-preferences');
  return res.json();
}
export async function setNotificationPreference(reminderEveryNDays: number): Promise<{ reminderEveryNDays: number }> {
  const res = await authFetch('/me/notification-preferences', jsonInit('PATCH', { reminderEveryNDays }));
  return res.json();
}
```

- [ ] **Step 2: Messages du bouton rappel**

Dans `SendReminderButton.client.tsx`, remplacer `SKIP_MSG` et la ligne de message :
```ts
const SKIP_MSG: Record<string, string> = {
  no_due_items: 'Aucune échéance due pour le moment.',
  no_recipients: 'Aucun destinataire éligible.',
};
```
et
```ts
      setMsg(r.sent > 0 ? `Rappel envoyé à ${r.sent} destinataire(s).` : (SKIP_MSG[r.skipped ?? ''] ?? 'Aucun rappel dû aujourd’hui.'));
```

- [ ] **Step 3: Sélecteur de fréquence (remplace le toggle)**

Créer `apps/admin/src/app/membres/NotificationFrequencySelect.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setNotificationPreference } from '@/lib/suivi-actions';

const OPTIONS = [
  { value: '1', label: 'Quotidien' },
  { value: '2', label: 'Tous les 2 jours' },
  { value: '3', label: 'Tous les 3 jours' },
  { value: '7', label: 'Hebdomadaire' },
  { value: '0', label: 'Jamais' },
];

export function NotificationFrequencySelect({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const [busy, setBusy] = useState(false);
  async function change(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    try { await setNotificationPreference(Number(next)); } catch { setValue(prev); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={change} disabled={busy}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>{OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Fréquence des rappels de suivi par email.</p>
    </div>
  );
}
```

Supprimer `apps/admin/src/app/membres/NotificationPreferenceToggle.tsx`.

- [ ] **Step 4: Page Membres**

Dans `apps/admin/src/app/membres/page.tsx` :

Remplacer les 2 imports de préférence :
```ts
import { getNotificationPreference } from '@/lib/suivi-actions';
import { NotificationFrequencySelect } from './NotificationFrequencySelect';
```
Remplacer la ligne de fetch :
```ts
  const pref = await getNotificationPreference().catch(() => ({ reminderEveryNDays: 1 }));
```
Remplacer le rendu du composant :
```tsx
        <NotificationFrequencySelect initial={pref.reminderEveryNDays} />
```

- [ ] **Step 5: Type-check admin**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Build admin**

Run: `cd apps/admin && npx next build`
Expected: build réussi (page Membres compile avec le `Select`). Si échec par manque d'espace disque (ENOSPC), ne pas bloquer : rapporter, `tsc` reste la porte.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/lib/suivi-actions.ts "apps/admin/src/app/parcelles/[id]/campagnes/[cid]/SendReminderButton.client.tsx" apps/admin/src/app/membres/NotificationFrequencySelect.tsx apps/admin/src/app/membres/page.tsx
git rm apps/admin/src/app/membres/NotificationPreferenceToggle.tsx
git commit -m "feat(admin): sélecteur de fréquence des rappels (shadcn) + messages du bouton"
```

---

## Self-Review

**1. Couverture du spec :**
- Préférence `reminderEveryNDays` (0/1/2/3/7, défaut 1, clamp) + migration → Task 1. ✅
- Résolveur `{userId,email,everyNDays}` (défaut 1, exclut 0) → Task 1. ✅
- `NotificationLog` par (campagne,utilisateur) `lastSentAt`/`recordSent` (upsert) → Task 2. ✅
- Décision d'envoi par destinataire + cadence (`daysBetween`) + retrait `already_sent` → Task 2. ✅
- `CampaignRepository.listActive` + `RunDueRemindersUseCase` (try/catch par campagne) → Task 3. ✅
- `@nestjs/schedule` + `RemindersScheduler` `@Cron` + garde anti-recouvrement + câblage module → Task 4. ✅
- Admin : `Select` de fréquence + endpoints/actions `reminderEveryNDays` + messages → Task 5. ✅
- Tests : préférence/résolveur/contrôleur (T1), log/cadence (T2), run-due (T3), scheduler (T4), tsc+build. ✅

**2. Placeholders :** aucun — chaque step porte le code complet.

**3. Cohérence des types :**
- `NotificationPreferenceSnapshot.reminderEveryNDays` (T1) ↔ repo/contrôleur/résolveur (T1) ↔ admin `{ reminderEveryNDays }` (T5). ✅
- Résolveur renvoie `{ userId, email, everyNDays }[]` (T1) — consommé par le use-case (T1 adapte la boucle, T2 ajoute la cadence). ✅
- `NotificationLogRepository.lastSentAt/recordSent` (T2) ↔ use-case (T2) ↔ repos (T2). Clé `campaign_reminder:{campaignId}:{userId}`. ✅
- `CampaignReminderSender` (T3) satisfait par `SendCampaignReminderDigestUseCase` (retour `{ sent, skipped? }` assignable à `{ sent }`). ✅
- `RunDueRemindersUseCase.execute → { campaigns, sent, failed }` (T3) ↔ scheduler (T4). ✅
- Ordonnancement TDD : chaque tâche laisse `tsc` **vert** — T1 remanie préférence+résolveur+boucle (dédup jour conservée) ; T2 bascule le log+cadence ; aucune étape intermédiaire ne casse la compilation. ✅

**Non couvert (hors périmètre, conforme au spec) :** fuseau par org, pagination, conseils par phase (brique H), file de reprise, SMS/push, déclencheur externe.
