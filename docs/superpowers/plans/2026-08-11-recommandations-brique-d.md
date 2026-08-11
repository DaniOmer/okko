# Module 2 / Brique D « Recommandations datées » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire pour une campagne des recommandations datées (opérations à venir/en retard/faites) et un avertissement fenêtre de semis, en croisant son journal réel avec le calendrier de référence de la Base.

**Architecture:** Une **fonction pure** `computeRecommendations` (domaine, testée unitairement) porte toute la logique. Un use-case l'alimente (campagne + journal + fenêtre de référence via `listByCrop().find(windowId)`), exposé en `GET /campaigns/:id/recommendations` (lecture 4 rôles tenant). La campagne gagne `windowId?`/`customCropName?` (culture « Autre ») et `cropId` devient nullable. Admin : sélecteurs culture(+Autre)/fenêtre au formulaire campagne + panneau recommandations sur la page journal.

**Tech Stack:** NestJS + Prisma + Jest (API) ; Next.js App Router + shadcn (admin).

## Global Constraints

- **Isolation tenant** : `organizationId` du JWT (`@CurrentUser()`), jamais du body ; 403 si absent. La reco est en **lecture** (4 rôles tenant) ; l'écriture campagne reste 3 rôles.
- **`OperationType`** réutilisé (`domain/window/operation-type`). Mois = codes `JAN`..`DEC`.
- **Ancrage (jour 0)** : date de la 1re op de journal `PLANTING`/`NURSERY` `??` `campaign.startDate` `??` non daté.
- **Statuts** : `DONE` (op du même type au journal), `OVERDUE`/`DUE_SOON`/`UPCOMING` (échéance vs aujourd'hui, `dueSoonWindowDays` défaut 7), `UNDATED` (pas d'ancrage). Limite v1 : `DONE` par présence de type (pas d'appariement des répétitions).
- **Campagne** : `cropId` nullable ; règle création `cropId` **ou** `customCropName` (sinon `MissingCropError`→400).
- Dates ISO `yyyy-mm-dd` (comparaison lexicale valide). Gardes par contrôleur (`@UseGuards`).
- Pattern de référence : briques B/C dans `apps/api/src/{domain,application,infrastructure,presentation}/parcel/` + `suivi.module.ts`, et le formulaire campagne / page journal admin de la brique C.
- Gate de fin de tâche : `cd apps/api && npx tsc --noEmit` + jest concerné vert ; `cd apps/admin && npx tsc --noEmit` vert.

---

### Task 1: API — Fonction pure `computeRecommendations`

**Files:**
- Create: `apps/api/src/domain/parcel/recommendations.ts`
- Create test: `apps/api/src/domain/parcel/recommendations.spec.ts`

**Interfaces:**
- Consumes: `OperationType` (`../window/operation-type`).
- Produces: `computeRecommendations(input)` → `{ items: RecommendationItem[]; sowingAdvisory?: SowingAdvisory }` ; types `RecommendationStatus`, `RecommendationItem`, `SowingAdvisory`, `ComputeRecommendationsInput`.

- [ ] **Step 1: Écrire le test qui échoue** — `recommendations.spec.ts` :
```ts
import { computeRecommendations } from './recommendations';
import { OperationType } from '../window/operation-type';

const ref = [
  { type: OperationType.PLANTING, label: 'Semis', timingDays: 0 },
  { type: OperationType.WEEDING, label: 'Sarclage', timingDays: 21 },
  { type: OperationType.HARVEST, label: 'Récolte', timingDays: 110 },
];

describe('computeRecommendations', () => {
  it('DONE si une op du même type existe au journal', () => {
    const r = computeRecommendations({ referenceOperations: ref, journalOperations: [{ type: OperationType.PLANTING, date: '2026-05-01' }], anchorDate: '2026-05-01', today: '2026-05-10', dueSoonWindowDays: 7 });
    expect(r.items.find((i) => i.type === OperationType.PLANTING)?.status).toBe('DONE');
  });
  it('OVERDUE / DUE_SOON / UPCOMING selon échéance vs aujourd’hui', () => {
    const r = computeRecommendations({ referenceOperations: ref, journalOperations: [], anchorDate: '2026-05-01', today: '2026-05-25', dueSoonWindowDays: 7 });
    // Semis j0 → 2026-05-01 (passé) = OVERDUE ; Sarclage j21 → 2026-05-22 (passé) = OVERDUE ; Récolte j110 = UPCOMING
    expect(r.items.find((i) => i.type === OperationType.PLANTING)?.status).toBe('OVERDUE');
    expect(r.items.find((i) => i.type === OperationType.HARVEST)?.status).toBe('UPCOMING');
  });
  it('DUE_SOON si échéance dans la fenêtre', () => {
    const r = computeRecommendations({ referenceOperations: [{ type: OperationType.WEEDING, label: 'Sarclage', timingDays: 5 }], journalOperations: [], anchorDate: '2026-05-01', today: '2026-05-03', dueSoonWindowDays: 7 });
    expect(r.items[0].status).toBe('DUE_SOON'); // échéance 2026-05-06, dans [2026-05-03, 2026-05-10]
    expect(r.items[0].dueDate).toBe('2026-05-06');
  });
  it('UNDATED sans ancrage ; tri par timingDays', () => {
    const r = computeRecommendations({ referenceOperations: ref, journalOperations: [], today: '2026-05-10' });
    expect(r.items.map((i) => i.timingDays)).toEqual([0, 21, 110]);
    expect(r.items.every((i) => i.status === 'UNDATED')).toBe(true);
  });
  it('avertissement fenêtre de semis : hors période', () => {
    const r = computeRecommendations({ referenceOperations: [], journalOperations: [], anchorDate: '2026-01-15', today: '2026-01-20', sowingStart: 'MAY', sowingEnd: 'JUL' });
    expect(r.sowingAdvisory).toEqual({ withinWindow: false, sowingStart: 'MAY', sowingEnd: 'JUL', anchorMonth: 'JAN' });
  });
  it('avertissement fenêtre de semis : dans la période', () => {
    const r = computeRecommendations({ referenceOperations: [], journalOperations: [], anchorDate: '2026-06-15', today: '2026-06-20', sowingStart: 'MAY', sowingEnd: 'JUL' });
    expect(r.sowingAdvisory?.withinWindow).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest recommendations.spec` → FAIL (module absent).

- [ ] **Step 3: Implémenter** — `apps/api/src/domain/parcel/recommendations.ts` :
```ts
import { OperationType } from '../window/operation-type';

export type RecommendationStatus = 'DONE' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'UNDATED';

export interface RecommendationItem { type: OperationType; label: string; timingDays: number; dueDate?: string; status: RecommendationStatus; }
export interface SowingAdvisory { withinWindow: boolean; sowingStart?: string; sowingEnd?: string; anchorMonth?: string; }
export interface RecommendationsResult { items: RecommendationItem[]; sowingAdvisory?: SowingAdvisory; }

export interface ComputeRecommendationsInput {
  referenceOperations: { type: OperationType; label: string; timingDays: number }[];
  journalOperations: { type: OperationType; date: string }[];
  anchorDate?: string;
  today: string;
  sowingStart?: string;
  sowingEnd?: string;
  dueSoonWindowDays?: number;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const monthCodeOf = (iso: string): string => MONTHS[new Date(iso).getUTCMonth()];
const addDays = (iso: string, days: number): string => {
  const d = new Date(iso); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
};
const inMonthRange = (month: string, start: string, end: string): boolean => {
  const m = MONTHS.indexOf(month), s = MONTHS.indexOf(start), e = MONTHS.indexOf(end);
  if (m < 0 || s < 0 || e < 0) return true;
  return s <= e ? m >= s && m <= e : m >= s || m <= e;
};

export function computeRecommendations(input: ComputeRecommendationsInput): RecommendationsResult {
  const dueSoon = input.dueSoonWindowDays ?? 7;
  const today = input.today.slice(0, 10);
  const doneTypes = new Set(input.journalOperations.map((o) => o.type));
  const items: RecommendationItem[] = [...input.referenceOperations]
    .sort((a, b) => a.timingDays - b.timingDays)
    .map((ref) => {
      if (doneTypes.has(ref.type)) return { type: ref.type, label: ref.label, timingDays: ref.timingDays, status: 'DONE' };
      if (!input.anchorDate) return { type: ref.type, label: ref.label, timingDays: ref.timingDays, status: 'UNDATED' };
      const dueDate = addDays(input.anchorDate.slice(0, 10), ref.timingDays);
      const soonLimit = addDays(today, dueSoon);
      const status: RecommendationStatus = dueDate < today ? 'OVERDUE' : dueDate <= soonLimit ? 'DUE_SOON' : 'UPCOMING';
      return { type: ref.type, label: ref.label, timingDays: ref.timingDays, dueDate, status };
    });
  let sowingAdvisory: SowingAdvisory | undefined;
  if (input.anchorDate && input.sowingStart && input.sowingEnd) {
    const anchorMonth = monthCodeOf(input.anchorDate);
    sowingAdvisory = { withinWindow: inMonthRange(anchorMonth, input.sowingStart, input.sowingEnd), sowingStart: input.sowingStart, sowingEnd: input.sowingEnd, anchorMonth };
  }
  return { items, sowingAdvisory };
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `cd apps/api && npx jest recommendations.spec` → PASS (6 tests).

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/domain/parcel/recommendations.ts apps/api/src/domain/parcel/recommendations.spec.ts
git commit -m "feat(suivi): computeRecommendations — moteur pur des recommandations datées"
```

---

### Task 2: API — Campagne : champs de référence (`windowId`/`customCropName`, `cropId` nullable)

**Files:**
- Modify: `apps/api/src/domain/parcel/campaign.ts`
- Modify: `apps/api/src/application/parcel/campaign.use-cases.ts`
- Modify: `apps/api/src/application/parcel/errors.ts` (ajouter `MissingCropError`)
- Modify: `apps/api/prisma/schema.prisma` (model `Campaign`)
- Create: `apps/api/prisma/migrations/20260811120000_campaign_reference/migration.sql`
- Modify: `apps/api/src/infrastructure/parcel/prisma-campaign.repository.ts`
- Modify: `apps/api/src/presentation/parcel/campaign.controller.ts` (`CampaignBody`)
- Modify test: `apps/api/src/application/parcel/campaign.use-cases.spec.ts`

**Interfaces:**
- Produces: `CampaignSnapshot` gagne `cropId?`, `windowId?`, `customCropName?` ; `CreateCampaignInput`/`UpdateCampaignInput` idem ; `MissingCropError`.

- [ ] **Step 1: Mettre à jour le test** — dans `campaign.use-cases.spec.ts`, ajouter (dans le `describe` existant) :
```ts
  it('create sans cropId ni customCropName → MissingCropError', async () => {
    const { create, parcels } = make();
    await seedParcel(parcels, 'o1');
    await expect(create.execute({ organizationId: 'o1', parcelId: 'p1', season: 'S' } as never)).rejects.toBeInstanceOf(MissingCropError);
  });
  it('create avec customCropName seul (culture Autre) → OK, cropId absent', async () => {
    const { create, parcels } = make();
    await seedParcel(parcels, 'o1');
    const c = await create.execute({ organizationId: 'o1', parcelId: 'p1', customCropName: 'Fonio', season: 'S' });
    expect(c.cropId).toBeUndefined();
    expect(c.customCropName).toBe('Fonio');
  });
```
et importer l'erreur en tête du fichier : `import { CampaignNotFoundError, ParcelNotFoundError, MissingCropError } from './errors';` (ajouter `MissingCropError` à l'import existant).

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest campaign.use-cases` → FAIL (MissingCropError absent, champs absents).

- [ ] **Step 3: Domaine** — dans `apps/api/src/domain/parcel/campaign.ts`, remplacer `cropId: string;` par les 3 champs :
```ts
  cropId?: string;
  customCropName?: string;
  windowId?: string;
