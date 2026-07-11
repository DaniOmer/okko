# Itinéraire technique / fenêtres de production — D1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la fenêtre de production : timing relatif au semis (J0, J±n), fenêtre de semis en dates (affichée jour-mois), 4 nouveaux types d'opérations, itinéraire trié, et édition d'une fenêtre.

**Architecture :** API d'abord — ajouts d'enum `OperationType` + édition de fenêtre (événement `CroppingWindowUpdated` + use-case + `PUT`, miroir de la variété). Puis admin — refonte du `WindowEditor` (dates, J±, mode édition) et de l'affichage (itinéraire trié par `timingDays` avec repère « J0 · Semis », semis en jour-mois, bouton Modifier). Pas de migration (colonnes `String` inchangées, `operations` en JSON) ni d'upcasting (flux vide).

**Tech Stack :** NestJS, Prisma, Jest (API) ; Next.js 14, TypeScript, shadcn/ui, date-fns (admin).

## Global Constraints

- **⚠️ La suite de tests API efface la DB de dev** (pas de `.env.test`). Prévenir avant `pnpm --filter @okko/api test`. DB + flux d'événements **vides** → pas d'upcasting ; `operations` = JSON, `sowingStart/End` = colonnes `String` → **pas de migration**.
- **Timing** : `timingDays` = jours **relatifs au semis** (J0 = semis), **négatif = avant semis**. Le tri par `timingDays` est fait **à l'affichage** (page/read-view), **pas** dans l'éditeur (l'édition des lignes se fait par index — les trier casserait la saisie) ni au stockage.
- **Fenêtre de semis** : `sowingStart`/`sowingEnd` en `yyyy-MM-dd` (DatePicker natif), **affichés jour-mois** (année ignorée).
- **4 nouveaux `OperationType`** : `SEED_TREATMENT` (Traitement de semences), `TRANSPLANTING` (Repiquage / transplantation), `THINNING` (Démariage / éclaircissage), `EARTHING_UP` (Buttage / billonnage).
- **Ajout de fenêtre inchangé** ; **édition** = nouveau. Validation zone existante en ajout **et** édition.
- **API** : barrière = `pnpm --filter @okko/api test` vert. **Admin** : `pnpm --filter @okko/admin build` vert + smoke.
- Commits `feat(api):` / `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 (API) :** `apps/api/src/domain/window/operation-type.ts` ; `apps/api/src/domain/crop/crop-event.ts`, `crop.ts` ; `apps/api/src/application/window/update-cropping-window.use-case.ts` (nouveau, + spec) ; `apps/api/src/presentation/crop/crop.controller.ts` ; `apps/api/src/crop.module.ts` ; un e2e (`window.e2e-spec.ts`).
**Task 2 (admin éditeur) :** `apps/admin/src/lib/labels.ts` ; `apps/admin/src/lib/api.ts` ; `apps/admin/src/lib/format.ts` ; `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`.
**Task 3 (admin affichage) :** `apps/admin/src/app/crops/[id]/page.tsx` ; `apps/admin/src/app/crops/[id]/CropReadView.tsx`.

---

## Task 1 : API — types d'opérations + édition de fenêtre

**Files:** (voir File Structure, Task 1)

**Interfaces:**
- Produces : `OperationType` +4 valeurs ; `Crop.updateCroppingWindow(w)` ; `UpdateCroppingWindowUseCase.execute({ cropId, windowId, zoneId, season, sowingStart?, sowingEnd?, irrigationRequired?, operations?, notes?, actor })` ; `CroppingWindowNotFoundError` ; `PUT /crops/:id/windows/:windowId`.

- [ ] **Step 1 : `OperationType`** — dans `apps/api/src/domain/window/operation-type.ts`, ajouter (ordre agronomique) :
```ts
export enum OperationType {
  CLEARING = 'CLEARING',
  SEED_TREATMENT = 'SEED_TREATMENT',
  NURSERY = 'NURSERY',
  TRANSPLANTING = 'TRANSPLANTING',
  PLANTING = 'PLANTING',
  FERTILIZATION = 'FERTILIZATION',
  WEEDING = 'WEEDING',
  THINNING = 'THINNING',
  EARTHING_UP = 'EARTHING_UP',
  PEST_CONTROL = 'PEST_CONTROL',
  HARVEST = 'HARVEST',
  OTHER = 'OTHER',
}
```

- [ ] **Step 2 : Écrire le test update use-case (échoue)** — `apps/api/src/application/window/update-cropping-window.use-case.spec.ts`. S'inspirer de `add-cropping-window.use-case.spec.ts` pour le câblage in-memory (event store, zone repo, window repo, audit, clock, ids pour l'ajout ; l'update n'a pas d'ids). Cas :
```ts
// créer crop + zone + AddCroppingWindow (id 'w1', season 'Saison des pluies')
// UpdateCroppingWindow.execute({ cropId, windowId:'w1', zoneId, season:'Saison sèche', sowingStart:'2026-06-15', operations:[{type:'PLANTING',label:{fr:'Semis'},timingDays:0,inputs:[]}], actor:'a' })
// => windowRepo.listByCrop(crop).length===1 ; [0].id==='w1' ; [0].season==='Saison sèche'
it('met à jour une fenêtre par id', async () => { /* … */ });
it('lève CroppingWindowNotFoundError si l\'id est absent', async () => { /* update 'absent' */ });
it('lève ZoneNotFoundError si la zone est absente', async () => { /* update avec zoneId inconnu */ });
```

- [ ] **Step 3 : Run → échoue.** Run: `pnpm --filter @okko/api test -- update-cropping-window.use-case` — Expected: FAIL (module absent).

- [ ] **Step 4 : Événement + domaine** — `crop-event.ts` : ajouter `| { type: 'CroppingWindowUpdated'; window: CroppingWindowSnapshot }` (après `CroppingWindowAdded`). `crop.ts` : méthode près de `addCroppingWindow` (l. 166) :
```ts
  updateCroppingWindow(w: CroppingWindowSnapshot): void { this.raise({ type: 'CroppingWindowUpdated', window: w }); }
```
et le cas d'`apply` (près l. 191) :
```ts
      case 'CroppingWindowUpdated': this._windows = this._windows.map((x) => (x.id === e.window.id ? e.window : x)); this._hasUnpublishedChanges = true; break;
```

- [ ] **Step 5 : Use-case** — créer `apps/api/src/application/window/update-cropping-window.use-case.ts`, miroir de `add-cropping-window.use-case.ts` (mêmes dépendances **sans** `IdGenerator`) :
```ts
import { CroppingWindow, CroppingWindowSnapshot } from '../../domain/window/cropping-window';
import { TechnicalOperation, TechnicalOperationJSON } from '../../domain/window/technical-operation';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { ZoneRepository } from '../zone/zone.repository';
import { CroppingWindowRepository } from './cropping-window.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';

export class CroppingWindowNotFoundError extends Error {
  constructor(id: string) { super(`Cropping window not found: ${id}`); this.name = 'CroppingWindowNotFoundError'; }
}

export interface UpdateCroppingWindowInput {
  cropId: string; windowId: string; zoneId: string; season: string;
  sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean;
  operations?: TechnicalOperationJSON[]; notes?: string; actor: string;
}

export class UpdateCroppingWindowUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly zones: ZoneRepository,
    private readonly windows: CroppingWindowRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateCroppingWindowInput): Promise<CroppingWindowSnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    const crop = Crop.fromEvents(stored);
    if (!crop.windows.some((w) => w.id === input.windowId)) throw new CroppingWindowNotFoundError(input.windowId);
    const window = CroppingWindow.create({
      id: input.windowId, cropId: input.cropId, zoneId: input.zoneId, season: input.season,
      sowingStart: input.sowingStart, sowingEnd: input.sowingEnd,
      irrigationRequired: input.irrigationRequired,
      operations: (input.operations ?? []).map((j) => TechnicalOperation.fromJSON(j)),
      notes: input.notes,
    });
    const snap = window.toSnapshot();
    crop.updateCroppingWindow(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.windows.save(snap); // upsert par id
    await this.audit.record({ entityType: 'CroppingWindow', entityId: input.windowId, actor: input.actor, at, changes: { updated: snap } });
    return snap;
  }
}
```

- [ ] **Step 6 : Run le test use-case → passe.** Run: `pnpm --filter @okko/api test -- update-cropping-window.use-case` — Expected: PASS.

- [ ] **Step 7 : Endpoint + mapping + module** — `crop.controller.ts` : importer `UpdateCroppingWindowUseCase, CroppingWindowNotFoundError` ; injecter `updateWindowUC` ; handler près des routes fenêtre :
```ts
  @Put(':id/windows/:windowId')
  async updateWindow(
    @Param('id') id: string,
    @Param('windowId') windowId: string,
    @Body() body: { zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean; operations?: TechnicalOperationJSON[]; notes?: string },
  ) {
    try { return await this.updateWindowUC.execute({ cropId: id, windowId, ...body, actor: ACTOR }); }
    catch (e) { mapCropError(e, id); }
  }
