# Module 2 / Brique F « Canal & préférences de notification » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envoyer par email un rappel d'échéances (digest par campagne) aux membres tenant à rôle terrain, avec préférence de désabonnement, journal anti-spam idempotent, et un déclencheur manuel — socle du futur cron (brique G).

**Architecture:** On étend l'union `Notification` existante (+`campaign_reminder`) rendue par `BrevoEmailNotificationSender`. Un use-case `SendCampaignReminderDigestUseCase` réutilise le moteur de reco (brique D via une interface `CampaignRecommendationsReader`), résout les destinataires (users org à rôle terrain, email confirmé, préférence active), et envoie un digest idempotent (journal `NotificationLog`, clé `campaign_reminder:{campaignId}:{jour}`). Endpoints : déclencheur manuel `POST /campaigns/:id/notify-reminder` + préférence self-service `/me/notification-preferences`. Admin : bouton sur le journal + case à cocher sur la page Membres.

**Tech Stack:** NestJS + Prisma (Postgres) + Jest (API) ; Next.js App Router + shadcn/ui + TypeScript (admin).

**Spec de référence :** `docs/superpowers/specs/2026-08-12-notifications-suivi-brique-f-design.md`

## Global Constraints

- `organizationId` et le destinataire proviennent TOUJOURS du JWT / de la résolution serveur, jamais du body.
- Migration Prisma **additive** uniquement. NE JAMAIS lancer `prisma migrate dev`, `prisma migrate reset` ni `prisma db push` (ils réinitialisent la base de dev). Créer le `migration.sql` à la main puis `npx prisma generate` (régénère le client seulement).
- **La suite de tests API complète est destructrice** (efface la base de dev). Ne lancer QUE les specs ciblées par chemin exact (elles utilisent des repos in-memory / des stubs, aucune I/O). NE JAMAIS lancer `npx jest` seul.
- Portes de type-check : `npx tsc --noEmit` vert côté API **et** côté admin.
- Canal = **email** (Brevo, réutilisé). Destinataires = rôles `ORG_ADMIN`, `AGRONOMIST`, `FIELD_AGENT` avec `emailVerifiedAt != null` et préférence ≠ `false` (absence de préférence = activé).
- Anti-spam : au plus **un digest par campagne et par jour**, clé de dédup `campaign_reminder:{campaignId}:{YYYY-MM-DD}` ; **ne pas** écrire le journal s'il n'y a rien à envoyer.
- Apostrophes : n'écrire AUCUNE apostrophe courbe (`’`) dans un littéral JS entre guillemets simples (casse le parse TS). Utiliser guillemets doubles, backticks, ou l'échappement `’` ; `&apos;`/`&rsquo;` dans le texte JSX.
- Messages de commit terminés par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

**API**
- `src/application/notification/notification-port.ts` — +kind `campaign_reminder` sur l'union `Notification`.
- `src/infrastructure/notification/brevo-email-notification-sender.ts` — `case 'campaign_reminder'` dans `render`.
- `src/domain/notification/notification-preference.ts`, `notification-log.ts` — snapshots.
- `src/application/notification/notification-preference.repository.ts`, `notification-log.repository.ts` — ports (+ tokens).
- `src/infrastructure/notification/prisma-notification-preference.repository.ts`, `prisma-notification-log.repository.ts` — impl Prisma.
- `src/application/notification/in-memory-notification-preference.repository.ts`, `in-memory-notification-log.repository.ts` — impl mémoire (tests).
- `src/application/notification/campaign-recipients.ts` — résolveur `resolveCampaignRecipients`.
- `src/application/notification/send-campaign-reminder-digest.use-case.ts` — use-case + interface `CampaignRecommendationsReader`.
- `prisma/schema.prisma` + `prisma/migrations/20260812100000_notification_preference_log/migration.sql` — 2 tables.
- `src/presentation/parcel/campaign.controller.ts` — `POST :id/notify-reminder`.
- `src/presentation/notification/notification-preference.controller.ts` — `/me/notification-preferences`.
- `src/suivi.module.ts` — providers (repos, use-case, `NOTIFICATION_PORT`, `USER_REPOSITORY` local) + controller.

**Admin**
- `src/lib/suivi-actions.ts` — 3 actions.
- `src/app/parcelles/[id]/campagnes/[cid]/SendReminderButton.client.tsx` + `page.tsx`.
- `src/app/membres/NotificationPreferenceToggle.tsx` + `page.tsx`.

---

## Task 1: Type `campaign_reminder` + rendu Brevo

**Files:**
- Modify: `apps/api/src/application/notification/notification-port.ts`
- Modify: `apps/api/src/infrastructure/notification/brevo-email-notification-sender.ts`
- Test: `apps/api/src/infrastructure/notification/brevo-email-notification-sender.spec.ts`