```

- [ ] **Step 4: Erreur** — dans `errors.ts`, ajouter :
```ts
export class MissingCropError extends Error {
  constructor() { super('A campaign requires either cropId or customCropName'); this.name = 'MissingCropError'; }
}
```

- [ ] **Step 5: Use-cases** — dans `campaign.use-cases.ts` :

Élargir les inputs :
```ts
export interface CreateCampaignInput {
  organizationId: string; parcelId: string; cropId?: string; customCropName?: string; windowId?: string; varietyId?: string;
  season: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string;
}
export interface UpdateCampaignInput {
  id: string; organizationId: string; cropId?: string; customCropName?: string; windowId?: string; varietyId?: string;
  season?: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string;
}
```
Ajouter `MissingCropError` à l'import depuis `./errors`.
Dans `CreateCampaignUseCase.execute`, après la garde parcelle, ajouter :
```ts
    if (!input.cropId && !input.customCropName) throw new MissingCropError();
```
et compléter la construction du snapshot (ajouter les 3 champs) :
```ts
      cropId: input.cropId, customCropName: input.customCropName, windowId: input.windowId, varietyId: input.varietyId, season: input.season,
```
Dans `UpdateCampaignUseCase.execute`, ajouter au snapshot les nouveaux champs via `keep` :
```ts
      cropId: keep(input.cropId, existing.cropId), customCropName: keep(input.customCropName, existing.customCropName),
      windowId: keep(input.windowId, existing.windowId), varietyId: keep(input.varietyId, existing.varietyId),