```
Dans `mapCropError`, ajouter : `if (e instanceof CroppingWindowNotFoundError) throw new NotFoundException((e as Error).message);` (`ZoneNotFoundError`/`CropNotFoundError` déjà mappés dans les handlers fenêtre — vérifier que `mapCropError` gère `ZoneNotFoundError`, sinon garder le mapping local du handler existant pour la zone). Dans `crop.module.ts`, provider miroir de `AddCroppingWindowUseCase` **sans** `UuidIdGenerator` : `inject: [CROP_EVENT_STORE, ZONE_REPOSITORY, CROPPING_WINDOW_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK]`.

- [ ] **Step 8 : e2e** — dans `apps/api/test/window.e2e-spec.ts` : créer crop + zone → `POST /crops/:id/windows` (récupérer l'id via `GET /crops/:id`) → `PUT /crops/:id/windows/:wid` (nouvelle saison + opérations) → `GET` reflète, count inchangé ; `PUT` windowId absent → 404.

- [ ] **Step 9 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert (les nouveaux `OperationType` n'invalident pas les envois existants).

- [ ] **Step 10 : Commit**
```bash
git add apps/api/src/domain/window/operation-type.ts apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.ts apps/api/src/application/window/update-cropping-window.use-case.ts apps/api/src/application/window/update-cropping-window.use-case.spec.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/window.e2e-spec.ts
git commit -m "feat(api): types d'opérations + édition de fenêtre (CroppingWindowUpdated + PUT)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Admin — `WindowEditor` (dates, J±, mode édition)

