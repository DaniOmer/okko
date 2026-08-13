# Module 2 / Brique H « Conseils par phase phénologique » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envoyer par email (kind `campaign_advice`, selon la cadence utilisateur, via le cron quotidien existant) le conseil du stade phénologique courant d'une campagne, et l'afficher sur la page journal.

**Architecture:** Réutilisation massive. `currentStage`/`resolveCampaignStageAdvice` (fonctions pures) déterminent le stade courant (ancrage semis + jours) et son conseil (`recommendedWork ?? description`) depuis la fiche publiée (`PUBLISHED_CROP_REPOSITORY`). `SendCampaignStageAdviceUseCase` envoie par destinataire selon la cadence (clé `campaign_advice:{campaignId}:{userId}`). `RunDueStageAdviceUseCase` (miroir des rappels) est déclenché par le `RemindersScheduler` en 2ᵉ passage. Un endpoint + panneau journal affichent le conseil.

**Tech Stack:** NestJS + Jest (API) ; Next.js App Router (admin). **Aucune migration** (réutilise les tables existantes).

**Spec de référence :** `docs/superpowers/specs/2026-08-14-conseils-phase-phenologique-brique-h-design.md`

## Global Constraints

- `organizationId`/identité du JWT côté endpoints ; le cron lit `organizationId` **depuis la campagne**.
- **La suite de tests API complète est destructrice.** Ne lancer QUE les specs ciblées par chemin exact (repos in-memory / stubs). NE JAMAIS lancer `npx jest` seul.
- Portes de type-check : `npx tsc --noEmit` vert côté API **et** admin.
- Cadence : `campaign_advice:{campaignId}:{userId}`, envoi si `!lastSentAt` OU `daysBetween(last, today) >= everyNDays` ; le résolveur exclut déjà `everyNDays === 0` (« Jamais »).
- Ancrage : 1re op `PLANTING`/`NURSERY` (date min) `??` `campaign.startDate` (comme la brique D).
- Contenu du conseil : `stage.recommendedWork ?? stage.description` ; vide/absent → pas de conseil.
- Apostrophes : aucune apostrophe **droite** (`'`, U+0027) parasite ne doit fermer un littéral simple-quote ; les apostrophes courbes (`’`, U+2019) et accents dans les littéraux sont valides. Préférer guillemets doubles/backticks pour le FR. `&apos;` dans le JSX.
- Messages de commit terminés par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

**API**
- `src/application/shared/days.ts` (create) — `daysBetween` extrait ; import dans le use-case de rappel.
- `src/application/notification/notification-port.ts` — +kind `campaign_advice`.
- `src/infrastructure/notification/brevo-email-notification-sender.ts` — `case 'campaign_advice'`.
- `src/application/notification/campaign-stage-advice.ts` (create) — `currentStage` + `resolveCampaignStageAdvice`.
- `src/application/notification/send-campaign-stage-advice.use-case.ts` (create).
- `src/application/notification/get-campaign-stage-advice.use-case.ts` (create).
- `src/application/notification/run-due-stage-advice.use-case.ts` (create).
- `src/presentation/notification/reminders.scheduler.ts` — 2ᵉ passage.
- `src/presentation/parcel/campaign.controller.ts` — `GET :id/stage-advice`.
- `src/suivi.module.ts` — `PUBLISHED_CROP_REPOSITORY` + 3 use-cases + scheduler.

**Admin**
- `src/lib/api.ts` — `getCampaignStageAdvice`.
- `src/app/parcelles/[id]/campagnes/[cid]/page.tsx` — panneau « Conseil du stade ».

---

## Task 1: `daysBetween` partagé + kind `campaign_advice` + rendu Brevo

**Files:**
- Create: `apps/api/src/application/shared/days.ts`
- Modify: `apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts` (import du util extrait)
- Modify: `apps/api/src/application/notification/notification-port.ts`
- Modify: `apps/api/src/infrastructure/notification/brevo-email-notification-sender.ts`
- Test: Create `apps/api/src/application/shared/days.spec.ts` ; Modify `apps/api/src/infrastructure/notification/brevo-email-notification-sender.spec.ts`

**Interfaces:**
- Produces :
  - `daysBetween(aIso: string, bIso: string): number` (`application/shared/days`).
  - `Notification` union +`{ kind: 'campaign_advice'; to: string; campaignLabel: string; stageName: string; advice: string; journalUrl: string }`.

- [ ] **Step 1: Écrire les tests (échouent)**