```
(remplacer la ligne `cropId: keep(...), varietyId: keep(...)` existante).

- [ ] **Step 6: Schéma + migration** — dans `schema.prisma`, model `Campaign` : rendre `cropId` optionnel et ajouter 2 colonnes :
```prisma
  cropId         String?
  customCropName String?
  windowId       String?
```
(remplacer la ligne `cropId String`). `apps/api/prisma/migrations/20260811120000_campaign_reference/migration.sql` :
```sql
ALTER TABLE "Campaign" ADD COLUMN "customCropName" TEXT, ADD COLUMN "windowId" TEXT;
ALTER TABLE "Campaign" ALTER COLUMN "cropId" DROP NOT NULL;
```
Puis Run: `cd apps/api && npx prisma generate`.

- [ ] **Step 7: Repo Prisma** — dans `prisma-campaign.repository.ts` :
`Row` : `cropId: string` → `cropId: string | null` ; ajouter `customCropName: string | null; windowId: string | null;`.
`toSnap` : `cropId: r.cropId ?? undefined,` et ajouter `customCropName: r.customCropName ?? undefined, windowId: r.windowId ?? undefined,`.
`save` `data` : `cropId: c.cropId ?? null,` et ajouter `customCropName: c.customCropName ?? null, windowId: c.windowId ?? null,`.

- [ ] **Step 8: Contrôleur** — dans `campaign.controller.ts`, remplacer le type `CampaignBody` par :
```ts
type CampaignBody = { parcelId: string; cropId?: string; customCropName?: string; windowId?: string; varietyId?: string; season: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string };
```
Ajouter `MissingCropError` à l'import depuis `../../application/parcel/errors`, et dans le `create` catch, mapper avant le `throw e` :
```ts
    catch (e) { if (e instanceof ParcelNotFoundError) throw new BadRequestException('parcelle invalide'); if (e instanceof MissingCropError) throw new BadRequestException('culture requise (cropId ou customCropName)'); throw e; }