**Interfaces:**
- Produces : `Notification` union gagne
  `{ kind: 'campaign_reminder'; to: string; campaignLabel: string; items: { label: string; dueDate?: string; status: 'OVERDUE' | 'DUE_SOON' }[]; journalUrl: string }`.

- [ ] **Step 1: Écrire le test qui échoue**

Dans `brevo-email-notification-sender.spec.ts`, ajouter cet `it` dans le `describe` existant :

```ts
  it('POST Brevo pour un rappel de suivi (campaign_reminder) — libellés + statut FR + lien journal', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 201 } as Response);
    const sender = new BrevoEmailNotificationSender();
    await sender.send({ kind: 'campaign_reminder', to: 'x@y.z', campaignLabel: 'Parcelle Nord — Saison 2026', items: [{ label: 'Sarclage', dueDate: '2026-05-01', status: 'OVERDUE' }, { label: 'Fumure', status: 'DUE_SOON' }], journalUrl: 'http://app/parcelles/p1/campagnes/c1' });
    const [, init] = fetchMock.mock.calls[0];
    const body = init!.body as string;
    expect(body).toContain('Sarclage');
    expect(body).toContain('En retard');
    expect(body).toContain('http://app/parcelles/p1/campagnes/c1');
    expect(body).toContain('Rappel de suivi');
  });
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/infrastructure/notification/brevo-email-notification-sender.spec.ts`
Expected: FAIL (le kind `campaign_reminder` n'existe pas dans l'union ; erreur de type/exhaustivité au `switch`).

- [ ] **Step 3: Étendre l'union `Notification`**

Dans `apps/api/src/application/notification/notification-port.ts`, remplacer le type `Notification` par :

```ts
export type Notification =
  | { kind: 'invitation'; to: string; organizationName: string; inviteUrl: string; expiresAt: Date }
  | { kind: 'email_confirmation'; to: string; confirmUrl: string; expiresAt: Date }
  | { kind: 'campaign_reminder'; to: string; campaignLabel: string; items: { label: string; dueDate?: string; status: 'OVERDUE' | 'DUE_SOON' }[]; journalUrl: string };
```

- [ ] **Step 4: Ajouter le rendu Brevo**

Dans `brevo-email-notification-sender.ts`, méthode `render`, ajouter un `case` avant l'accolade fermante du `switch` :

```ts
      case 'campaign_reminder': {
        const rows = n.items.map((i) => {
          const statusFr = i.status === 'OVERDUE' ? 'En retard' : 'Bientôt';
          const due = i.dueDate ? ` (échéance ${this.escapeHtml(i.dueDate)})` : '';
          return `<li>${this.escapeHtml(i.label)} — ${statusFr}${due}</li>`;
        }).join('');
        const subject = `Rappel de suivi — ${n.campaignLabel}`;
        const html = `<p>Point de suivi pour <strong>${this.escapeHtml(n.campaignLabel)}</strong> :</p>`
          + `<ul>${rows}</ul>`
          + `<p><a href="${this.escapeHtml(n.journalUrl)}">Ouvrir le journal</a></p>`;
        return { subject, html };
      }
```

- [ ] **Step 5: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/infrastructure/notification/brevo-email-notification-sender.spec.ts`
Expected: PASS (tous les `it`).

- [ ] **Step 6: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/application/notification/notification-port.ts apps/api/src/infrastructure/notification/brevo-email-notification-sender.ts apps/api/src/infrastructure/notification/brevo-email-notification-sender.spec.ts
git commit -m "feat(notif): kind campaign_reminder + rendu email Brevo (digest d'échéances)"
```

---

## Task 2: Tables + snapshots + ports + repos (Prisma & in-memory)

**Files:**
- Create: `apps/api/src/domain/notification/notification-preference.ts`, `apps/api/src/domain/notification/notification-log.ts`
- Create: `apps/api/src/application/notification/notification-preference.repository.ts`, `apps/api/src/application/notification/notification-log.repository.ts`
- Create: `apps/api/src/infrastructure/notification/prisma-notification-preference.repository.ts`, `apps/api/src/infrastructure/notification/prisma-notification-log.repository.ts`
- Create: `apps/api/src/application/notification/in-memory-notification-preference.repository.ts`, `apps/api/src/application/notification/in-memory-notification-log.repository.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260812100000_notification_preference_log/migration.sql`
- Test: `apps/api/src/application/notification/notification-repositories.spec.ts`

