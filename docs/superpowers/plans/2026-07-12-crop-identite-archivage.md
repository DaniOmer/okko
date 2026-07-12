# Édition de l'identité & archivage de culture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éditer l'identité d'une culture (nom, nom scientifique, famille, type de cycle) et archiver/désarchiver une culture (retrait réversible), côté API et admin.

**Architecture :** API d'abord (TDD). Task 1 : identité éditable (événement `IdentityEdited` + `editIdentity` + `UpdateCropUseCase`/`PATCH` étendus). Task 2 : archivage (assouplir la machine à états, `unarchive()`, use-cases + endpoints). Puis admin — Task 3 : éditeur d'identité ; Task 4 : boutons Archiver/Désarchiver + liste masquant les archivées. Pas de migration (colonnes existantes), pas d'upcasting (flux vide).

**Tech Stack :** NestJS, Jest (API) ; Next.js 14, TypeScript, shadcn/ui (admin).

## Global Constraints

- **⚠️ La suite de tests API efface la DB de dev** (pas de `.env.test`). Prévenir avant `pnpm --filter @okko/api test`. DB + flux **vides** → pas d'upcasting ; colonnes `scientificName/family/cycleType` existent → **pas de migration**.
- **Archivage réversible seulement** (pas de suppression dure) ; archivable depuis **DRAFT et PUBLISHED** ; `unarchive` → DRAFT. Versions publiées figées **conservées**.
- **Transitions illégales** → `CropStatusError` → **409** (déjà mappé par `mapCropError`).
- **`rename`/`metadata` et le reste de `UpdateCropUseCase` : inchangés** (on ajoute des champs optionnels).
- **API** : barrière = `pnpm --filter @okko/api test` vert. **Admin** : `pnpm --filter @okko/admin build` vert + smoke.
- Commits `feat(api):` / `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 :** `apps/api/src/domain/crop/crop-event.ts`, `crop.ts` ; `apps/api/src/application/crop/update-crop.use-case.ts` (+ spec) ; `apps/api/src/presentation/crop/crop.controller.ts` ; e2e.
**Task 2 :** `apps/api/src/domain/crop/crop-status.ts`, `crop-event.ts`, `crop.ts` ; `apps/api/src/application/crop/{archive-crop,unarchive-crop}.use-case.ts` (+ specs) ; `crop.controller.ts` ; `crop.module.ts` ; e2e.
**Task 3 :** `apps/admin/src/lib/api.ts` ; `apps/admin/src/app/crops/[id]/editors/IdentityEditor.tsx` (nouveau) ; `apps/admin/src/app/crops/[id]/page.tsx`.
**Task 4 :** `apps/admin/src/lib/api.ts` ; `apps/admin/src/app/crops/[id]/editors/ArchiveButton.tsx` (nouveau, client) ; `apps/admin/src/app/crops/[id]/page.tsx` ; `apps/admin/src/app/crops/page.tsx` ; `apps/admin/src/app/crops/UnarchiveButton.tsx` (nouveau, client).

---

## Task 1 : API — identité éditable

**Files:** (voir File Structure, Task 1)

**Interfaces:**
- Produces : `Crop.editIdentity({ scientificName, family, cycleType })` ; `UpdateCropUseCase` accepte `scientificName?/family?/cycleType?`.

- [ ] **Step 1 : Écrire le test (échoue)** — dans `apps/api/src/application/crop/update-crop.use-case.spec.ts` (créer si absent ; sinon étendre) : créer une culture puis `UpdateCropUseCase.execute({ id, scientificName: 'Zea mays L.', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor })` → le snapshot porte les nouvelles valeurs ; `hasUnpublishedChanges === true`. S'inspirer d'un spec use-case existant pour le câblage in-memory (event store, crop repo, audit, clock) + `CreateCropUseCase`.

- [ ] **Step 2 : Run → échoue.** Run: `pnpm --filter @okko/api test -- update-crop.use-case` — Expected: FAIL.

- [ ] **Step 3 : Événement + domaine** — `crop-event.ts` : ajouter `| { type: 'IdentityEdited'; scientificName: string; family: string; cycleType: CycleType }` (après `Renamed`). `crop.ts` :
  - Rendre les champs mutables : dans le constructeur, `private readonly _scientificName` → `private _scientificName` ; idem `_family`, `_cycleType`.
  - Méthode (près de `rename`, l. 151) : `editIdentity(p: { scientificName: string; family: string; cycleType: CycleType }): void { this.raise({ type: 'IdentityEdited', scientificName: p.scientificName, family: p.family, cycleType: p.cycleType }); }`.
  - `apply` (près de `Renamed`, l. 183) : `case 'IdentityEdited': this._scientificName = e.scientificName; this._family = e.family; this._cycleType = e.cycleType; this._version += 1; this._hasUnpublishedChanges = true; break;`.

- [ ] **Step 4 : `UpdateCropUseCase`** — `UpdateCropInput` gagne `scientificName?: string; family?: string; cycleType?: CycleType` (importer `CycleType`). Dans `execute`, après le bloc `metadata` :
```ts
    if (input.scientificName !== undefined || input.family !== undefined || input.cycleType !== undefined) {
      crop.editIdentity({
        scientificName: input.scientificName ?? before.scientificName,
        family: input.family ?? before.family,
        cycleType: (input.cycleType ?? before.cycleType) as CycleType,
      });
    }