```

- [ ] **Step 9: Vérifier** — Run: `cd apps/api && npx jest campaign.use-cases && npx tsc --noEmit` → PASS + OK.

- [ ] **Step 10: Commit**
```bash
git add apps/api/src/domain/parcel/campaign.ts apps/api/src/application/parcel apps/api/prisma apps/api/src/infrastructure/parcel/prisma-campaign.repository.ts apps/api/src/presentation/parcel/campaign.controller.ts
git commit -m "feat(suivi): campagne — windowId/customCropName + cropId nullable + règle cropId||customCropName"
```

---

### Task 3: API — Use-case recommandations + endpoint

**Files:**
- Create: `apps/api/src/application/parcel/get-campaign-recommendations.use-case.ts`
- Modify: `apps/api/src/presentation/parcel/campaign.controller.ts` (endpoint + injection)
- Modify: `apps/api/src/suivi.module.ts`
- Create test: `apps/api/src/application/parcel/get-campaign-recommendations.use-case.spec.ts`

**Interfaces:**
- Consumes: `computeRecommendations` (Task 1) ; `CampaignRepository`, `OperationLogRepository`, `CroppingWindowRepository` (`../window/cropping-window.repository`), `Clock`.
- Produces: `GetCampaignRecommendationsUseCase` ; `CampaignRecommendations` ; endpoint `GET /campaigns/:id/recommendations`.

- [ ] **Step 1: Écrire le test qui échoue** — `get-campaign-recommendations.use-case.spec.ts` :
```ts
import { GetCampaignRecommendationsUseCase } from './get-campaign-recommendations.use-case';
import { CampaignNotFoundError } from './errors';
import { InMemoryCampaignRepository } from './in-memory-campaign.repository';
import { InMemoryOperationLogRepository } from './in-memory-operation-log.repository';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { OperationType } from '../../domain/window/operation-type';

const clock = { nowIso: () => '2026-05-25T00:00:00.000Z' };

function make() {
  const campaigns = new InMemoryCampaignRepository();
  const operations = new InMemoryOperationLogRepository();
  const windows = new InMemoryCroppingWindowRepository();
  return { campaigns, operations, windows, uc: new GetCampaignRecommendationsUseCase(campaigns, operations, windows, clock) };
}