**Interfaces:**
- Produces :
  - `NotificationPreferenceSnapshot { userId: string; remindersEnabled: boolean }`.
  - `NotificationLogSnapshot { id: string; organizationId: string; dedupKey: string; kind: string; sentAt: string }`.
  - `NOTIFICATION_PREFERENCE_REPOSITORY` (token) + `NotificationPreferenceRepository { findByUserId(userId): Promise<NotificationPreferenceSnapshot|null>; upsert(userId, remindersEnabled): Promise<void> }`.
  - `NOTIFICATION_LOG_REPOSITORY` (token) + `NotificationLogRepository { existsByDedupKey(dedupKey): Promise<boolean>; record(entry: NotificationLogSnapshot): Promise<void> }`.
  - `InMemoryNotificationPreferenceRepository`, `InMemoryNotificationLogRepository`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/api/src/application/notification/notification-repositories.spec.ts` :

```ts
import { InMemoryNotificationLogRepository } from './in-memory-notification-log.repository';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';

describe('Repos notification (in-memory)', () => {
  it('log: existsByDedupKey passe de false à true après record', async () => {
    const log = new InMemoryNotificationLogRepository();
    expect(await log.existsByDedupKey('k')).toBe(false);
    await log.record({ id: '1', organizationId: 'o1', dedupKey: 'k', kind: 'campaign_reminder', sentAt: '2026-08-12T00:00:00.000Z' });
    expect(await log.existsByDedupKey('k')).toBe(true);
  });
  it('preference: absente → null ; upsert → relecture', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    expect(await prefs.findByUserId('u1')).toBeNull();
    await prefs.upsert('u1', false);
    expect(await prefs.findByUserId('u1')).toEqual({ userId: 'u1', remindersEnabled: false });
  });
});
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/application/notification/notification-repositories.spec.ts`
Expected: FAIL (modules in-memory introuvables).

- [ ] **Step 3: Snapshots domaine**

`apps/api/src/domain/notification/notification-preference.ts` :
```ts
export interface NotificationPreferenceSnapshot { userId: string; remindersEnabled: boolean; }
```
`apps/api/src/domain/notification/notification-log.ts` :
```ts
export interface NotificationLogSnapshot { id: string; organizationId: string; dedupKey: string; kind: string; sentAt: string; }
```

- [ ] **Step 4: Ports (tokens + interfaces)**

`apps/api/src/application/notification/notification-preference.repository.ts` :
```ts
import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

export const NOTIFICATION_PREFERENCE_REPOSITORY = Symbol('NOTIFICATION_PREFERENCE_REPOSITORY');
export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null>;
  upsert(userId: string, remindersEnabled: boolean): Promise<void>;
}
```
`apps/api/src/application/notification/notification-log.repository.ts` :
```ts
import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');
export interface NotificationLogRepository {
  existsByDedupKey(dedupKey: string): Promise<boolean>;
  record(entry: NotificationLogSnapshot): Promise<void>;
}
```

- [ ] **Step 5: Repos in-memory**

`apps/api/src/application/notification/in-memory-notification-preference.repository.ts` :
```ts
import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

export class InMemoryNotificationPreferenceRepository implements NotificationPreferenceRepository {
  private store = new Map<string, boolean>();
  async findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null> {
    return this.store.has(userId) ? { userId, remindersEnabled: this.store.get(userId)! } : null;
  }
  async upsert(userId: string, remindersEnabled: boolean): Promise<void> { this.store.set(userId, remindersEnabled); }
}
```
`apps/api/src/application/notification/in-memory-notification-log.repository.ts` :
```ts
import { NotificationLogRepository } from './notification-log.repository';
import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

export class InMemoryNotificationLogRepository implements NotificationLogRepository {
  public readonly entries: NotificationLogSnapshot[] = [];
  async existsByDedupKey(dedupKey: string): Promise<boolean> { return this.entries.some((e) => e.dedupKey === dedupKey); }
  async record(entry: NotificationLogSnapshot): Promise<void> { this.entries.push(entry); }
}
```

- [ ] **Step 6: Repos Prisma**

`apps/api/src/infrastructure/notification/prisma-notification-preference.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPreferenceRepository } from '../../application/notification/notification-preference.repository';
import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

@Injectable()
export class PrismaNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null> {
    const r = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return r ? { userId: r.userId, remindersEnabled: r.remindersEnabled } : null;
  }
  async upsert(userId: string, remindersEnabled: boolean): Promise<void> {
    await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId, remindersEnabled }, update: { remindersEnabled } });
  }
}
```
`apps/api/src/infrastructure/notification/prisma-notification-log.repository.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationLogRepository } from '../../application/notification/notification-log.repository';
import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