```
et dans `changes`, ajouter : `if (input.scientificName !== undefined || input.family !== undefined || input.cycleType !== undefined) changes.identity = { from: { scientificName: before.scientificName, family: before.family, cycleType: before.cycleType }, to: { scientificName: next.scientificName, family: next.family, cycleType: next.cycleType } };`.

- [ ] **Step 5 : Run le test → passe.** Run: `pnpm --filter @okko/api test -- update-crop.use-case` — Expected: PASS.

- [ ] **Step 6 : Endpoint** — `crop.controller.ts`, `@Patch(':id')` : le `@Body()` accepte en plus `scientificName?: string; family?: string; cycleType?: CycleType` (le spread `...body` les passe déjà à `updateCrop.execute` si le type du body est élargi — vérifier que le handler fait bien `execute({ id, actor: ACTOR, ...body })`).

- [ ] **Step 7 : e2e** — dans un e2e crop existant (`crop.e2e-spec.ts`) : créer une culture → `PATCH /crops/:id` `{ family: 'Fabaceae', cycleType: 'PERENNIAL' }` (ou une valeur valide de `CycleType`) → `GET /crops/:id` montre la famille/cycle mis à jour.

- [ ] **Step 8 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert.

- [ ] **Step 9 : Commit**
```bash
git add apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.ts apps/api/src/application/crop/update-crop.use-case.ts apps/api/src/application/crop/update-crop.use-case.spec.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/test/crop.e2e-spec.ts
git commit -m "feat(api): édition de l'identité (IdentityEdited, PATCH étendu scientificName/family/cycleType)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : API — archivage réversible

**Files:** (voir File Structure, Task 2)

**Interfaces:**
- Produces : `Crop.unarchive()` ; `ArchiveCropUseCase`/`UnarchiveCropUseCase.execute({ id, actor })` ; `POST /crops/:id/archive`, `/unarchive`.

- [ ] **Step 1 : Écrire les tests (échouent)** — `archive-crop.use-case.spec.ts` : créer une culture (DRAFT) → `ArchiveCropUseCase.execute` → statut `ARCHIVED` ; `UnarchiveCropUseCase.execute` → `DRAFT` ; archiver une **publiée** → ARCHIVED ; archiver une **déjà archivée** → `CropStatusError`. Câblage in-memory (event store, crop repo, audit, clock) + `CreateCropUseCase`/`PublishCropUseCase` selon le cas.

- [ ] **Step 2 : Run → échoue.** Run: `pnpm --filter @okko/api test -- archive-crop` — Expected: FAIL.

- [ ] **Step 3 : Machine à états** — `crop-status.ts` : `[CropStatus.DRAFT]: [CropStatus.PUBLISHED]` → `[CropStatus.DRAFT]: [CropStatus.PUBLISHED, CropStatus.ARCHIVED]`.

- [ ] **Step 4 : Domaine `unarchive` + événement** — `crop-event.ts` : ajouter `| { type: 'Unarchived' }` (après `Archived`). `crop.ts` : `unarchive(): void { assertCanTransition(this._status, CropStatus.DRAFT); this.raise({ type: 'Unarchived' }); }` (près de `archive`, l. 154) ; `apply` : `case 'Unarchived': this._status = CropStatus.DRAFT; break;` (près de `Archived`, l. 188).

- [ ] **Step 5 : Use-cases** — créer `archive-crop.use-case.ts` (miroir léger de `UpdateCropUseCase`, deps : events, crops, audit, clock) :
```ts
import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropEventStore } from './crop-event-store';
import { CropNotFoundError } from './publish-crop.use-case';

export class ArchiveCropUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: { id: string; actor: string }): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    crop.archive();
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { status: 'ARCHIVED' } });
    return next;
  }
}
```
et `unarchive-crop.use-case.ts` identique en remplaçant `crop.archive()` par `crop.unarchive()`, la classe par `UnarchiveCropUseCase`, et l'audit par `{ status: 'DRAFT' }`.

- [ ] **Step 6 : Run les tests → passent.** Run: `pnpm --filter @okko/api test -- archive-crop -- unarchive-crop` — Expected: PASS.