describe('GetCampaignRecommendationsUseCase', () => {
  it('garde org : campagne d’une autre org → CampaignNotFoundError', async () => {
    const { campaigns, uc } = make();
    await campaigns.save({ id: 'c1', organizationId: 'o2', parcelId: 'p1', cropId: 'crop1', windowId: 'w1', season: 'S', status: 'ACTIVE', createdAt: clock.nowIso() });
    await expect(uc.execute({ campaignId: 'c1', organizationId: 'o1' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it('sans windowId → hasReference:false', async () => {
    const { campaigns, uc } = make();
    await campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', season: 'S', status: 'ACTIVE', createdAt: clock.nowIso() });
    expect(await uc.execute({ campaignId: 'c1', organizationId: 'o1' })).toEqual({ hasReference: false, items: [] });
  });

  it('nominal : fenêtre + journal → items datés (ancrage = op semis)', async () => {
    const { campaigns, operations, windows, uc } = make();
    await campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', windowId: 'w1', season: 'S', status: 'ACTIVE', createdAt: clock.nowIso() });
    await windows.save({ id: 'w1', cropId: 'crop1', zoneId: 'z1', season: 'S', sowingStart: 'MAY', sowingEnd: 'JUL', irrigationRequired: false, operations: [
      { type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] },
      { type: OperationType.WEEDING, label: { fr: 'Sarclage' }, timingDays: 21, inputs: [] },
    ] });
    await operations.save({ id: 'op1', organizationId: 'o1', campaignId: 'c1', type: OperationType.PLANTING, date: '2026-05-01', inputs: [], recordedByUserId: 'u1', createdAt: clock.nowIso() });
    const res = await uc.execute({ campaignId: 'c1', organizationId: 'o1' });
    expect(res.hasReference).toBe(true);
    expect(res.items.find((i) => i.type === OperationType.PLANTING)?.status).toBe('DONE');
    expect(res.items.find((i) => i.type === OperationType.WEEDING)?.dueDate).toBe('2026-05-22');
    expect(res.sowingAdvisory?.withinWindow).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest get-campaign-recommendations` → FAIL.

- [ ] **Step 3: Implémenter le use-case** — `apps/api/src/application/parcel/get-campaign-recommendations.use-case.ts` :
```ts
import { CampaignRepository } from './campaign.repository';
import { OperationLogRepository } from './operation-log.repository';
import { CroppingWindowRepository } from '../window/cropping-window.repository';
import { CampaignNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { computeRecommendations, RecommendationsResult } from '../../domain/parcel/recommendations';
import { OperationType } from '../../domain/window/operation-type';

export interface CampaignRecommendations extends RecommendationsResult { hasReference: boolean; }

export class GetCampaignRecommendationsUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly operations: OperationLogRepository,
    private readonly windows: CroppingWindowRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: { campaignId: string; organizationId: string }): Promise<CampaignRecommendations> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    if (!campaign.cropId || !campaign.windowId) return { hasReference: false, items: [] };
    const windows = await this.windows.listByCrop(campaign.cropId);
    const window = windows.find((w) => w.id === campaign.windowId);
    if (!window) return { hasReference: false, items: [] };
    const journal = await this.operations.listByCampaign(input.organizationId, input.campaignId);
    const sow = journal.filter((o) => o.type === OperationType.PLANTING || o.type === OperationType.NURSERY).map((o) => o.date).sort()[0];
    const anchorDate = sow ?? campaign.startDate;
    const result = computeRecommendations({
      referenceOperations: window.operations.map((op) => ({ type: op.type, label: op.label?.fr ?? op.type, timingDays: op.timingDays })),
      journalOperations: journal.map((o) => ({ type: o.type, date: o.date })),
      anchorDate,
      today: this.clock.nowIso(),
      sowingStart: window.sowingStart,
      sowingEnd: window.sowingEnd,
    });
    return { hasReference: true, ...result };
  }
}
```

- [ ] **Step 4: Endpoint** — dans `campaign.controller.ts` : importer `GetCampaignRecommendationsUseCase` ; l'ajouter au constructeur :
```ts
    private readonly recoUC: GetCampaignRecommendationsUseCase,
```
et ajouter le handler (après `list`) :
```ts
  @Get(':id/recommendations') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async recommendations(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { return await this.recoUC.execute({ campaignId: id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }
```

- [ ] **Step 5: Module** — dans `suivi.module.ts` : importer `GetCampaignRecommendationsUseCase`, `CROPPING_WINDOW_REPOSITORY` (`./application/window/cropping-window.repository`), `PrismaCroppingWindowRepository` (`./infrastructure/window/prisma-cropping-window.repository`). Ajouter aux `providers` :
```ts
    { provide: CROPPING_WINDOW_REPOSITORY, useClass: PrismaCroppingWindowRepository },
    { provide: GetCampaignRecommendationsUseCase, useFactory: (c, o, w, clk) => new GetCampaignRecommendationsUseCase(c, o, w, clk), inject: [CAMPAIGN_REPOSITORY, OPERATION_LOG_REPOSITORY, CROPPING_WINDOW_REPOSITORY, CLOCK] },
```

- [ ] **Step 6: Vérifier** — Run: `cd apps/api && npx jest get-campaign-recommendations campaign.use-cases && npx tsc --noEmit` → PASS + OK.

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/application/parcel/get-campaign-recommendations.use-case.ts apps/api/src/application/parcel/get-campaign-recommendations.use-case.spec.ts apps/api/src/presentation/parcel/campaign.controller.ts apps/api/src/suivi.module.ts
git commit -m "feat(suivi): GET /campaigns/:id/recommendations (use-case + fenêtre de référence + endpoint)"
```

---

### Task 4: Admin — formulaire campagne (culture + « Autre » + calendrier)

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (type `Campaign`)
- Modify: `apps/admin/src/lib/suivi-actions.ts` (`CampaignPayload`)
- Modify: `apps/admin/src/app/parcelles/[id]/varieties-action.ts` (ajout `fetchCropWindows`)
- Modify: `apps/admin/src/app/parcelles/[id]/CampaignForm.tsx`
- Modify: `apps/admin/src/app/parcelles/[id]/CampaignForm.client.tsx`

**Interfaces:**
- Consumes: `getCropPublished` (fenêtres) ; `createCampaign`/`updateCampaign`.
- Produces: sélecteur culture avec « Autre… » + `customCropName`, sélecteur fenêtre → `windowId`.

- [ ] **Step 1: Types** — dans `apps/admin/src/lib/api.ts`, remplacer l'interface `Campaign` par :
```ts
export interface Campaign { id: string; organizationId: string; parcelId: string; cropId?: string; customCropName?: string; windowId?: string; varietyId?: string; season: string; startDate?: string; status: 'ACTIVE' | 'CLOSED'; notes?: string; createdAt: string; }
```
Dans `apps/admin/src/lib/suivi-actions.ts`, remplacer `CampaignPayload` par :
```ts
export type CampaignPayload = { parcelId?: string; cropId?: string; customCropName?: string; windowId?: string; varietyId?: string; season?: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string };
```

- [ ] **Step 2: Action fenêtres** — dans `apps/admin/src/app/parcelles/[id]/varieties-action.ts`, ajouter (garder `fetchCropVarieties`) :
```ts
import type { CroppingWindow } from '@/lib/api';

export async function fetchCropWindows(cropId: string): Promise<CroppingWindow[]> {
  const crop = await getCropPublished(cropId).catch(() => null);
  return crop?.croppingWindows ?? [];
}
```

- [ ] **Step 3: Formulaire** — remplacer `CampaignForm.tsx` par :
```tsx
'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { CropDocument, Variety, CroppingWindow } from '@/lib/api';

export interface CampaignFormValue { cropId: string; customCropName: string; windowId: string; varietyId: string; season: string; startDate: string; status: 'ACTIVE' | 'CLOSED'; notes: string; }
export const emptyCampaign = (): CampaignFormValue => ({ cropId: '', customCropName: '', windowId: '', varietyId: '', season: '', startDate: '', status: 'ACTIVE', notes: '' });
export const campaignToPayload = (v: CampaignFormValue) => ({
  cropId: v.cropId || undefined, customCropName: v.cropId ? undefined : (v.customCropName || undefined),
  windowId: v.cropId ? (v.windowId || undefined) : undefined, varietyId: v.varietyId || undefined,
  season: v.season, startDate: v.startDate || undefined, status: v.status, notes: v.notes || undefined,
});

const OTHER = '__other__';

export function CampaignFields({ value, onChange, crops, varieties, windows }: {
  value: CampaignFormValue; onChange: (v: CampaignFormValue) => void;
  crops: CropDocument[]; varieties: Variety[]; windows: CroppingWindow[];
}) {
  const set = <K extends keyof CampaignFormValue>(k: K, val: CampaignFormValue[K]) => onChange({ ...value, [k]: val });
  const cropSelectValue = value.cropId || (value.customCropName ? OTHER : '');
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Culture *</Label>
        <Select value={cropSelectValue} onValueChange={(v) => v === OTHER
          ? onChange({ ...value, cropId: '', windowId: '', varietyId: '', customCropName: value.customCropName })
          : onChange({ ...value, cropId: v, windowId: '', varietyId: '', customCropName: '' })}>
          <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
          <SelectContent>{crops.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}<SelectItem value={OTHER}>Autre…</SelectItem></SelectContent>
        </Select>
      </div>
      {cropSelectValue === OTHER && (
        <div className="space-y-1"><Label>Nom de la culture *</Label><Input value={value.customCropName} onChange={(e) => set('customCropName', e.target.value)} placeholder="ex. Fonio" /></div>
      )}
      {value.cropId && (
        <div className="space-y-1">
          <Label>Calendrier de référence</Label>
          <Select value={value.windowId} onValueChange={(v) => set('windowId', v === '__none__' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="— aucun —" /></SelectTrigger>
            <SelectContent><SelectItem value="__none__">— aucun —</SelectItem>{windows.map((w) => <SelectItem key={w.id} value={w.id}>{w.season}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label>Variété</Label>
        <Select value={value.varietyId} onValueChange={(v) => set('varietyId', v === '__none__' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="— aucune —" /></SelectTrigger>
          <SelectContent><SelectItem value="__none__">— aucune —</SelectItem>{varieties.map((vr) => <SelectItem key={vr.id} value={vr.id}>{vr.name.fr ?? vr.id}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Saison *</Label><Input value={value.season} onChange={(e) => set('season', e.target.value)} placeholder="ex. Saison des pluies 2026" required /></div>
      <div className="space-y-1"><Label>Date de début</Label><Input type="date" value={value.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
      <div className="space-y-1">
        <Label>Statut</Label>
        <Select value={value.status} onValueChange={(v) => set('status', v as 'ACTIVE' | 'CLOSED')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ACTIVE">En cours</SelectItem><SelectItem value="CLOSED">Terminée</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
```

- [ ] **Step 4: Wrapper client** — remplacer `CampaignForm.client.tsx` par (charge variétés **et** fenêtres selon la culture) :
```tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createCampaign, updateCampaign } from '@/lib/suivi-actions';
import { fetchCropVarieties } from './varieties-action';
import { fetchCropWindows } from './varieties-action';
import { CampaignFields, emptyCampaign, campaignToPayload, type CampaignFormValue } from './CampaignForm';
import type { CropDocument, Variety, CroppingWindow, Campaign } from '@/lib/api';

export function CampaignEditor({ parcelId, crops, initial, trigger }: {
  parcelId: string; crops: CropDocument[]; initial?: Campaign; trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormValue>(initial
    ? { cropId: initial.cropId ?? '', customCropName: initial.customCropName ?? '', windowId: initial.windowId ?? '', varietyId: initial.varietyId ?? '', season: initial.season, startDate: initial.startDate ?? '', status: initial.status, notes: initial.notes ?? '' }
    : emptyCampaign());
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [windows, setWindows] = useState<CroppingWindow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.cropId) { setVarieties([]); setWindows([]); return; }
    fetchCropVarieties(form.cropId).then(setVarieties).catch(() => setVarieties([]));
    fetchCropWindows(form.cropId).then(setWindows).catch(() => setWindows([]));
  }, [form.cropId]);

  async function submit() {
    setBusy(true); setError(null);
    try {
      if (initial) await updateCampaign(initial.id, campaignToPayload(form));
      else await createCampaign({ parcelId, ...campaignToPayload(form) });
      setOpen(false); if (!initial) setForm(emptyCampaign()); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <CampaignFields value={form} onChange={setForm} crops={crops} varieties={varieties} windows={windows} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>{initial ? 'Enregistrer' : 'Créer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Type-check + commit** — Run: `cd apps/admin && npx tsc --noEmit` → OK.
```bash
git add "apps/admin/src/lib/api.ts" "apps/admin/src/lib/suivi-actions.ts" "apps/admin/src/app/parcelles/[id]/varieties-action.ts" "apps/admin/src/app/parcelles/[id]/CampaignForm.tsx" "apps/admin/src/app/parcelles/[id]/CampaignForm.client.tsx"
git commit -m "feat(admin): campagne — culture + Autre (customCropName) + sélecteur calendrier de référence"
```

---

### Task 5: Admin — panneau recommandations sur la page journal

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (types reco + `getCampaignRecommendations`)
- Modify: `apps/admin/src/lib/labels.ts` (`RECO_STATUS_LABELS`)
- Modify: `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx`

**Interfaces:**
- Consumes: `GET /campaigns/:id/recommendations`.
- Produces: panneau « Recommandations » sur la page journal.

- [ ] **Step 1: Client API + types** — dans `apps/admin/src/lib/api.ts`, ajouter :
```ts
export type RecommendationStatus = 'DONE' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'UNDATED';
export interface RecommendationItem { type: string; label: string; timingDays: number; dueDate?: string; status: RecommendationStatus; }
export interface SowingAdvisory { withinWindow: boolean; sowingStart?: string; sowingEnd?: string; anchorMonth?: string; }
export interface CampaignRecommendations { hasReference: boolean; items: RecommendationItem[]; sowingAdvisory?: SowingAdvisory; }

export async function getCampaignRecommendations(campaignId: string): Promise<CampaignRecommendations> {
  const res = await authFetch(`/campaigns/${campaignId}/recommendations`, { cache: 'no-store' });
  return res.json();
}
```

- [ ] **Step 2: Libellés** — dans `apps/admin/src/lib/labels.ts`, ajouter :
```ts
export const RECO_STATUS_LABELS: Record<string, string> = {
  DONE: 'Fait', OVERDUE: 'En retard', DUE_SOON: 'Bientôt', UPCOMING: 'À venir', UNDATED: 'Non daté',
};
```

- [ ] **Step 3: Panneau sur la page journal** — dans `apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx` :

Étendre les imports :
```ts
import { listCampaigns, listOperations, getCampaignRecommendations } from '@/lib/api';
import { labelOf, OPERATION_TYPE_LABELS, RECO_STATUS_LABELS, MONTH_LABELS } from '@/lib/labels';
```
Ajouter au `Promise.all` le chargement des recommandations :
```ts
  const [campaigns, operations, reco] = await Promise.all([
    listCampaigns(params.id).catch(() => []), listOperations(params.cid).catch(() => []),
    getCampaignRecommendations(params.cid).catch(() => ({ hasReference: false, items: [] as never[] })),
  ]);
```
Juste après le bloc titre (`</div>` fermant le header, avant le rendu des opérations), insérer le panneau :
```tsx
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Recommandations</h2>
        {!reco.hasReference ? (
          <p className="text-sm text-muted-foreground">Reliez un calendrier de référence à la campagne pour activer les recommandations.</p>
        ) : (
          <div className="space-y-2">
            {reco.sowingAdvisory && reco.sowingAdvisory.withinWindow === false && (
              <p className="rounded-md bg-[#fdf0f0] px-3 py-2 text-sm text-[#8a2c2c]">
                ⚠️ Fenêtre de semis recommandée : {labelOf(MONTH_LABELS, reco.sowingAdvisory.sowingStart ?? '')} → {labelOf(MONTH_LABELS, reco.sowingAdvisory.sowingEnd ?? '')} ; vous démarrez en {labelOf(MONTH_LABELS, reco.sowingAdvisory.anchorMonth ?? '')}.
              </p>
            )}
            {reco.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune opération de référence.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {reco.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span>{labelOf(OPERATION_TYPE_LABELS, it.type)}{it.dueDate ? ` · ${new Date(it.dueDate).toLocaleDateString('fr-FR')}` : ''}</span>
                    <span className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-xs text-[#2c5a8a]">{labelOf(RECO_STATUS_LABELS, it.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
```

- [ ] **Step 4: Type-check + commit** — Run: `cd apps/admin && npx tsc --noEmit` → OK.
```bash
git add "apps/admin/src/lib/api.ts" "apps/admin/src/lib/labels.ts" "apps/admin/src/app/parcelles/[id]/campagnes/[cid]/page.tsx"
git commit -m "feat(admin): panneau Recommandations sur la page journal (statuts + avertissement semis)"
```

---

## Vérification finale (après toutes les tâches)

- [ ] `cd apps/api && npx tsc --noEmit` → OK
- [ ] `cd apps/api && npx jest recommendations campaign operation-log get-campaign-recommendations` → tout vert
- [ ] `cd apps/admin && npx tsc --noEmit` → OK
- [ ] **Migration** : `cd apps/api && npx prisma migrate deploy` (DB up) → colonnes `windowId`/`customCropName`, `cropId` nullable.
- [ ] Manuel (compte tenant) : créer une campagne en reliant un **calendrier de référence** → ouvrir le journal → le panneau **Recommandations** affiche les opérations (Fait/En retard/À venir) et, si la date de début est hors saison, l'**avertissement de semis** ; une campagne « Autre » (customCropName) → « Reliez un calendrier… ».

## Notes hors périmètre (rappel)

- Vue admin des cultures « Autre » ; appariement fin des opérations répétées ; fenêtres ravageurs ; notifications ; photos (brique E) ; mobile.
- Le moteur ne persiste rien (recommandations dérivées à la volée).
- **Limite connue (édition)** : basculer une campagne existante d'une vraie culture vers « Autre » (ou l'inverse) ne peut pas *effacer* l'ancien `cropId`/`windowId` via `PATCH` (sémantique `keep` = `undefined` ⇒ inchangé) ; le cas courant (création) est correct. Effacement à l'édition = amélioration ultérieure (convention `null` explicite).