@Injectable()
export class PrismaNotificationLogRepository implements NotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}
  async existsByDedupKey(dedupKey: string): Promise<boolean> {
    const r = await this.prisma.notificationLog.findUnique({ where: { dedupKey } });
    return r != null;
  }
  async record(entry: NotificationLogSnapshot): Promise<void> {
    await this.prisma.notificationLog.create({ data: { id: entry.id, organizationId: entry.organizationId, dedupKey: entry.dedupKey, kind: entry.kind, sentAt: new Date(entry.sentAt) } });
  }
}
```

- [ ] **Step 7: Schéma Prisma**

Dans `apps/api/prisma/schema.prisma`, ajouter à la fin :
```prisma
model NotificationPreference {
  userId           String   @id
  remindersEnabled Boolean  @default(true)
  updatedAt        DateTime @updatedAt
}

model NotificationLog {
  id             String   @id
  organizationId String
  dedupKey       String   @unique
  kind           String
  sentAt         DateTime @default(now())

  @@index([organizationId])
}
```

- [ ] **Step 8: Migration SQL (additive, à la main)**

Créer `apps/api/prisma/migrations/20260812100000_notification_preference_log/migration.sql` :
```sql
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationLog_dedupKey_key" ON "NotificationLog"("dedupKey");
CREATE INDEX "NotificationLog_organizationId_idx" ON "NotificationLog"("organizationId");
```

- [ ] **Step 9: Régénérer le client Prisma**

Run: `cd apps/api && npx prisma generate`
Expected: « Generated Prisma Client » — `notificationPreference` et `notificationLog` disponibles.

- [ ] **Step 10: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/application/notification/notification-repositories.spec.ts`
Expected: PASS.

- [ ] **Step 11: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/domain/notification apps/api/src/application/notification apps/api/src/infrastructure/notification/prisma-notification-*.repository.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260812100000_notification_preference_log
git commit -m "feat(notif): tables NotificationPreference/NotificationLog + ports + repos (prisma & in-memory)"
```

---

## Task 3: Résolveur de destinataires

**Files:**
- Create: `apps/api/src/application/notification/campaign-recipients.ts`
- Test: `apps/api/src/application/notification/campaign-recipients.spec.ts`

**Interfaces:**
- Consumes : `UserRepository` (`../auth/repositories` — `listByOrganization(orgId): Promise<User[]>`), `User` (`../auth/types` — `{ id, email, role, emailVerifiedAt: Date|null, … }`), `NotificationPreferenceRepository` (Task 2).
- Produces : `resolveCampaignRecipients(users: UserRepository, prefs: NotificationPreferenceRepository, organizationId: string): Promise<string[]>` (liste d'emails).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/api/src/application/notification/campaign-recipients.spec.ts` :

```ts
import { resolveCampaignRecipients } from './campaign-recipients';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';
import type { UserRepository } from '../auth/repositories';
import type { User } from '../auth/types';

const mkUser = (over: Partial<User>): User => ({ id: 'u', email: 'u@x.z', firstName: 'A', lastName: 'B', role: 'AGRONOMIST', organizationId: 'o1', emailVerifiedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), ...over });
const userRepoOf = (users: User[]): UserRepository => ({ listByOrganization: async () => users } as unknown as UserRepository);

describe('resolveCampaignRecipients', () => {
  it('garde les rôles terrain à email confirmé ; exclut VIEWER et les non confirmés', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    const users = [
      mkUser({ id: '1', email: 'agro@x.z', role: 'AGRONOMIST' }),
      mkUser({ id: '2', email: 'agent@x.z', role: 'FIELD_AGENT' }),
      mkUser({ id: '3', email: 'admin@x.z', role: 'ORG_ADMIN' }),
      mkUser({ id: '4', email: 'viewer@x.z', role: 'VIEWER' }),
      mkUser({ id: '5', email: 'pending@x.z', role: 'AGRONOMIST', emailVerifiedAt: null }),
    ];
    const out = await resolveCampaignRecipients(userRepoOf(users), prefs, 'o1');
    expect(out.sort()).toEqual(['admin@x.z', 'agent@x.z', 'agro@x.z']);
  });
  it('exclut ceux dont la préférence est false ; garde ceux sans préférence', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    await prefs.upsert('1', false);
    const users = [mkUser({ id: '1', email: 'off@x.z' }), mkUser({ id: '2', email: 'on@x.z' })];
    const out = await resolveCampaignRecipients(userRepoOf(users), prefs, 'o1');
    expect(out).toEqual(['on@x.z']);
  });
});
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/application/notification/campaign-recipients.spec.ts`
Expected: FAIL (`campaign-recipients` introuvable).

- [ ] **Step 3: Implémenter le résolveur**

`apps/api/src/application/notification/campaign-recipients.ts` :
```ts
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
```