- [ ] **Step 7 : Endpoints + module** — `crop.controller.ts` : importer et injecter `ArchiveCropUseCase`/`UnarchiveCropUseCase` ; handlers :
```ts
  @Post(':id/archive')
  async archive(@Param('id') id: string) {
    try { return toCropDocument(await this.archiveCrop.execute({ id, actor: ACTOR })); }
    catch (e) { mapCropError(e, id); }
  }
  @Post(':id/unarchive')
  async unarchive(@Param('id') id: string) {
    try { return toCropDocument(await this.unarchiveCrop.execute({ id, actor: ACTOR })); }
    catch (e) { mapCropError(e, id); }
  }
```
`crop.module.ts` : deux providers miroir de `UpdateCropUseCase` (`inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK]`).

- [ ] **Step 8 : e2e** — créer une culture → `POST /crops/:id/archive` → `GET` status `ARCHIVED` ; `POST /crops/:id/unarchive` → `DRAFT` ; re-`POST /archive` après unarchive → OK ; `POST /unarchive` sur une non-archivée → **409**.

- [ ] **Step 9 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert.

- [ ] **Step 10 : Commit**
```bash
git add apps/api/src/domain/crop/crop-status.ts apps/api/src/domain/crop/crop-event.ts apps/api/src/domain/crop/crop.ts apps/api/src/application/crop/archive-crop.use-case.ts apps/api/src/application/crop/unarchive-crop.use-case.ts apps/api/src/application/crop/archive-crop.use-case.spec.ts apps/api/src/application/crop/unarchive-crop.use-case.spec.ts apps/api/src/presentation/crop/crop.controller.ts apps/api/src/crop.module.ts apps/api/test/
git commit -m "feat(api): archivage réversible d'une culture (archive/unarchive + endpoints)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Admin — éditeur d'identité

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/app/crops/[id]/editors/IdentityEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Produces : `updateCrop(id, body)` ; `IdentityEditor` (client).

- [ ] **Step 1 : `lib/api.ts`** — ajouter (ou étendre si présente) `updateCrop` :
```ts
export function updateCrop(id: string, body: { commonNames?: Record<string, string>; scientificName?: string; family?: string; cycleType?: string }): Promise<unknown> {
  return mutate(`/crops/${id}`, 'PATCH', body);
}
```
(vérifier qu'une fonction `updateCrop` n'existe pas déjà ; sinon l'étendre.)

- [ ] **Step 2 : `IdentityEditor.tsx`** — `apps/admin/src/app/crops/[id]/editors/IdentityEditor.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CYCLE_TYPE_LABELS } from '@/lib/labels';
import { updateCrop } from '../../../../lib/api';