Créer `apps/api/src/application/shared/days.spec.ts` :
```ts
import { daysBetween } from './days';

describe('daysBetween', () => {
  it('compte les jours UTC entiers, heures ignorées', () => {
    expect(daysBetween('2026-08-11T23:00:00.000Z', '2026-08-13T01:00:00.000Z')).toBe(2);
    expect(daysBetween('2026-08-13T00:00:00.000Z', '2026-08-13T23:00:00.000Z')).toBe(0);
  });
});
```
Dans `brevo-email-notification-sender.spec.ts`, ajouter dans le `describe` existant :
```ts
  it('POST Brevo pour un conseil de stade (campaign_advice) — stade + conseil + lien', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 201 } as Response);
    const sender = new BrevoEmailNotificationSender();
    await sender.send({ kind: 'campaign_advice', to: 'x@y.z', campaignLabel: 'Parcelle Nord — Saison 2026', stageName: 'Floraison', advice: 'Surveiller les pucerons.', journalUrl: 'http://app/parcelles/p1/campagnes/c1' });
    const [, init] = fetchMock.mock.calls[0];
    const body = init!.body as string;
    expect(body).toContain('Floraison');
    expect(body).toContain('Surveiller les pucerons.');
    expect(body).toContain('http://app/parcelles/p1/campagnes/c1');
    expect(body).toContain('Conseil de culture');
  });
```

- [ ] **Step 2: Lancer les tests — ils échouent**