- [ ] **Step 4: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/application/notification/campaign-recipients.spec.ts`
Expected: PASS.

- [ ] **Step 5: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/notification/campaign-recipients.ts apps/api/src/application/notification/campaign-recipients.spec.ts
git commit -m "feat(notif): résolveur de destinataires (rôles terrain, email confirmé, préférence active)"
```

---

## Task 4: Use-case `SendCampaignReminderDigestUseCase`

**Files:**
- Create: `apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts`
- Test: `apps/api/src/application/notification/send-campaign-reminder-digest.use-case.spec.ts`

**Interfaces:**
- Consumes : `CampaignRepository` (`../parcel/campaign.repository`), `ParcelRepository` (`../parcel/parcel.repository`, `findById`), `UserRepository`, `NotificationPreferenceRepository`, `NotificationLogRepository`, `NotificationPort` (`./notification-port`), `resolveCampaignRecipients` (Task 3), `CampaignNotFoundError` (`../parcel/errors`), `Clock`, `IdGenerator` (`../shared/*`).
- Produces :
  - `CampaignRecommendationsReader { execute(input: { campaignId: string; organizationId: string }): Promise<{ items: { label: string; dueDate?: string; status: string }[] }> }` — **satisfaite structurellement par `GetCampaignRecommendationsUseCase`** (brique D).
  - `SendReminderResult { sent: number; skipped?: 'already_sent' | 'no_due_items' | 'no_recipients' }`.
  - `SendCampaignReminderDigestUseCase` avec `execute({ campaignId, organizationId, today }): Promise<SendReminderResult>` ; constructeur `(campaigns, parcels, reco, users, prefs, log, notifier, clock, ids)`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/api/src/application/notification/send-campaign-reminder-digest.use-case.spec.ts` :

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
  it('campagne d’une autre org → CampaignNotFoundError', async () => {
    const { campaigns, uc } = make({ items: DUE, users: oneAgro });
    await seedCampaign(campaigns);
    await expect(uc.execute({ campaignId: 'c1', organizationId: 'oX', today: '2026-08-12T09:00:00.000Z' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/application/notification/send-campaign-reminder-digest.use-case.spec.ts`
Expected: FAIL (use-case introuvable).

- [ ] **Step 3: Implémenter le use-case**

`apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts` :
```ts
import { CampaignRepository } from '../parcel/campaign.repository';
import { ParcelRepository } from '../parcel/parcel.repository';
import { UserRepository } from '../auth/repositories';
import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationLogRepository } from './notification-log.repository';
import { NotificationPort } from './notification-port';
import { resolveCampaignRecipients } from './campaign-recipients';
import { CampaignNotFoundError } from '../parcel/errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CampaignRecommendationsReader {
  execute(input: { campaignId: string; organizationId: string }): Promise<{ items: { label: string; dueDate?: string; status: string }[] }>;
}
export interface SendReminderResult { sent: number; skipped?: 'already_sent' | 'no_due_items' | 'no_recipients'; }

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
    const dedupKey = `campaign_reminder:${input.campaignId}:${input.today.slice(0, 10)}`;
    if (await this.log.existsByDedupKey(dedupKey)) return { sent: 0, skipped: 'already_sent' };
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
    for (const to of recipients) {
      await this.notifier.send({ kind: 'campaign_reminder', to, campaignLabel, items: payloadItems, journalUrl });
    }
    await this.log.record({ id: this.ids.next(), organizationId: input.organizationId, dedupKey, kind: 'campaign_reminder', sentAt: this.clock.nowIso() });
    return { sent: recipients.length };
  }
}
```

- [ ] **Step 4: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/application/notification/send-campaign-reminder-digest.use-case.spec.ts`
Expected: PASS (5 `it`).

- [ ] **Step 5: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts apps/api/src/application/notification/send-campaign-reminder-digest.use-case.spec.ts
git commit -m "feat(notif): SendCampaignReminderDigestUseCase (digest idempotent OVERDUE/DUE_SOON)"
```

---

## Task 5: Endpoints + câblage module

**Files:**
- Modify: `apps/api/src/presentation/parcel/campaign.controller.ts`
- Create: `apps/api/src/presentation/notification/notification-preference.controller.ts`
- Modify: `apps/api/src/suivi.module.ts`
- Test: `apps/api/src/presentation/notification/notification-roles.spec.ts`

**Interfaces:**
- Consumes : `SendCampaignReminderDigestUseCase` (Task 4), `NOTIFICATION_PREFERENCE_REPOSITORY`/`NotificationPreferenceRepository` (Task 2), `CLOCK`/`Clock`.
- Produces : `POST /campaigns/:id/notify-reminder` (`CampaignController.notifyReminder`, 3 rôles écriture) ; `GET`/`PATCH /me/notification-preferences` (`NotificationPreferenceController.get`/`.patch`, 4 rôles tenant).