**Files:**
- Modify: `apps/admin/src/lib/labels.ts`
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/format.ts`
- Modify: `apps/admin/src/app/crops/[id]/editors/WindowEditor.tsx`

**Interfaces:**
- Consumes : API (Task 1). Produces : `updateWindow(...)` ; `formatDayMonth(iso)` ; `WindowEditor` accepte `initial?`.

- [ ] **Step 1 : `labels.ts`** — dans `OPERATION_TYPE_LABELS`, ajouter (aux bonnes positions) : `SEED_TREATMENT: 'Traitement de semences'`, `TRANSPLANTING: 'Repiquage / transplantation'`, `THINNING: 'Démariage / éclaircissage'`, `EARTHING_UP: 'Buttage / billonnage'`.

- [ ] **Step 2 : `format.ts`** — ajouter :
```ts
export function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  return isValid(d) ? format(d, 'd MMM', { locale: fr }) : iso;
}
```

- [ ] **Step 3 : `lib/api.ts`** — ajouter `updateWindow` (corps identique à `addWindow`) :
```ts
export function updateWindow(cropId: string, windowId: string, body: {
  zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean;
  operations?: { type: string; label: Record<string, string>; timingDays: number; inputs: string[]; notes?: string }[]; notes?: string;
}): Promise<unknown> {
  return mutate(`/crops/${cropId}/windows/${windowId}`, 'PUT', body);
}
```
(utiliser le helper `mutate` comme `addWindow`/`setZoneSuitability`.)

- [ ] **Step 4 : `WindowEditor.tsx`** — remplacer tout le fichier par la version ci-dessous (DatePicker pour le semis, `J±` avec négatifs, suppression de ligne d'opération, mode édition) :
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { OPERATION_TYPE_LABELS, SEASONS } from '@/lib/labels';
import { addWindow, updateWindow } from '../../../../lib/api';
import type { CroppingWindow } from '../../../../lib/api';

interface Op { type: string; label: string; timingDays: string; }

export function WindowEditor({ cropId, zones, initial }: { cropId: string; zones: { id: string; name: string }[]; initial?: CroppingWindow }) {
  const editing = !!initial;
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? '');
  const [season, setSeason] = useState(initial?.season ?? '');
  const [sowingStart, setSowingStart] = useState(initial?.sowingStart ?? '');
  const [sowingEnd, setSowingEnd] = useState(initial?.sowingEnd ?? '');
  const [irrigation, setIrrigation] = useState(initial?.irrigationRequired ?? false);
  const [ops, setOps] = useState<Op[]>(initial ? initial.operations.map((o) => ({ type: o.type, label: o.label.fr ?? '', timingDays: String(o.timingDays) })) : []);

  if (zones.length === 0 && !editing) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour ajouter une fenêtre.</p>;
  }

  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter une fenêtre de production'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!zoneId || !season) return;
            const body = {
              zoneId, season, sowingStart: sowingStart || undefined, sowingEnd: sowingEnd || undefined,
              irrigationRequired: irrigation,
              operations: ops.map((o) => ({ type: o.type, label: { fr: o.label }, timingDays: Number(o.timingDays), inputs: [] })),
            };
            submit(async () => {
              if (editing) {
                await updateWindow(cropId, initial!.id, body);
              } else {
                await addWindow(cropId, body);
                setZoneId(''); setSeason(''); setSowingStart(''); setSowingEnd(''); setIrrigation(false); setOps([]);
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Zone *</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger><SelectValue placeholder="— Choisir une zone —" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Saison *</Label>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger><SelectValue placeholder="— Choisir une saison —" /></SelectTrigger>
              <SelectContent>
                {SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fenêtre de semis (début / fin)</Label>
            <div className="flex gap-1">
              <DatePicker value={sowingStart} onChange={setSowingStart} />
              <DatePicker value={sowingEnd} onChange={setSowingEnd} />
            </div>
          </div>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={irrigation} onChange={(e) => setIrrigation(e.target.checked)} /> Irrigation requise</label>

          <div className="border-t pt-2">
            <p className="font-medium">Itinéraire technique ({ops.length} opérations)</p>
            <p className="text-xs text-muted-foreground">J0 = semis ; négatif = avant le semis (ex. -15).</p>
            {ops.map((o, i) => (
              <div key={i} className="flex gap-1 my-1 items-center">
                <Select value={o.type} onValueChange={(val) => setOps(ops.map((x, j) => j === i ? { ...x, type: val } : x))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATION_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="flex-1" placeholder="libellé" value={o.label} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input className="w-16" placeholder="J±" value={o.timingDays} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, timingDays: e.target.value } : x))} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setOps(ops.filter((_, j) => j !== i))}>×</Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOps([...ops, { type: 'PLANTING', label: '', timingDays: '0' }])}>+ opération</Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```