Run: `cd apps/api && npx jest src/application/shared/days.spec.ts src/infrastructure/notification/brevo-email-notification-sender.spec.ts`
Expected: FAIL (`days` introuvable ; kind `campaign_advice` absent de l'union).

- [ ] **Step 3: Extraire `daysBetween`**

Créer `apps/api/src/application/shared/days.ts` :
```ts
export function daysBetween(aIso: string, bIso: string): number {
  return Math.floor((Date.parse(bIso.slice(0, 10)) - Date.parse(aIso.slice(0, 10))) / 86400000);
}
```
Dans `send-campaign-reminder-digest.use-case.ts`, **supprimer** la fonction locale `daysBetween` (les 3 lignes `function daysBetween(...) { ... }`) et ajouter l'import en tête :
```ts
import { daysBetween } from '../shared/days';
```

- [ ] **Step 4: Étendre l'union `Notification`**

Dans `notification-port.ts`, remplacer le type `Notification` par (ajout du 4ᵉ membre) :
```ts
export type Notification =
  | { kind: 'invitation'; to: string; organizationName: string; inviteUrl: string; expiresAt: Date }
  | { kind: 'email_confirmation'; to: string; confirmUrl: string; expiresAt: Date }
  | { kind: 'campaign_reminder'; to: string; campaignLabel: string; items: { label: string; dueDate?: string; status: 'OVERDUE' | 'DUE_SOON' }[]; journalUrl: string }
  | { kind: 'campaign_advice'; to: string; campaignLabel: string; stageName: string; advice: string; journalUrl: string };
```

- [ ] **Step 5: Rendu Brevo**

Dans `brevo-email-notification-sender.ts`, méthode `render`, ajouter un `case` avant l'accolade fermante du `switch` :
```ts
      case 'campaign_advice': {
        const subject = `Conseil de culture — ${n.campaignLabel}`;
        const html = `<p>Conseil pour <strong>${this.escapeHtml(n.campaignLabel)}</strong> — stade <strong>${this.escapeHtml(n.stageName)}</strong> :</p>`
          + `<p>${this.escapeHtml(n.advice)}</p>`
          + `<p><a href="${this.escapeHtml(n.journalUrl)}">Ouvrir le journal</a></p>`;
        return { subject, html };
      }
```

- [ ] **Step 6: Lancer les tests + non-régression rappel**

Run: `cd apps/api && npx jest src/application/shared/days.spec.ts src/infrastructure/notification/brevo-email-notification-sender.spec.ts src/application/notification/send-campaign-reminder-digest.use-case.spec.ts`
Expected: PASS (le use-case de rappel reste vert — `daysBetween` importé au lieu de local).

- [ ] **Step 7: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/application/shared/days.ts apps/api/src/application/shared/days.spec.ts apps/api/src/application/notification/send-campaign-reminder-digest.use-case.ts apps/api/src/application/notification/notification-port.ts apps/api/src/infrastructure/notification/brevo-email-notification-sender.ts apps/api/src/infrastructure/notification/brevo-email-notification-sender.spec.ts
git commit -m "feat(notif): daysBetween partagé + kind campaign_advice + rendu Brevo"
```

---

## Task 2: `currentStage` + `resolveCampaignStageAdvice`

**Files:**
- Create: `apps/api/src/application/notification/campaign-stage-advice.ts`
- Test: Create `apps/api/src/application/notification/campaign-stage-advice.spec.ts`

**Interfaces:**
- Consumes : `PhenologicalStageJSON` (`domain/crop/phenological-stage`), `OperationType` (`domain/window/operation-type`), `daysBetween` (Task 1).
- Produces :
  - `currentStage(phenology: PhenologicalStageJSON[], daysSinceAnchor: number): PhenologicalStageJSON | null`.
  - `resolveCampaignStageAdvice(campaign: { startDate?: string }, phenology: PhenologicalStageJSON[], journalOps: { type: OperationType; date: string }[], today: string): { stageName: string; advice: string } | null`.

- [ ] **Step 1: Écrire le test (échoue)**

Créer `apps/api/src/application/notification/campaign-stage-advice.spec.ts` :
```ts
import { currentStage, resolveCampaignStageAdvice } from './campaign-stage-advice';
import { OperationType } from '../../domain/window/operation-type';
import type { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';

const PHENO: PhenologicalStageJSON[] = [
  { name: { fr: 'Levée' }, startDay: 0, endDay: 10, order: 0 },
  { name: { fr: 'Floraison' }, startDay: 50, endDay: 65, order: 1, recommendedWork: 'Surveiller les pucerons.' },
  { name: { fr: 'Maturation' }, startDay: 90, endDay: 120, order: 2, description: 'Préparer la récolte.' },
];

describe('currentStage', () => {
  it('renvoie le stade contenant daysSinceAnchor', () => {
    expect(currentStage(PHENO, 55)?.name.fr).toBe('Floraison');
  });
  it('renvoie null hors de tout stade', () => {
    expect(currentStage(PHENO, 30)).toBeNull();
  });
  it('en cas de chevauchement, plus petit order', () => {
    const overlap: PhenologicalStageJSON[] = [
      { name: { fr: 'B' }, startDay: 0, endDay: 100, order: 2 },
      { name: { fr: 'A' }, startDay: 0, endDay: 100, order: 1 },
    ];
    expect(currentStage(overlap, 10)?.name.fr).toBe('A');
  });
});

describe('resolveCampaignStageAdvice', () => {
  const opsPlanting = [{ type: OperationType.PLANTING, date: '2026-05-01' }];
  it('ancrage semis + recommendedWork prioritaire (J55 → Floraison)', () => {
    const r = resolveCampaignStageAdvice({ startDate: '2026-04-01' }, PHENO, opsPlanting, '2026-06-25T00:00:00.000Z');
    expect(r).toEqual({ stageName: 'Floraison', advice: 'Surveiller les pucerons.' });
  });
  it('repli sur startDate sans op de semis (J55 → Floraison)', () => {
    const r = resolveCampaignStageAdvice({ startDate: '2026-05-01' }, PHENO, [], '2026-06-25T00:00:00.000Z');
    expect(r).toEqual({ stageName: 'Floraison', advice: 'Surveiller les pucerons.' });
  });
  it('description si recommendedWork absent (J92 → Maturation)', () => {
    const r = resolveCampaignStageAdvice({ startDate: '2026-05-01' }, PHENO, [], '2026-08-01T00:00:00.000Z');
    expect(r).toEqual({ stageName: 'Maturation', advice: 'Préparer la récolte.' });
  });
  it('sans ancrage → null', () => {
    expect(resolveCampaignStageAdvice({}, PHENO, [], '2026-06-25T00:00:00.000Z')).toBeNull();
  });
  it('conseil vide (Levée, ni recommendedWork ni description) → null', () => {
    expect(resolveCampaignStageAdvice({ startDate: '2026-05-01' }, PHENO, opsPlanting, '2026-05-03T00:00:00.000Z')).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `cd apps/api && npx jest src/application/notification/campaign-stage-advice.spec.ts`
Expected: FAIL (`campaign-stage-advice` introuvable).

- [ ] **Step 3: Implémenter**

Créer `apps/api/src/application/notification/campaign-stage-advice.ts` :
```ts
import { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import { OperationType } from '../../domain/window/operation-type';
import { daysBetween } from '../shared/days';

export function currentStage(phenology: PhenologicalStageJSON[], daysSinceAnchor: number): PhenologicalStageJSON | null {
  const matches = phenology.filter((s) => daysSinceAnchor >= s.startDay && daysSinceAnchor <= s.endDay);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (b.order < a.order ? b : a));
}

export function resolveCampaignStageAdvice(
  campaign: { startDate?: string },
  phenology: PhenologicalStageJSON[],
  journalOps: { type: OperationType; date: string }[],
  today: string,
): { stageName: string; advice: string } | null {
  const sow = journalOps.filter((o) => o.type === OperationType.PLANTING || o.type === OperationType.NURSERY).map((o) => o.date).sort()[0];
  const anchor = sow ?? campaign.startDate;
  if (!anchor) return null;
  const stage = currentStage(phenology, daysBetween(anchor, today));
  if (!stage) return null;
  const advice = stage.recommendedWork ?? stage.description;
  if (!advice) return null;
  const stageName = stage.name.fr ?? Object.values(stage.name)[0] ?? '';
  return { stageName, advice };
}
```

- [ ] **Step 4: Lancer le test — il passe**

Run: `cd apps/api && npx jest src/application/notification/campaign-stage-advice.spec.ts`
Expected: PASS.

- [ ] **Step 5: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/notification/campaign-stage-advice.ts apps/api/src/application/notification/campaign-stage-advice.spec.ts
git commit -m "feat(notif): currentStage + resolveCampaignStageAdvice (stade courant + conseil)"
```

---

## Task 3: `SendCampaignStageAdviceUseCase` + `GetCampaignStageAdviceUseCase`

**Files:**
- Create: `apps/api/src/application/notification/send-campaign-stage-advice.use-case.ts`
- Create: `apps/api/src/application/notification/get-campaign-stage-advice.use-case.ts`
- Test: Create `apps/api/src/application/notification/send-campaign-stage-advice.use-case.spec.ts`, `get-campaign-stage-advice.use-case.spec.ts`

**Interfaces:**
- Consumes : `resolveCampaignStageAdvice` (Task 2), `resolveCampaignRecipients`, `NotificationLogRepository` (`lastSentAt`/`recordSent`), `daysBetween`, `PublishedCropRepository` (`findLatest`), `CampaignRepository`, `ParcelRepository`, `OperationLogRepository`, `UserRepository`, `NotificationPreferenceRepository`, `NotificationPort`, `Clock`, `IdGenerator`, `CampaignNotFoundError`.
- Produces :
  - `SendCampaignStageAdviceUseCase.execute({ campaignId, organizationId, today }): Promise<{ sent: number; skipped?: 'no_reference' | 'no_advice' | 'no_recipients' }>` ; constructeur `(campaigns, parcels, published, operations, users, prefs, log, notifier, clock, ids)`.
  - `GetCampaignStageAdviceUseCase.execute({ campaignId, organizationId }): Promise<{ stageName: string; advice: string } | null>` ; constructeur `(campaigns, published, operations, clock)`.

- [ ] **Step 1: Écrire les tests (échouent)**

Créer `apps/api/src/application/notification/send-campaign-stage-advice.use-case.spec.ts` :
```ts
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
```
(Note : `startDate: '2026-06-19'` + `today 2026-08-13` = J55 → Floraison ; `startDate: '2026-08-01'` = J12 → hors stade.)

Créer `apps/api/src/application/notification/get-campaign-stage-advice.use-case.spec.ts` :
```ts
import { GetCampaignStageAdviceUseCase } from './get-campaign-stage-advice.use-case';
import { InMemoryCampaignRepository } from '../parcel/in-memory-campaign.repository';
import { InMemoryOperationLogRepository } from '../parcel/in-memory-operation-log.repository';
import { InMemoryPublishedCropRepository } from '../crop/in-memory-published-crop.repository';
import { CampaignNotFoundError } from '../parcel/errors';
import type { CropDocument } from '../crop/crop-read-model';
import type { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';

const PHENO: PhenologicalStageJSON[] = [{ name: { fr: 'Floraison' }, startDay: 50, endDay: 65, order: 1, recommendedWork: 'Surveiller les pucerons.' }];
const clock = { nowIso: () => '2026-08-13T00:00:00.000Z' };

function make() {
  const campaigns = new InMemoryCampaignRepository();
  const ops = new InMemoryOperationLogRepository();
  const published = new InMemoryPublishedCropRepository();
  const uc = new GetCampaignStageAdviceUseCase(campaigns, published, ops, clock);
  return { campaigns, published, uc };
}

describe('GetCampaignStageAdviceUseCase', () => {
  it('renvoie le conseil du stade courant', async () => {
    const m = make();
    await m.campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', season: 'S', startDate: '2026-06-19', status: 'ACTIVE', createdAt: '' });
    await m.published.save({ cropId: 'crop1', revision: 1, document: { phenology: PHENO } as unknown as CropDocument, version: 1, publishedAt: '', publishedBy: '', note: null });
    expect(await m.uc.execute({ campaignId: 'c1', organizationId: 'o1' })).toEqual({ stageName: 'Floraison', advice: 'Surveiller les pucerons.' });
  });
  it('null si pas de cropId', async () => {
    const m = make();
    await m.campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', season: 'S', startDate: '2026-06-19', status: 'ACTIVE', createdAt: '' });
    expect(await m.uc.execute({ campaignId: 'c1', organizationId: 'o1' })).toBeNull();
  });
  it("garde org → CampaignNotFoundError", async () => {
    const m = make();
    await m.campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', season: 'S', startDate: '2026-06-19', status: 'ACTIVE', createdAt: '' });
    await expect(m.uc.execute({ campaignId: 'c1', organizationId: 'oX' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
```

- [ ] **Step 2: Lancer les tests — ils échouent**

Run: `cd apps/api && npx jest src/application/notification/send-campaign-stage-advice.use-case.spec.ts src/application/notification/get-campaign-stage-advice.use-case.spec.ts`
Expected: FAIL (use-cases introuvables).

- [ ] **Step 3: `SendCampaignStageAdviceUseCase`**

Créer `apps/api/src/application/notification/send-campaign-stage-advice.use-case.ts` :
```ts
import { CampaignRepository } from '../parcel/campaign.repository';
import { ParcelRepository } from '../parcel/parcel.repository';
import { OperationLogRepository } from '../parcel/operation-log.repository';
import { PublishedCropRepository } from '../crop/published-crop.repository';
import { UserRepository } from '../auth/repositories';
import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationLogRepository } from './notification-log.repository';
import { NotificationPort } from './notification-port';
import { resolveCampaignRecipients } from './campaign-recipients';
import { resolveCampaignStageAdvice } from './campaign-stage-advice';
import { daysBetween } from '../shared/days';
import { CampaignNotFoundError } from '../parcel/errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface StageAdviceResult { sent: number; skipped?: 'no_reference' | 'no_advice' | 'no_recipients'; }

export class SendCampaignStageAdviceUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly parcels: ParcelRepository,
    private readonly published: PublishedCropRepository,
    private readonly operations: OperationLogRepository,
    private readonly users: UserRepository,
    private readonly prefs: NotificationPreferenceRepository,
    private readonly log: NotificationLogRepository,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: { campaignId: string; organizationId: string; today: string }): Promise<StageAdviceResult> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    if (!campaign.cropId) return { sent: 0, skipped: 'no_reference' };
    const published = await this.published.findLatest(campaign.cropId);
    if (!published) return { sent: 0, skipped: 'no_reference' };
    const journal = await this.operations.listByCampaign(input.organizationId, input.campaignId);
    const advice = resolveCampaignStageAdvice(campaign, published.document.phenology ?? [], journal, input.today);
    if (!advice) return { sent: 0, skipped: 'no_advice' };
    const recipients = await resolveCampaignRecipients(this.users, this.prefs, input.organizationId);
    if (recipients.length === 0) return { sent: 0, skipped: 'no_recipients' };
    const parcel = await this.parcels.findById(campaign.parcelId);
    const campaignLabel = `${parcel?.name ?? 'Parcelle'} — ${campaign.season}`;
    const base = process.env.INVITE_BASE_URL ?? 'http://localhost:3000';
    const journalUrl = `${base}/parcelles/${campaign.parcelId}/campagnes/${input.campaignId}`;
    let sent = 0;
    for (const r of recipients) {
      const dedupKey = `campaign_advice:${input.campaignId}:${r.userId}`;
      const last = await this.log.lastSentAt(dedupKey);
      if (last && daysBetween(last, input.today) < r.everyNDays) continue;
      await this.notifier.send({ kind: 'campaign_advice', to: r.email, campaignLabel, stageName: advice.stageName, advice: advice.advice, journalUrl });
      await this.log.recordSent({ id: this.ids.next(), organizationId: input.organizationId, dedupKey, kind: 'campaign_advice', sentAt: this.clock.nowIso() });
      sent += 1;
    }
    return { sent };
  }
}
```

- [ ] **Step 4: `GetCampaignStageAdviceUseCase`**

Créer `apps/api/src/application/notification/get-campaign-stage-advice.use-case.ts` :
```ts
import { CampaignRepository } from '../parcel/campaign.repository';
import { OperationLogRepository } from '../parcel/operation-log.repository';
import { PublishedCropRepository } from '../crop/published-crop.repository';
import { resolveCampaignStageAdvice } from './campaign-stage-advice';
import { CampaignNotFoundError } from '../parcel/errors';
import { Clock } from '../shared/clock';

export class GetCampaignStageAdviceUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly published: PublishedCropRepository,
    private readonly operations: OperationLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { campaignId: string; organizationId: string }): Promise<{ stageName: string; advice: string } | null> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    if (!campaign.cropId) return null;
    const published = await this.published.findLatest(campaign.cropId);
    if (!published) return null;
    const journal = await this.operations.listByCampaign(input.organizationId, input.campaignId);
    return resolveCampaignStageAdvice(campaign, published.document.phenology ?? [], journal, this.clock.nowIso());
  }
}
```

- [ ] **Step 5: Lancer les tests — ils passent**

Run: `cd apps/api && npx jest src/application/notification/send-campaign-stage-advice.use-case.spec.ts src/application/notification/get-campaign-stage-advice.use-case.spec.ts`
Expected: PASS.

- [ ] **Step 6: Type-check API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/application/notification/send-campaign-stage-advice.use-case.ts apps/api/src/application/notification/get-campaign-stage-advice.use-case.ts apps/api/src/application/notification/send-campaign-stage-advice.use-case.spec.ts apps/api/src/application/notification/get-campaign-stage-advice.use-case.spec.ts
git commit -m "feat(notif): use-cases envoi + lecture du conseil de stade (cadence)"
```

---

## Task 4: `RunDueStageAdviceUseCase` + scheduler (2ᵉ passage) + endpoint + module

**Files:**
- Create: `apps/api/src/application/notification/run-due-stage-advice.use-case.ts`
- Modify: `apps/api/src/presentation/notification/reminders.scheduler.ts`
- Modify: `apps/api/src/presentation/parcel/campaign.controller.ts`
- Modify: `apps/api/src/suivi.module.ts`
- Test: Modify `apps/api/src/presentation/notification/reminders.scheduler.spec.ts` ; Create `apps/api/src/application/notification/run-due-stage-advice.use-case.spec.ts` ; Modify `apps/api/src/presentation/notification/notification-roles.spec.ts`

**Interfaces:**
- Consumes : `SendCampaignStageAdviceUseCase`, `GetCampaignStageAdviceUseCase` (Task 3), `RunDueRemindersUseCase`, `PUBLISHED_CROP_REPOSITORY`.
- Produces :
  - `RunDueStageAdviceUseCase.execute({ today }): Promise<{ campaigns: number; sent: number; failed: number }>` ; `CampaignAdviceSender` interface.
  - `GET /campaigns/:id/stage-advice` (`CampaignController.stageAdvice`, 4 rôles tenant).

- [ ] **Step 1: Écrire les tests (échouent)**

Créer `apps/api/src/application/notification/run-due-stage-advice.use-case.spec.ts` :
```ts
import { RunDueStageAdviceUseCase, CampaignAdviceSender } from './run-due-stage-advice.use-case';
import { InMemoryCampaignRepository } from '../parcel/in-memory-campaign.repository';

const senderOf = (impl: CampaignAdviceSender['execute']): CampaignAdviceSender => ({ execute: impl });
async function seed(campaigns: InMemoryCampaignRepository) {
  await campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', season: 'S', status: 'ACTIVE', createdAt: '' });
  await campaigns.save({ id: 'c2', organizationId: 'o2', parcelId: 'p2', season: 'S', status: 'ACTIVE', createdAt: '' });
  await campaigns.save({ id: 'c3', organizationId: 'o1', parcelId: 'p3', season: 'S', status: 'CLOSED', createdAt: '' });
}

describe('RunDueStageAdviceUseCase', () => {
  it('parcourt les campagnes ACTIVE (toutes orgs) et agrège sent', async () => {
    const campaigns = new InMemoryCampaignRepository();
    await seed(campaigns);
    const uc = new RunDueStageAdviceUseCase(campaigns, senderOf(async () => ({ sent: 1 })));
    expect(await uc.execute({ today: '2026-08-13T00:00:00.000Z' })).toEqual({ campaigns: 2, sent: 2, failed: 0 });
  });
  it("une campagne dont l'envoi lève n'interrompt pas le passage", async () => {
    const campaigns = new InMemoryCampaignRepository();
    await seed(campaigns);
    const uc = new RunDueStageAdviceUseCase(campaigns, senderOf(async (i) => { if (i.campaignId === 'c1') throw new Error('boom'); return { sent: 1 }; }));
    expect(await uc.execute({ today: '2026-08-13T00:00:00.000Z' })).toEqual({ campaigns: 2, sent: 1, failed: 1 });
  });
});
```

Réécrire `apps/api/src/presentation/notification/reminders.scheduler.spec.ts` :
```ts
import { RemindersScheduler } from './reminders.scheduler';
import type { RunDueRemindersUseCase } from '../../application/notification/run-due-reminders.use-case';
import type { RunDueStageAdviceUseCase } from '../../application/notification/run-due-stage-advice.use-case';

describe('RemindersScheduler', () => {
  it('handleCron déclenche rappels ET conseils avec le today de l horloge', async () => {
    const calls: string[] = [];
    const runDue = { execute: async (i: { today: string }) => { calls.push(`reminders:${i.today}`); return { campaigns: 1, sent: 1, failed: 0 }; } } as unknown as RunDueRemindersUseCase;
    const runAdvice = { execute: async (i: { today: string }) => { calls.push(`advice:${i.today}`); return { campaigns: 1, sent: 1, failed: 0 }; } } as unknown as RunDueStageAdviceUseCase;
    const clock = { nowIso: () => '2026-08-13T00:00:00.000Z' };
    const sched = new RemindersScheduler(runDue, runAdvice, clock);
    await sched.handleCron();
    expect(calls).toEqual(['reminders:2026-08-13T00:00:00.000Z', 'advice:2026-08-13T00:00:00.000Z']);
  });
});
```

Dans `apps/api/src/presentation/notification/notification-roles.spec.ts`, ajouter un `it` dans le `describe` existant :
```ts
  it('GET /campaigns/:id/stage-advice = 4 rôles tenant (VIEWER inclus)', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CampaignController.prototype.stageAdvice);
    expect(roles).toContain('VIEWER');
  });
```

- [ ] **Step 2: Lancer les tests — ils échouent**

Run: `cd apps/api && npx jest src/application/notification/run-due-stage-advice.use-case.spec.ts src/presentation/notification/reminders.scheduler.spec.ts src/presentation/notification/notification-roles.spec.ts`
Expected: FAIL (`run-due-stage-advice` + 3e arg scheduler + `stageAdvice` handler absents).

- [ ] **Step 3: `RunDueStageAdviceUseCase`**

Créer `apps/api/src/application/notification/run-due-stage-advice.use-case.ts` :
```ts
import { CampaignRepository } from '../parcel/campaign.repository';

export interface CampaignAdviceSender {
  execute(input: { campaignId: string; organizationId: string; today: string }): Promise<{ sent: number }>;
}

export class RunDueStageAdviceUseCase {
  constructor(private readonly campaigns: CampaignRepository, private readonly sender: CampaignAdviceSender) {}
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

- [ ] **Step 4: Scheduler — 2ᵉ passage**

Réécrire `apps/api/src/presentation/notification/reminders.scheduler.ts` :
```ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RunDueRemindersUseCase } from '../../application/notification/run-due-reminders.use-case';
import { RunDueStageAdviceUseCase } from '../../application/notification/run-due-stage-advice.use-case';
import { CLOCK, Clock } from '../../application/shared/clock';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger('RemindersScheduler');
  private running = false;

  constructor(
    private readonly runDue: RunDueRemindersUseCase,
    private readonly runAdvice: RunDueStageAdviceUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Cron(process.env.REMINDERS_CRON ?? '0 5 * * *')
  async handleCron(): Promise<void> {
    if (this.running) { this.logger.warn('Passage de notifications deja en cours, saut.'); return; }
    this.running = true;
    try {
      const today = this.clock.nowIso();
      const r = await this.runDue.execute({ today });
      this.logger.log(`Rappels: ${r.campaigns} campagnes, ${r.sent} envois, ${r.failed} echecs.`);
      const a = await this.runAdvice.execute({ today });
      this.logger.log(`Conseils: ${a.campaigns} campagnes, ${a.sent} envois, ${a.failed} echecs.`);
    } finally {
      this.running = false;
    }
  }
}
```

- [ ] **Step 5: Endpoint `GET :id/stage-advice`**

Dans `apps/api/src/presentation/parcel/campaign.controller.ts` :

Ajouter l'import :
```ts
import { GetCampaignStageAdviceUseCase } from '../../application/notification/get-campaign-stage-advice.use-case';
```
Ajouter au constructeur (après `reminderUC`) :
```ts
    private readonly reminderUC: SendCampaignReminderDigestUseCase,
    private readonly stageAdviceUC: GetCampaignStageAdviceUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}
```
Ajouter la route (après `recommendations`) :
```ts
  @Get(':id/stage-advice') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async stageAdvice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { return await this.stageAdviceUC.execute({ campaignId: id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }
```

- [ ] **Step 6: Câbler le `SuiviModule`**

Dans `apps/api/src/suivi.module.ts`, ajouter les imports :
```ts
import { PUBLISHED_CROP_REPOSITORY } from './application/crop/published-crop.repository';
import { PrismaPublishedCropRepository } from './infrastructure/crop/prisma-published-crop.repository';
import { SendCampaignStageAdviceUseCase } from './application/notification/send-campaign-stage-advice.use-case';
import { GetCampaignStageAdviceUseCase } from './application/notification/get-campaign-stage-advice.use-case';
import { RunDueStageAdviceUseCase } from './application/notification/run-due-stage-advice.use-case';
```
Ajouter dans `providers` (après le provider `RemindersScheduler` / les providers notification) :
```ts
    { provide: PUBLISHED_CROP_REPOSITORY, useClass: PrismaPublishedCropRepository },
    { provide: SendCampaignStageAdviceUseCase, useFactory: (c, p, pub, ops, u, pref, log, notif, clk, ids) => new SendCampaignStageAdviceUseCase(c, p, pub, ops, u, pref, log, notif, clk, ids), inject: [CAMPAIGN_REPOSITORY, PARCEL_REPOSITORY, PUBLISHED_CROP_REPOSITORY, OPERATION_LOG_REPOSITORY, USER_REPOSITORY, NOTIFICATION_PREFERENCE_REPOSITORY, NOTIFICATION_LOG_REPOSITORY, NOTIFICATION_PORT, CLOCK, UuidIdGenerator] },
    { provide: GetCampaignStageAdviceUseCase, useFactory: (c, pub, ops, clk) => new GetCampaignStageAdviceUseCase(c, pub, ops, clk), inject: [CAMPAIGN_REPOSITORY, PUBLISHED_CROP_REPOSITORY, OPERATION_LOG_REPOSITORY, CLOCK] },
    { provide: RunDueStageAdviceUseCase, useFactory: (c, sender) => new RunDueStageAdviceUseCase(c, sender), inject: [CAMPAIGN_REPOSITORY, SendCampaignStageAdviceUseCase] },
```
(`RemindersScheduler` reçoit désormais `RunDueStageAdviceUseCase` par injection Nest ; `CampaignController` reçoit `GetCampaignStageAdviceUseCase` — aucun changement de leurs déclarations dans `controllers`/`providers`, Nest résout par type.)

- [ ] **Step 7: Lancer les tests — ils passent**

Run: `cd apps/api && npx jest src/application/notification/run-due-stage-advice.use-case.spec.ts src/presentation/notification/reminders.scheduler.spec.ts src/presentation/notification/notification-roles.spec.ts`
Expected: PASS.

- [ ] **Step 8: Type-check API + re-run des specs notification**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.
Run: `cd apps/api && npx jest src/application/notification src/presentation/notification`
Expected: PASS (tous les specs notification).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/application/notification/run-due-stage-advice.use-case.ts apps/api/src/application/notification/run-due-stage-advice.use-case.spec.ts apps/api/src/presentation/notification/reminders.scheduler.ts apps/api/src/presentation/notification/reminders.scheduler.spec.ts apps/api/src/presentation/parcel/campaign.controller.ts apps/api/src/presentation/notification/notification-roles.spec.ts apps/api/src/suivi.module.ts
git commit -m "feat(notif): RunDueStageAdvice + scheduler 2e passage + endpoint stage-advice + module"
```

---

## Task 5: Admin — panneau « Conseil du stade »

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx`

**Interfaces:**
- Consumes : endpoint `GET /campaigns/:id/stage-advice` (Task 4).
- Produces : `getCampaignStageAdvice(campaignId): Promise<{ stageName: string; advice: string } | null>`.

- [ ] **Step 1: Client API**

Dans `apps/admin/src/lib/api.ts`, ajouter après `getCampaignRecommendations` :
```ts
export async function getCampaignStageAdvice(campaignId: string): Promise<{ stageName: string; advice: string } | null> {
  const res = await authFetch(`/campaigns/${campaignId}/stage-advice`, { cache: 'no-store' });
  return res.json();
}
```

- [ ] **Step 2: Panneau sur la page journal**

Dans `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx` :

Ajouter `getCampaignStageAdvice` à l'import depuis `@/lib/api` :
```ts
import { listCampaigns, listOperations, getCampaignRecommendations, CampaignRecommendations, listParcels, getCampaignStageAdvice } from '@/lib/api';
```
Ajouter au `Promise.all` (5ᵉ entrée) + récupérer la valeur :
```ts
  const [campaigns, operations, reco, parcels, stageAdvice] = await Promise.all([
    listCampaigns(params.id).catch(() => []), listOperations(params.cid).catch(() => []),
    getCampaignRecommendations(params.cid).catch((): CampaignRecommendations => ({ hasReference: false, items: [] })),
    listParcels().catch(() => []),
    getCampaignStageAdvice(params.cid).catch(() => null),
  ]);
```
Juste après la fermeture `</section>` du panneau « Recommandations », insérer :
```tsx
      {stageAdvice && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Conseil du stade — {stageAdvice.stageName}</h2>
          <p className="text-sm">{stageAdvice.advice}</p>
        </section>
      )}
```

- [ ] **Step 3: Type-check admin**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Build admin**

Run: `cd apps/admin && npx next build`
Expected: build réussi (page journal compile). Si échec ENOSPC (disque), ne pas bloquer : rapporter, `tsc` reste la porte.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/api.ts "apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx"
git commit -m "feat(admin): panneau « Conseil du stade » sur la page journal"
```

---

## Self-Review

**1. Couverture du spec :**
- `daysBetween` partagé + kind `campaign_advice` + rendu → Task 1. ✅
- `currentStage` + `resolveCampaignStageAdvice` (ancrage, recommendedWork ?? description) → Task 2. ✅
- `SendCampaignStageAdviceUseCase` (cadence, no_reference/no_advice/no_recipients, garde org) + `GetCampaignStageAdviceUseCase` → Task 3. ✅
- `RunDueStageAdviceUseCase` + scheduler 2ᵉ passage + endpoint `GET :id/stage-advice` + `PUBLISHED_CROP_REPOSITORY` au module → Task 4. ✅
- Admin `getCampaignStageAdvice` + panneau journal → Task 5. ✅
- Tests : daysBetween/rendu (T1), currentStage/resolve (T2), send+get (T3), run-due+scheduler+rôles (T4), tsc+build. ✅

**2. Placeholders :** aucun — chaque step porte le code complet.

**3. Cohérence des types :**
- `campaign_advice` payload `{ to, campaignLabel, stageName, advice, journalUrl }` : union (T1) = rendu (T1) = `notifier.send` (T3). ✅
- `resolveCampaignStageAdvice(...) → { stageName, advice } | null` (T2) consommé par le send (T3), le get (T3), l'endpoint (T4), l'admin (T5). ✅
- `CampaignAdviceSender` (T4) satisfait par `SendCampaignStageAdviceUseCase` (retour `{ sent, skipped? }` assignable à `{ sent }`). ✅
- Clé `campaign_advice:{campaignId}:{userId}` (T3), distincte de `campaign_reminder:…`. ✅
- Scheduler 3 args `(runDue, runAdvice, @Inject(CLOCK) clock)` (T4) ↔ test (T4) ↔ providers module (T4). ✅
- `daysBetween` (T1) importé par le use-case de rappel (T1) et le cœur conseil (T2/T3). ✅
- Ordonnancement TDD : chaque tâche laisse `tsc` vert (T1 extrait `daysBetween` + met à jour l'import du rappel dans la même tâche). ✅

**Non couvert (hors périmètre, conforme au spec) :** IA/photo (Module 3), fuseau par org, bénéficiaire, SMS/push, édition phénologie, cultures « Autre ».