- [ ] **Step 1: Écrire le test de rôles qui échoue**

Créer `apps/api/src/presentation/notification/notification-roles.spec.ts` :
```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { CampaignController } from '../parcel/campaign.controller';
import { NotificationPreferenceController } from './notification-preference.controller';

const reflector = new Reflector();
describe('Rôles notifications de suivi', () => {
  it('POST /campaigns/:id/notify-reminder = 3 rôles écriture (VIEWER exclu)', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CampaignController.prototype.notifyReminder);
    expect(roles).toEqual(['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT']);
    expect(roles).not.toContain('VIEWER');
  });
  it('GET/PATCH /me/notification-preferences = 4 rôles tenant (VIEWER inclus)', () => {
    expect(reflector.get<string[]>(ROLES_KEY, NotificationPreferenceController.prototype.get)).toContain('VIEWER');
    expect(reflector.get<string[]>(ROLES_KEY, NotificationPreferenceController.prototype.patch)).toContain('VIEWER');
  });
});
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/presentation/notification/notification-roles.spec.ts`
Expected: FAIL (`notifyReminder` / `NotificationPreferenceController` introuvables).

- [ ] **Step 3: Contrôleur de préférence**

Créer `apps/api/src/presentation/notification/notification-preference.controller.ts` :
```ts
import { Controller, Get, Patch, Body, UseGuards, Inject } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { NOTIFICATION_PREFERENCE_REPOSITORY, NotificationPreferenceRepository } from '../../application/notification/notification-preference.repository';

@Controller('me/notification-preferences')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationPreferenceController {
  constructor(@Inject(NOTIFICATION_PREFERENCE_REPOSITORY) private readonly prefs: NotificationPreferenceRepository) {}

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async get(@CurrentUser() user: AuthUser) {
    const pref = await this.prefs.findByUserId(user.sub);
    return { remindersEnabled: pref ? pref.remindersEnabled : true };
  }

  @Patch() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async patch(@CurrentUser() user: AuthUser, @Body() body: { remindersEnabled: boolean }) {
    await this.prefs.upsert(user.sub, body.remindersEnabled === true);
    return { remindersEnabled: body.remindersEnabled === true };
  }
}
```

- [ ] **Step 4: Endpoint déclencheur sur `CampaignController`**

Dans `apps/api/src/presentation/parcel/campaign.controller.ts` :

Compléter les imports (`Inject` + use-case + CLOCK/Clock) :
```ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException, NotFoundException, BadRequestException, HttpCode, Inject } from '@nestjs/common';
import { SendCampaignReminderDigestUseCase } from '../../application/notification/send-campaign-reminder-digest.use-case';
import { CLOCK, Clock } from '../../application/shared/clock';
```

Ajouter au constructeur (après `recoUC`) :
```ts
    private readonly recoUC: GetCampaignRecommendationsUseCase,
    private readonly reminderUC: SendCampaignReminderDigestUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}
```

Ajouter la route (par ex. après `recommendations`) :
```ts
  @Post(':id/notify-reminder') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async notifyReminder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { return await this.reminderUC.execute({ campaignId: id, organizationId: this.org(user), today: this.clock.nowIso() }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }
```

- [ ] **Step 5: Câbler le `SuiviModule`**

Dans `apps/api/src/suivi.module.ts`, ajouter les imports (après les imports existants) :
```ts
import { USER_REPOSITORY } from './application/auth/repositories';
import { PrismaUserRepository } from './infrastructure/auth/prisma-user.repository';
import { NOTIFICATION_PORT } from './application/notification/notification-port';
import { BrevoEmailNotificationSender } from './infrastructure/notification/brevo-email-notification-sender';
import { NOTIFICATION_PREFERENCE_REPOSITORY } from './application/notification/notification-preference.repository';
import { PrismaNotificationPreferenceRepository } from './infrastructure/notification/prisma-notification-preference.repository';
import { NOTIFICATION_LOG_REPOSITORY } from './application/notification/notification-log.repository';
import { PrismaNotificationLogRepository } from './infrastructure/notification/prisma-notification-log.repository';
import { SendCampaignReminderDigestUseCase } from './application/notification/send-campaign-reminder-digest.use-case';
import { NotificationPreferenceController } from './presentation/notification/notification-preference.controller';
```

Ajouter `NotificationPreferenceController` au tableau `controllers`.

