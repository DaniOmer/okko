# Rendement par zone (+ type d'intrants + unité) — D2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le rendement de référence porte un **type d'intrants** (chimique/bio/combinaison) au lieu d'un niveau, une **unité** choisie dans une liste, et peut être **rattaché à une zone** de production (déjà dans le modèle).

**Architecture :** API d'abord — renommage atomique `InputLevel`→`InputType` / `inputLevel`→`inputType` à travers le modèle, le read model et tous les tests qui les référencent (pas de migration : yields est du JSON ; flux vide → pas d'upcasting). Puis admin — `YieldsEditor` gagne trois sélecteurs (type, unité, zone) en réutilisant son mode édition, et l'affichage montre le type + la zone.

**Tech Stack :** NestJS, Jest (API) ; Next.js 14, TypeScript, shadcn/ui (admin).

## Global Constraints

- **⚠️ La suite de tests API efface la DB de dev** (pas de `.env.test`). Prévenir avant `pnpm --filter @okko/api test`. DB + flux d'événements **vides** → pas d'upcasting ; yields = colonne **JSON** → **pas de migration**.
- **`InputType` = `CHEMICAL`/`ORGANIC`/`MIXED`** ; libellés admin `Chimique`/`Bio`/`Combinaison`. Unités = `t/ha`, `kg/ha`, `q/ha` (défaut `t/ha`). `zoneId` **optionnel** (vide = global).
- **Mode ajout ET édition** du `YieldsEditor` (Brique 3) conservés. Validation `min ≤ average ≤ potential` conservée.
- **API** : barrière = `pnpm --filter @okko/api test` vert. **Admin** : `pnpm --filter @okko/admin build` vert + smoke.
- Commits `feat(api):` / `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 (API) :** `apps/api/src/domain/crop/yield-reference.ts` ; `apps/api/src/application/crop/crop-read-model.ts` ; specs `restore-draft.use-case.spec.ts`, `discard-draft.use-case.spec.ts`, `set-crop-nutrition.use-case.spec.ts`, `publish-crop.use-case.spec.ts`, `crop-read-model.spec.ts`, `crop.spec.ts`, `yield-reference.spec.ts` ; `apps/api/test/helpers/complete-crop.ts` ; `apps/api/test/nutrition-price.e2e-spec.ts`.
**Task 2 (admin) :** `apps/admin/src/lib/labels.ts` ; `apps/admin/src/lib/api.ts` ; `apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx` ; `apps/admin/src/app/crops/[id]/page.tsx` ; `apps/admin/src/app/crops/[id]/CropReadView.tsx`.

---

## Task 1 : API — `inputLevel` → `inputType`

**Files:** (voir File Structure, Task 1)

**Interfaces:**
- Produces : `enum InputType { CHEMICAL, ORGANIC, MIXED }` ; `YieldReferenceJSON { inputType: InputType; min; average; potential; unit; zoneId? }`.

- [ ] **Step 1 : Mettre à jour le test du modèle (échoue)** — dans `apps/api/src/domain/crop/yield-reference.spec.ts` : importer `InputType`, remplacer `inputLevel: InputLevel.MEDIUM` par `inputType: InputType.CHEMICAL` (garder `zoneId: 'zone-1'`), et l'assertion `restored.inputLevel === InputLevel.MEDIUM` → `restored.inputType === InputType.CHEMICAL`. Le cas d'ordre invalide (`create` throw) reste, en remplaçant `inputLevel: InputLevel.LOW` par `inputType: InputType.CHEMICAL`.

- [ ] **Step 2 : Run → échoue.** Run: `pnpm --filter @okko/api test -- yield-reference` — Expected: FAIL (compile : `InputType` inexistant).

- [ ] **Step 3 : Modèle** — `apps/api/src/domain/crop/yield-reference.ts` :
  - Remplacer l'enum :
```ts
export enum InputType {
  CHEMICAL = 'CHEMICAL',
  ORGANIC = 'ORGANIC',
  MIXED = 'MIXED',
}
```
  - Remplacer partout `inputLevel: InputLevel` par `inputType: InputType` (dans `YieldReferenceJSON`, `CreateProps`), le champ privé `_inputLevel`→`_inputType`, le paramètre du constructeur, le getter `inputLevel`→`inputType`, l'usage dans `create` (`props.inputType`), `toJSON` (`inputType: this._inputType`), `fromJSON` (`json.inputType`). Conserver `zoneId?` et la validation `min ≤ average ≤ potential` (classe `YieldReferenceError`).

- [ ] **Step 4 : Run le test modèle → passe.** Run: `pnpm --filter @okko/api test -- yield-reference` — Expected: PASS.

- [ ] **Step 5 : Read model** — `crop-read-model.ts` ligne 95 : `${y.inputLevel}` → `${y.inputType}`.

- [ ] **Step 6 : Specs API (payloads yields)** — dans chacun, remplacer l'import `InputLevel`→`InputType` et `inputLevel: InputLevel.MEDIUM` (ou `.LOW`) → `inputType: InputType.CHEMICAL` :
  `restore-draft.use-case.spec.ts`, `discard-draft.use-case.spec.ts`, `set-crop-nutrition.use-case.spec.ts`, `publish-crop.use-case.spec.ts`, `crop-read-model.spec.ts`, `crop.spec.ts`. Adapter toute assertion sur `.inputLevel` → `.inputType`.

- [ ] **Step 7 : Helper + e2e** — remplacer `inputLevel: 'MEDIUM'` → `inputType: 'CHEMICAL'` dans `apps/api/test/helpers/complete-crop.ts` (l. 18) et `apps/api/test/nutrition-price.e2e-spec.ts` (l. 36) ; adapter toute assertion sur `.inputLevel`.

- [ ] **Step 8 : Full suite** (⚠️ efface la DB). Run: `pnpm --filter @okko/api test` — Expected: vert (plus aucune référence à `inputLevel`/`InputLevel`).

- [ ] **Step 9 : Commit**
```bash
git add apps/api/src/domain/crop/yield-reference.ts apps/api/src/domain/crop/yield-reference.spec.ts apps/api/src/application/crop/crop-read-model.ts apps/api/src/application/crop/restore-draft.use-case.spec.ts apps/api/src/application/crop/discard-draft.use-case.spec.ts apps/api/src/application/crop/set-crop-nutrition.use-case.spec.ts apps/api/src/application/crop/publish-crop.use-case.spec.ts apps/api/src/application/crop/crop-read-model.spec.ts apps/api/src/domain/crop/crop.spec.ts apps/api/test/helpers/complete-crop.ts apps/api/test/nutrition-price.e2e-spec.ts
git commit -m "feat(api): rendement par type d'intrants (InputType remplace InputLevel)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Admin — sélecteurs type/unité/zone + affichage