> Notes : les lignes d'opération restent en **ordre de saisie** dans l'éditeur (le tri est fait à l'affichage — Task 3), pour ne pas casser l'édition par index. La saisie `J±` accepte les négatifs (`Number('-15')`). Ajout d'un « × » pour retirer une opération (utile en édition).

- [ ] **Step 5 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/lib/labels.ts apps/admin/src/lib/api.ts apps/admin/src/lib/format.ts apps/admin/src/app/crops/\[id\]/editors/WindowEditor.tsx
git commit -m "feat(admin): éditeur de fenêtre — dates de semis, J± depuis le semis, mode édition

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Admin — affichage de l'itinéraire (trié, J0, jour-mois, Modifier)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/CropReadView.tsx`

**Interfaces:**
- Consumes : `WindowEditor` (mode édition, Task 2), `formatDayMonth` (Task 2), `OPERATION_TYPE_LABELS`.

- [ ] **Step 1 : `page.tsx` — Card Fenêtres** — importer `formatDayMonth` (depuis `../../../lib/format`). Remplacer le rendu de chaque fenêtre par : en-tête (saison + fenêtre de semis jour-mois + irrigation + bouton **Modifier**), puis l'itinéraire **trié par `timingDays`** avec un repère **« J0 · Semis »** inséré à sa place. L'éditeur d'ajout reste dans l'en-tête de la Card.
```tsx
{crop.croppingWindows.map((w) => {
  const sorted = [...w.operations].sort((a, b) => a.timingDays - b.timingDays);
  const items = [...sorted, { type: '__SOWING__', label: { fr: '' }, timingDays: 0, inputs: [] }].sort((a, b) => a.timingDays - b.timingDays);
  return (
    <div key={w.id} className="mb-3">
      <div className="flex items-center gap-2">
        <p className="font-medium">
          {w.season}
          {w.sowingStart ? ` · semis ${formatDayMonth(w.sowingStart)}${w.sowingEnd ? ` → ${formatDayMonth(w.sowingEnd)}` : ''}` : ''}
          {w.irrigationRequired ? ' · irrigation requise' : ''}
        </p>
        <WindowEditor cropId={params.id} zones={zones} initial={w} />
      </div>
      <ul className="list-disc pl-5">
        {items.map((op, i) => op.type === '__SOWING__'
          ? <li key={`s${i}`} className="font-medium">J0 · Semis</li>
          : <li key={i}>J{op.timingDays >= 0 ? '+' : ''}{op.timingDays} — {op.label.fr} ({labelOf(OPERATION_TYPE_LABELS, op.type)})</li>)}
      </ul>
    </div>
  );
})}
```
> Le repère « J0 · Semis » est fusionné dans la liste triée (tri stable → à J0, il apparaît parmi les opérations à J0). L'en-tête de la Card garde `<WindowEditor cropId={params.id} zones={zones} />` (ajout).

- [ ] **Step 2 : `CropReadView.tsx`** — même rendu (sans le bouton Modifier ni l'éditeur — c'est la vue lecture). Importer `formatDayMonth`. Remplacer le rendu des fenêtres par la version triée + repère J0 + semis jour-mois :
```tsx
{crop.croppingWindows.map((w) => {
  const items = [...w.operations, { type: '__SOWING__', label: { fr: '' }, timingDays: 0, inputs: [] }].sort((a, b) => a.timingDays - b.timingDays);
  return (
    <div key={w.id} className="mb-3">
      <p className="font-medium">{w.season}{w.sowingStart ? ` · semis ${formatDayMonth(w.sowingStart)}${w.sowingEnd ? ` → ${formatDayMonth(w.sowingEnd)}` : ''}` : ''}{w.irrigationRequired ? ' · irrigation requise' : ''}</p>
      <ul className="list-disc pl-5">
        {items.map((op, i) => op.type === '__SOWING__'
          ? <li key={`s${i}`} className="font-medium">J0 · Semis</li>
          : <li key={i}>J{op.timingDays >= 0 ? '+' : ''}{op.timingDays} — {op.label.fr} ({labelOf(OPERATION_TYPE_LABELS, op.type)})</li>)}
      </ul>
    </div>
  );
})}
```
> Vérifier que `CropReadView` importe déjà `OPERATION_TYPE_LABELS` et `labelOf` (sinon les ajouter).

- [ ] **Step 3 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 4 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Ajouter une fenêtre avec fenêtre de semis (dates), une opération avant semis (ex. Défrichage J-30) et après (Sarclage J+21), des nouveaux types (Repiquage…) → l'itinéraire s'affiche **trié** avec « J0 · Semis » à sa place, le semis en jour-mois ; « Modifier » une fenêtre pré-remplit tout et enregistre.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/app/crops/\[id\]/page.tsx apps/admin/src/app/crops/\[id\]/CropReadView.tsx
git commit -m "feat(admin): itinéraire trié (J0 · Semis), fenêtre de semis jour-mois, Modifier par fenêtre

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **API** : `OperationType` +4 valeurs ; `CroppingWindowUpdated` + `UpdateCroppingWindowUseCase` + `PUT /crops/:id/windows/:windowId` (404 si absent, 404 si zone absente) ; ajout inchangé. Suite verte.
- **Admin** : fenêtre de semis en `DatePicker`, affichée jour-mois ; opérations `J±` (négatif = avant semis) ; suppression de ligne ; mode édition ; itinéraire **trié** avec repère « J0 · Semis » ; bouton Modifier par fenêtre.
- Pas de migration (JSON / String) ; pas d'upcasting (flux vide) ; build admin vert.

## Self-review (couverture spec)

- §4.1 OperationType → Task 1 Step 1. §4.3 édition (événement, use-case, endpoint, module) → Task 1 Steps 4-7. §4.4 tests → Task 1 Steps 2,8. ✅
- §5.1 labels → Task 2 Step 1. §5.2 api updateWindow → Step 3. §5.3 éditeur (dates, J±, tri-à-l'affichage, mode édition) → Step 4. ✅
- §5.4 affichage (semis jour-mois, itinéraire trié, J0, Modifier) → Task 3. ✅
- §2/§3 timing sémantique (J±, tri à l'affichage) → Task 2 (négatifs) + Task 3 (tri). ✅
- §3 hors périmètre (inputs par op, migration) → Global Constraints + Notes. ✅
- ⚠️ DB wipe rappelé → Global Constraints + steps. ✅