Ajouter dans `providers` (par ex. après le provider `GetCampaignRecommendationsUseCase`) :
```ts
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: NOTIFICATION_PORT, useClass: BrevoEmailNotificationSender },
    { provide: NOTIFICATION_PREFERENCE_REPOSITORY, useClass: PrismaNotificationPreferenceRepository },
    { provide: NOTIFICATION_LOG_REPOSITORY, useClass: PrismaNotificationLogRepository },
    { provide: SendCampaignReminderDigestUseCase, useFactory: (c, p, reco, u, pref, log, notif, clk, ids) => new SendCampaignReminderDigestUseCase(c, p, reco, u, pref, log, notif, clk, ids), inject: [CAMPAIGN_REPOSITORY, PARCEL_REPOSITORY, GetCampaignRecommendationsUseCase, USER_REPOSITORY, NOTIFICATION_PREFERENCE_REPOSITORY, NOTIFICATION_LOG_REPOSITORY, NOTIFICATION_PORT, CLOCK, UuidIdGenerator] },
```

(`CLOCK` est déjà importé dans le module ; `CampaignController` reçoit `SendCampaignReminderDigestUseCase` + `CLOCK` par injection Nest — aucun changement de sa déclaration dans `controllers`.)

- [ ] **Step 6: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/presentation/notification/notification-roles.spec.ts`
Expected: PASS.

- [ ] **Step 7: Type-check API + re-run des specs notification**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.
Run: `cd apps/api && npx jest src/application/notification src/presentation/notification/notification-roles.spec.ts`
Expected: PASS (tous les specs notification).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/presentation/parcel/campaign.controller.ts apps/api/src/presentation/notification/notification-preference.controller.ts apps/api/src/presentation/notification/notification-roles.spec.ts apps/api/src/suivi.module.ts
git commit -m "feat(notif): endpoints notify-reminder + /me/notification-preferences + câblage SuiviModule"
```

---

## Task 6: Admin — bouton rappel + toggle préférence

**Files:**
- Modify: `apps/admin/src/lib/suivi-actions.ts`
- Create: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/SendReminderButton.client.tsx`
- Modify: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx`
- Create: `apps/admin/src/app/membres/NotificationPreferenceToggle.tsx`
- Modify: `apps/admin/src/app/membres/page.tsx`

**Interfaces:**
- Consumes : endpoints Task 5. `authFetch`/`jsonInit` de `./http` (déjà utilisés dans `suivi-actions.ts`).
- Produces : `notifyCampaignReminder(campaignId)`, `getNotificationPreference()`, `setNotificationPreference(remindersEnabled)`.

- [ ] **Step 1: Actions serveur**

Dans `apps/admin/src/lib/suivi-actions.ts`, ajouter à la fin :
```ts
export async function notifyCampaignReminder(campaignId: string): Promise<{ sent: number; skipped?: 'already_sent' | 'no_due_items' | 'no_recipients' }> {
  const res = await authFetch(`/campaigns/${campaignId}/notify-reminder`, { method: 'POST' });
  return res.json();
}
export async function getNotificationPreference(): Promise<{ remindersEnabled: boolean }> {
  const res = await authFetch('/me/notification-preferences');
  return res.json();
}
export async function setNotificationPreference(remindersEnabled: boolean): Promise<{ remindersEnabled: boolean }> {
  const res = await authFetch('/me/notification-preferences', jsonInit('PATCH', { remindersEnabled }));
  return res.json();
}
```

- [ ] **Step 2: Bouton « Envoyer un rappel » (client)**

Créer `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/SendReminderButton.client.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { notifyCampaignReminder } from '@/lib/suivi-actions';

const SKIP_MSG: Record<string, string> = {
  already_sent: "Rappel déjà envoyé aujourd'hui.",
  no_due_items: 'Aucune échéance due pour le moment.',
  no_recipients: 'Aucun destinataire éligible.',
};

export function SendReminderButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true); setMsg(null);
    try {
      const r = await notifyCampaignReminder(campaignId);
      setMsg(r.sent > 0 ? `Rappel envoyé à ${r.sent} destinataire(s).` : (SKIP_MSG[r.skipped ?? ''] ?? 'Rien à envoyer.'));
    } catch { setMsg("Échec de l'envoi."); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={run}>{busy ? 'Envoi…' : 'Envoyer un rappel'}</Button>
    </div>
  );
}
```

- [ ] **Step 3: Brancher le bouton sur la page journal**

Dans `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx` :

Ajouter l'import :
```ts
import { SendReminderButton } from './SendReminderButton.client';
```

Remplacer la ligne du bouton « Nouvelle opération » :
```tsx
          {canWrite && <OperationEditor campaignId={campaign.id} parcelGps={parcelGps} trigger={<Button>Nouvelle opération</Button>} />}
```
par :
```tsx
          {canWrite && (
            <div className="flex items-center gap-2">
              <SendReminderButton campaignId={campaign.id} />
              <OperationEditor campaignId={campaign.id} parcelGps={parcelGps} trigger={<Button>Nouvelle opération</Button>} />
            </div>
          )}
```