**Files:**
- Modify: `apps/admin/src/lib/labels.ts`
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/app/crops/[id]/editors/YieldsEditor.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/CropReadView.tsx`

**Interfaces:**
- Consumes : API (Task 1) `inputType` ; `crop.zones` (`{ zoneId, zoneName }`).
- Produces : `YieldsEditor` accepte `zones`.

- [ ] **Step 1 : `labels.ts`** — ajouter `export const INPUT_TYPE_LABELS: Record<string, string> = { CHEMICAL: 'Chimique', ORGANIC: 'Bio', MIXED: 'Combinaison' };` ; retirer `INPUT_LEVEL_LABELS` (plus utilisé après cette tâche).

- [ ] **Step 2 : `lib/api.ts`** — type `YieldReference` : `inputLevel: string` → `inputType: string`. `setYields` : dans le type du corps, `inputLevel: string` → `inputType: string`.

- [ ] **Step 3 : `YieldsEditor.tsx`** — remplacer tout le fichier par la version ci-dessous (type/unité/zone en select, mode édition conservé) :
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { INPUT_TYPE_LABELS } from '@/lib/labels';
import { setYields } from '../../../../lib/api';
import type { YieldReference } from '../../../../lib/api';

const UNITS = ['t/ha', 'kg/ha', 'q/ha'];

export function YieldsEditor({ cropId, current, zones, editIndex }: { cropId: string; current: YieldReference[]; zones: { zoneId: string; zoneName: Record<string, string> }[]; editIndex?: number }) {
  const editing = editIndex != null;
  const [inputType, setInputType] = useState(current[editIndex!]?.inputType ?? 'CHEMICAL');
  const [min, setMin] = useState(String(current[editIndex!]?.min ?? ''));
  const [avg, setAvg] = useState(String(current[editIndex!]?.average ?? ''));
  const [pot, setPot] = useState(String(current[editIndex!]?.potential ?? ''));
  const [unit, setUnit] = useState(current[editIndex!]?.unit ?? 't/ha');
  const [zoneId, setZoneId] = useState(current[editIndex!]?.zoneId ?? '');
  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un rendement de référence'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nouvelItem = { inputType, min: Number(min), average: Number(avg), potential: Number(pot), unit, zoneId: zoneId || undefined };
            const next = editing
              ? current.map((it, i) => i === editIndex ? nouvelItem : it)
              : [...current, nouvelItem];
            submit(async () => {
              await setYields(cropId, next);
              if (!editing) {
                setInputType('CHEMICAL'); setMin(''); setAvg(''); setPot(''); setUnit('t/ha'); setZoneId('');
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Type d&apos;intrants</Label>
            <Select value={inputType} onValueChange={setInputType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INPUT_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Rendement (min · moyen · potentiel) et unité</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={min} onChange={(e) => setMin(e.target.value)} required />
              <Input className="w-16" placeholder="moyen" value={avg} onChange={(e) => setAvg(e.target.value)} required />
              <Input className="w-16" placeholder="potentiel" value={pot} onChange={(e) => setPot(e.target.value)} required />
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Zone (optionnel)</Label>
            <Select value={zoneId || 'GLOBAL'} onValueChange={(v) => setZoneId(v === 'GLOBAL' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">Toutes zones (global)</SelectItem>
                {zones.map((z) => <SelectItem key={z.zoneId} value={z.zoneId}>{z.zoneName.fr}</SelectItem>)}
              </SelectContent>
            </Select>
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
> Note : le `<Select>` zone utilise la valeur sentinelle `'GLOBAL'` pour l'option vide (Radix Select n'accepte pas `value=""`). `zoneId` reste `''` dans l'état → `zoneId || undefined` à la soumission.

- [ ] **Step 4 : `page.tsx`** — import : `INPUT_LEVEL_LABELS` → `INPUT_TYPE_LABELS`. Dans la Card Rendement :
  - en-tête : `<YieldsEditor cropId={params.id} current={crop.yields} zones={crop.zones} />`.
  - chaque item (l. ~205) : passer `zones={crop.zones}` à l'éditeur d'édition et afficher le type + la zone :
```tsx
{crop.yields.map((y, i) => (
  <li key={i} className="flex items-center gap-2">
    <span>{labelOf(INPUT_TYPE_LABELS, y.inputType)} : {y.min}–{y.average}–{y.potential} {y.unit}{y.zoneId ? ` — zone ${crop.zones.find((z) => z.zoneId === y.zoneId)?.zoneName.fr ?? y.zoneId}` : ''}</span>
    <YieldsEditor cropId={params.id} current={crop.yields} zones={crop.zones} editIndex={i} />
  </li>
))}
```

- [ ] **Step 5 : `CropReadView.tsx`** — import : `INPUT_LEVEL_LABELS` → `INPUT_TYPE_LABELS`. Ligne yields (l. 97) :
```tsx
{crop.yields.map((y, i) => (<li key={i}>{labelOf(INPUT_TYPE_LABELS, y.inputType)} : {y.min}–{y.average}–{y.potential} {y.unit}{y.zoneId ? ` — zone ${crop.zones.find((z) => z.zoneId === y.zoneId)?.zoneName.fr ?? y.zoneId}` : ''}</li>))}
```

- [ ] **Step 6 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert (plus aucune référence à `INPUT_LEVEL_LABELS`/`inputLevel`).

- [ ] **Step 7 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Ajouter un rendement en choisissant type d'intrants, unité (select), zone → l'affichage montre le type et « zone X » ; sans zone = pas de mention ; « Modifier » un rendement pré-remplit type/unité/zone et enregistre.

- [ ] **Step 8 : Commit**
```bash
git add apps/admin/src/lib/labels.ts apps/admin/src/lib/api.ts apps/admin/src/app/crops/\[id\]/editors/YieldsEditor.tsx apps/admin/src/app/crops/\[id\]/page.tsx apps/admin/src/app/crops/\[id\]/CropReadView.tsx
git commit -m "feat(admin): rendement — type d'intrants, unité et zone en sélecteurs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- Plus aucune référence à `inputLevel`/`InputLevel`/`INPUT_LEVEL_LABELS` (API + admin). `InputType` (CHEMICAL/ORGANIC/MIXED) partout.
- Admin : type d'intrants, unité (t/ha, kg/ha, q/ha) et zone en sélecteurs ; mode ajout ET édition fonctionnels ; zone optionnelle (global si vide). Affichage type + « zone X » si rattaché.
- Pas de migration (JSON) ; pas d'upcasting (flux vide) ; validation `min ≤ average ≤ potential` conservée. Suite API verte ; build admin vert.

## Self-review (couverture spec)

- §4.1 modèle enum/champ → Task 1 (Steps 3). §4.2 read model → Task 1 (Step 5). §4.5 tests/non-régression → Task 1 (Steps 1,6,7). ✅
- §5.1 labels → Task 2 (Step 1). §5.2 api → Step 2. §5.3 éditeur (type/unité/zone + édition) → Step 3. §5.4 affichage page + read view → Steps 4-5. ✅
- §3 hors périmètre (migration, upcasting, validation stricte zone) → Global Constraints + Notes. ✅
- ⚠️ DB wipe rappelé → Global Constraints + steps. ✅