export function IdentityEditor({ cropId, initial }: { cropId: string; initial: { name: string; scientificName: string; family: string; cycleType: string } }) {
  const [name, setName] = useState(initial.name);
  const [scientificName, setSci] = useState(initial.scientificName);
  const [family, setFamily] = useState(initial.family);
  const [cycleType, setCycle] = useState(initial.cycleType);
  return (
    <EditorShell label="Modifier l'identité">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(() => updateCrop(cropId, { commonNames: { fr: name }, scientificName, family, cycleType })); }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1"><Label htmlFor="id-name">Nom (fr)</Label><Input id="id-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1"><Label htmlFor="id-sci">Nom scientifique</Label><Input id="id-sci" value={scientificName} onChange={(e) => setSci(e.target.value)} required /></div>
          <div className="space-y-1"><Label htmlFor="id-fam">Famille</Label><Input id="id-fam" value={family} onChange={(e) => setFamily(e.target.value)} required /></div>
          <div className="space-y-1">
            <Label>Type de cycle</Label>
            <Select value={cycleType} onValueChange={setCycle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CYCLE_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Enregistrer</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 3 : `page.tsx` — placer l'éditeur** — dans l'en-tête de `crops/[id]/page.tsx` (près du `<h1>` nom + scientifique), ajouter `<IdentityEditor cropId={params.id} initial={{ name: crop.name, scientificName: crop.scientificName, family: crop.family, cycleType: crop.cycleType }} />` (importer `IdentityEditor`).

- [ ] **Step 4 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/IdentityEditor.tsx apps/admin/src/app/crops/\[id\]/page.tsx
git commit -m "feat(admin): éditeur d'identité de la culture

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : Admin — archivage (boutons + liste)

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/app/crops/[id]/editors/ArchiveButton.tsx` (client)
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`
- Create: `apps/admin/src/app/crops/UnarchiveButton.tsx` (client)
- Modify: `apps/admin/src/app/crops/page.tsx`

**Interfaces:**
- Produces : `archiveCrop(id)`, `unarchiveCrop(id)` ; `ArchiveButton`, `UnarchiveButton`.

- [ ] **Step 1 : `lib/api.ts`** — ajouter :
```ts
export function archiveCrop(id: string): Promise<unknown> { return mutate(`/crops/${id}/archive`, 'POST', {}); }
export function unarchiveCrop(id: string): Promise<unknown> { return mutate(`/crops/${id}/unarchive`, 'POST', {}); }
```
(si `mutate` n'accepte pas un corps vide, adapter à la signature réelle de `mutate`.)

- [ ] **Step 2 : `ArchiveButton.tsx`** — `apps/admin/src/app/crops/[id]/editors/ArchiveButton.tsx` : composant client. Si `archived` faux → un `EditorShell` label « Archiver » avec confirmation (« Archiver cette culture ? Elle sera retirée de la liste. ») → `submit(() => archiveCrop(cropId))` puis, comme l'archivage retire de la liste, `useRouter().push('/crops')` après succès (utiliser le patron `submit` de `EditorShell` + un `router.push` dans le `onClick` de confirmation, ou après `submit`). Si `archived` vrai → un bouton « Désarchiver » → `submit(() => unarchiveCrop(cropId))` (EditorShell rafraîchit). Props `{ cropId: string; archived: boolean }`.
> S'inspirer de `PublishDialog`/`RestoreButton` pour le patron EditorShell + navigation post-action.

- [ ] **Step 3 : `page.tsx` — bouton + bandeau archivé** — dans l'en-tête de `crops/[id]/page.tsx` : rendre `<ArchiveButton cropId={params.id} archived={crop.status === 'ARCHIVED'} />`. Si `crop.status === 'ARCHIVED'`, afficher un bandeau « Culture archivée » (ex. `<div className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm">Culture archivée — désarchiver pour la modifier.</div>`).

- [ ] **Step 4 : `UnarchiveButton.tsx`** — `apps/admin/src/app/crops/UnarchiveButton.tsx` : petit composant client `{ cropId }` — un bouton « Désarchiver » qui `await unarchiveCrop(cropId); router.refresh();` (patron de `PestRowActions`). Utilisé dans la vue « Archivées » de la liste.

- [ ] **Step 5 : `crops/page.tsx` — masquer/afficher les archivées** — `searchParams` gagne `archived?: string`. Logique :
```tsx
const showArchived = searchParams.archived === '1';
const archivedCount = all.filter((c) => c.status === 'ARCHIVED').length;
const base = showArchived ? all.filter((c) => c.status === 'ARCHIVED') : all.filter((c) => c.status !== 'ARCHIVED');
const crops = q ? base.filter((c) => c.name.toLowerCase().includes(q) || c.scientificName.toLowerCase().includes(q)) : base;
```
  - En-tête : si `!showArchived` et `archivedCount > 0`, un lien `<Link href="/crops?archived=1">Archivées ({archivedCount})</Link>` ; si `showArchived`, un titre « Cultures archivées » + lien retour `<Link href="/crops">← Cultures actives</Link>`.
  - Dans la vue archivée, ajouter une cellule d'action par ligne avec `<UnarchiveButton cropId={c.id} />` (importer le composant client).

- [ ] **Step 6 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 7 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Modifier l'identité (famille/cycle) → reflété. Archiver une culture → disparaît de `/crops`, apparaît dans « Archivées », bandeau sur la fiche ; Désarchiver → revient active (brouillon).

- [ ] **Step 8 : Commit**
```bash
git add apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/ArchiveButton.tsx apps/admin/src/app/crops/\[id\]/page.tsx apps/admin/src/app/crops/UnarchiveButton.tsx apps/admin/src/app/crops/page.tsx
git commit -m "feat(admin): archiver/désarchiver une culture + liste masquant les archivées

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Identité** : `IdentityEdited` + `editIdentity` (champs mutables) + `UpdateCropUseCase`/`PATCH` étendus ; éditeur admin ; `hasUnpublishedChanges` déclenché.
- **Archivage** : `DRAFT → ARCHIVED` autorisé ; `archive`/`unarchive` (use-cases + endpoints, 409 si illégal) ; boutons admin ; liste masque les archivées + vue « Archivées » avec Désarchiver ; `PublishedCrop` conservé.
- Pas de migration ; pas de suppression dure ; suite API verte ; build admin vert.

## Self-review (couverture spec)

- §4.1 identité (événement, domaine, use-case, endpoint) → Task 1. §4.2 archivage (état, unarchive, use-cases, endpoints, module) → Task 2. §4.3 tests → Tasks 1-2. ✅
- §5.1 api → Tasks 3-4. §5.2 éditeur identité → Task 3. §5.3 boutons archive → Task 4. §5.4 liste → Task 4. ✅
- §3 hors périmètre (suppression dure, metadata) → Global Constraints + Notes. ✅
- ⚠️ DB wipe rappelé → Global Constraints + steps. ✅