- [ ] **Step 4: Toggle de préférence (client)**

Créer `apps/admin/src/app/membres/NotificationPreferenceToggle.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { setNotificationPreference } from '@/lib/suivi-actions';

export function NotificationPreferenceToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle(next: boolean) {
    setEnabled(next); setBusy(true);
    try { await setNotificationPreference(next); } catch { setEnabled(!next); }
    finally { setBusy(false); }
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
      Recevoir les rappels de suivi par email
    </label>
  );
}
```

- [ ] **Step 5: Brancher le toggle sur la page Membres**

Dans `apps/admin/src/app/membres/page.tsx` :

Ajouter les imports :
```ts
import { getNotificationPreference } from '@/lib/suivi-actions';
import { NotificationPreferenceToggle } from './NotificationPreferenceToggle';
```

Dans le corps de `MembresPage`, après `const invitations = await apiListInvitations();`, ajouter :
```ts
  const pref = await getNotificationPreference().catch(() => ({ remindersEnabled: true }));
```

Juste après le `<div>` du titre (avant le bloc `{canInvite && …}`), insérer :
```tsx
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Mes préférences</h2>
        <NotificationPreferenceToggle initial={pref.remindersEnabled} />
      </div>
```

- [ ] **Step 6: Type-check admin**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Build admin (garde-fou rendu)**

Run: `cd apps/admin && npx next build`
Expected: build réussi (pages journal + membres compilent). Si échec par manque d'espace disque (ENOSPC), ne pas bloquer : rapporter, `tsc` reste la porte.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/lib/suivi-actions.ts "apps/admin/src/app/parcelles/[id]/campagnes/[cid]/SendReminderButton.client.tsx" "apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx" apps/admin/src/app/membres/NotificationPreferenceToggle.tsx apps/admin/src/app/membres/page.tsx
git commit -m "feat(admin): bouton « Envoyer un rappel » sur le journal + toggle préférence (Membres)"
```

---

## Self-Review

**1. Couverture du spec :**
- Kind `campaign_reminder` + rendu Brevo → Task 1. ✅
- 2 tables (`NotificationPreference`, `NotificationLog`) + repos prisma/in-memory → Task 2. ✅
- Résolveur (rôles terrain, email confirmé, préférence active) → Task 3. ✅
- `SendCampaignReminderDigestUseCase` (idempotent, filtre OVERDUE/DUE_SOON, no-due/no-recipients, garde org) → Task 4. ✅
- Endpoints `POST /campaigns/:id/notify-reminder` + `GET/PATCH /me/notification-preferences` + `NOTIFICATION_PORT`/`USER_REPOSITORY` fournis au `SuiviModule` → Task 5. ✅
- Admin : bouton rappel (journal) + toggle préférence (Membres) + 3 actions → Task 6. ✅
- Tests : rendu Brevo, repos in-memory, résolveur, use-case (5 cas), rôles, tsc API+admin → Tasks 1-6. ✅

**2. Placeholders :** aucun — chaque step porte le code complet.

**3. Cohérence des types :**
- `Notification.campaign_reminder` (Task 1) = payload utilisé par le use-case (Task 4) et le rendu (Task 1) : `{ to, campaignLabel, items:{label,dueDate?,status:'OVERDUE'|'DUE_SOON'}[], journalUrl }`. ✅
- `CampaignRecommendationsReader.execute` (Task 4) structurellement satisfaite par `GetCampaignRecommendationsUseCase` (retourne `{ hasReference, items: RecommendationItem[], … }`, `items` assignable à `{label,dueDate?,status:string}[]`) — injecté tel quel au module (Task 5). ✅
- `NotificationLogSnapshot`/`NotificationPreferenceSnapshot` (Task 2) = ceux mappés par les repos prisma (Task 2) et écrits/lus par le use-case (Task 4) et le contrôleur (Task 5). ✅
- Clé de dédup `campaign_reminder:{campaignId}:{today.slice(0,10)}` identique use-case (Task 4) et assertion test « journal non écrit » (Task 4). ✅
- Actions admin (Task 6) ↔ endpoints (Task 5) : chemins `/campaigns/:id/notify-reminder`, `/me/notification-preferences` alignés ; types de retour `{ sent, skipped? }` / `{ remindersEnabled }` cohérents. ✅

**Non couvert (hors périmètre, conforme au spec) :** cron/scheduler (brique G), conseils par phase (brique H), SMS/push/in-app, notification du bénéficiaire, digest multi-campagnes, URLs signées.
