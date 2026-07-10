# Admin — câblage sécurité éditoriale brouillon/publié — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre utilisable dans l'admin Next.js la sécurité éditoriale brouillon/publié de l'API (Lot B) : badge « modifications non publiées », boutons Republier/Abandonner, et page de prévisualisation lecture seule de la version figée.

**Architecture :** Aucun changement back-end — on consomme l'API existante. On étend le client fetch (`lib/api.ts`), on transforme le `PublishButton` en contrôleur à 3 états, on ajoute une page Server Component `/crops/[id]/published` alimentée par un composant d'affichage `CropReadView`, et on ajoute un indicateur dans la liste.

**Tech Stack :** Next.js 14 (App Router, Server Components), TypeScript, Tailwind, Radix/shadcn UI (`Badge`, `Button`, `Dialog` via `EditorShell`).

## Global Constraints

- **Aucun changement back-end** : l'API a déjà `hasUnpublishedChanges`/`hasPublishedVersion` sur `GET /crops` et `GET /crops/:id`, `GET /crops/:id/published`, `POST /crops/:id/discard`, `POST /crops/:id/publish` (sert aussi de republier).
- **Pas de framework de test dans l'admin** (scripts `dev`/`build`/`start` seulement). La barrière de vérif de chaque tâche = **`pnpm --filter @okko/admin build`** vert (compile + typecheck TS), + un **smoke manuel** décrit (non bloquant pour le commit, mais à rapporter). Pas de test unitaire à écrire.
- **Hors périmètre** : diff sémantique calculé ; affichage « publiée le… par… » (absents du document renvoyé par `GET /published`) ; UI d'archivage ; mise en place d'un framework de test.
- **Suivre les patterns existants** : `EditorShell` pour toute action confirmée (render-prop `{ submit, close, busy }` ; `submit(fn)` gère `router.refresh()` + affichage d'erreur) ; `Badge` (variantes `default|secondary|destructive|outline`) ; `labelOf` + tables de `@/lib/labels` ; liens stylés `className="text-sm text-primary hover:underline"`.
- **Copie UI en français.** Commits préfixés `feat(admin):`/`refactor(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Toutes les commandes depuis la racine du repo `/Users/scalens_01/Documents/personal-project/okko` (le build cible `@okko/admin`) ; les éditions de fichiers sous `apps/admin/`.

---

## File Structure

**Modifiés :**
- `apps/admin/src/lib/api.ts` — 2 champs sur `CropDocument` + `getCropPublished` + `discardDraft`.
- `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx` — contrôleur à 3 états (Publier / Publiée+lien / Republier+Abandonner+lien).
- `apps/admin/src/app/crops/[id]/page.tsx` — passe les 2 drapeaux au `PublishButton`.
- `apps/admin/src/app/crops/page.tsx` — badge « modifs non publiées » dans la cellule Statut.

**Créés :**
- `apps/admin/src/app/crops/[id]/CropReadView.tsx` — grille de cartes en lecture seule (Server Component).
- `apps/admin/src/app/crops/[id]/published/page.tsx` — page de prévisualisation figée.

---

## Task 1 : Client API — drapeaux + 2 fonctions

**Files:**
- Modify: `apps/admin/src/lib/api.ts`

**Interfaces:**
- Produces : `CropDocument.hasUnpublishedChanges: boolean`, `CropDocument.hasPublishedVersion: boolean` (hérités par `CropDetail` et par les items de `listCrops`) ; `getCropPublished(id: string): Promise<CropDetail>` ; `discardDraft(id: string): Promise<void>`.

- [ ] **Step 1 : Étendre `CropDocument`.** Dans `api.ts`, l'interface `CropDocument` (près du haut) :
```ts
export interface CropDocument {
  id: string; name: string; scientificName: string; family: string;
  cycleType: string; status: string; version: number;
  hasUnpublishedChanges: boolean; hasPublishedVersion: boolean;
  completeness: CompletenessReport;
}
```

- [ ] **Step 2 : Ajouter les 2 fonctions**, juste après la fonction `getCrop` existante (qui suit l'interface `CropDetail`). Le helper `readError(res)` est déjà défini dans le fichier (déclaration hoisted) — le réutiliser :
```ts
export async function getCropPublished(id: string): Promise<CropDetail> {
  const res = await fetch(`${BASE}/crops/${id}/published`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function discardDraft(id: string): Promise<void> {
  const res = await fetch(`${BASE}/crops/${id}/discard`, { method: 'POST' });
  if (!res.ok) throw new Error(await readError(res));
}
```

- [ ] **Step 3 : Typecheck.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (aucune erreur TS). À ce stade rien ne consomme encore les nouveaux champs ; le build valide seulement que les types compilent.

> Si le build échoue sur des composants qui construisent un `CropDocument`/`CropDetail` littéral sans les 2 nouveaux champs requis, c'est attendu **seulement** si un tel littéral existe — le repérer et le compléter (peu probable : l'app ne fabrique pas de crops à la main, elle les reçoit de l'API). Si le build passe, continuer.

- [ ] **Step 4 : Commit**
```bash
git add apps/admin/src/lib/api.ts
git commit -m "feat(admin): client API brouillon/publié (drapeaux + getCropPublished + discardDraft)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Contrôles d'action à 3 états (`PublishButton`)

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes : `publishCrop`, `discardDraft` (Task 1), `EditorShell`, `Badge`, `Button`.
- Produces : `PublishButton` prend désormais `{ cropId: string; status: string; hasUnpublishedChanges: boolean; hasPublishedVersion: boolean }`.

- [ ] **Step 1 : Réécrire `PublishButton.tsx`** intégralement :
```tsx
'use client';
import Link from 'next/link';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { publishCrop, discardDraft } from '../../../../lib/api';

export function PublishButton({
  cropId,
  hasUnpublishedChanges,
  hasPublishedVersion,
}: {
  cropId: string;
  status: string;
  hasUnpublishedChanges: boolean;
  hasPublishedVersion: boolean;
}) {
  // 1) Jamais publiée : premier publish.
  if (!hasPublishedVersion) {
    return (
      <EditorShell label="Publier">
        {({ submit, close, busy }) => (
          <div className="space-y-2">
            <p className="text-sm">Publier cette fiche ?</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
              <Button size="sm" disabled={busy} onClick={() => submit(() => publishCrop(cropId))}>Confirmer</Button>
            </div>
          </div>
        )}
      </EditorShell>
    );
  }

  const publishedLink = (
    <Link href={`/crops/${cropId}/published`} className="text-sm text-primary hover:underline">
      Voir la version publiée
    </Link>
  );

  // 2) Publiée, sans modifications en attente.
  if (!hasUnpublishedChanges) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Publiée</span>
        {publishedLink}
      </div>
    );
  }

  // 3) Publiée, avec modifications non publiées.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="border-amber-500 text-amber-700">Modifications non publiées</Badge>
      <EditorShell label="Republier">
        {({ submit, close, busy }) => (
          <div className="space-y-2">
            <p className="text-sm">Republier la fiche avec les modifications en cours ?</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
              <Button size="sm" disabled={busy} onClick={() => submit(() => publishCrop(cropId))}>Confirmer</Button>
            </div>
          </div>
        )}
      </EditorShell>
      <EditorShell label="Abandonner">
        {({ submit, close, busy }) => (
          <div className="space-y-2">
            <p className="text-sm">Abandonner les modifications non publiées et revenir à la version publiée ? Action irréversible.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => submit(() => discardDraft(cropId))}>Abandonner</Button>
            </div>
          </div>
        )}
      </EditorShell>
      {publishedLink}
    </div>
  );
}
```
> Le prop `status` reste dans le type (la page le passe encore) mais n'est plus déballé — la logique s'appuie sur les drapeaux, ce qui gère proprement `ARCHIVED→DRAFT`. Ne pas le retirer pour éviter de toucher la signature d'appel plus que nécessaire.

- [ ] **Step 2 : Passer les drapeaux dans `page.tsx`.** Dans `apps/admin/src/app/crops/[id]/page.tsx`, remplacer :
```tsx
          <PublishButton cropId={params.id} status={crop.status} />
```
par :
```tsx
          <PublishButton
            cropId={params.id}
            status={crop.status}
            hasUnpublishedChanges={crop.hasUnpublishedChanges}
            hasPublishedVersion={crop.hasPublishedVersion}
          />
```

- [ ] **Step 3 : Typecheck / build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert**.

- [ ] **Step 4 : Smoke manuel** (à rapporter, non bloquant). Avec l'API sur `:3001` et `pnpm --filter @okko/admin dev` : ouvrir une fiche jamais publiée → bouton **Publier** ; publier → « Publiée » + lien « Voir la version publiée » ; éditer un champ → **badge « Modifications non publiées » + Republier + Abandonner** ; Republier → retour à « Publiée » ; éditer puis **Abandonner** (confirmer) → la fiche revient à l'état publié.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/app/crops/[id]/editors/PublishButton.tsx apps/admin/src/app/crops/[id]/page.tsx
git commit -m "feat(admin): contrôles d'action brouillon/publié (Publier/Republier/Abandonner + lien)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Page de prévisualisation figée + `CropReadView`

**Files:**
- Create: `apps/admin/src/app/crops/[id]/CropReadView.tsx`
- Create: `apps/admin/src/app/crops/[id]/published/page.tsx`

**Interfaces:**
- Consumes : `getCropPublished` (Task 1), `CropDetail`, `labelOf` + tables de `@/lib/labels`, `Card`/`CardHeader`/`CardTitle`/`CardContent`.
- Produces : `CropReadView({ crop }: { crop: CropDetail })` — grille de cartes en lecture seule.

- [ ] **Step 1 : Créer `CropReadView.tsx`** (Server Component, pas de `'use client'`). Reprend les corps d'affichage des cartes de la fiche détail, **sans** aucun éditeur :
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  labelOf, SUITABILITY_LABELS, SUSCEPTIBILITY_LABELS, PEST_TYPE_LABELS,
  OPERATION_TYPE_LABELS, INPUT_LEVEL_LABELS, CONTROL_CATEGORY_LABELS,
} from '@/lib/labels';
import type { CropDetail } from '../../../lib/api';

export function CropReadView({ crop }: { crop: CropDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Exigences climatiques</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {crop.climatic?.temperature
            ? <p>Température : {crop.climatic.temperature.min}–{crop.climatic.temperature.optimal}–{crop.climatic.temperature.max} {crop.climatic.temperature.unit}</p>
            : <p className="text-muted-foreground">Non renseignées</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Exigences édaphiques</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {crop.edaphic?.ph
            ? <p>pH : {crop.edaphic.ph.min}–{crop.edaphic.ph.optimal}–{crop.edaphic.ph.max}</p>
            : <p className="text-muted-foreground">Non renseignées</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Variétés ({crop.varieties.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.varieties.map((v) => (<li key={v.id}>{v.name.fr}{v.maturityDays ? ` — ${v.maturityDays} j` : ''}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Zones ({crop.zones.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.zones.map((z) => (<li key={z.zoneId}>{z.zoneName.fr} — <strong>{labelOf(SUITABILITY_LABELS, z.rating)}</strong>{z.justification ? ` (${z.justification})` : ''}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Phénologie ({crop.phenology.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.phenology.map((p) => (<li key={p.order}>{p.name.fr} — J{p.startDay} à J{p.endDay}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Fenêtres de production ({crop.croppingWindows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {crop.croppingWindows.map((w) => (
            <div key={w.id} className="mb-3">
              <p className="font-medium">{w.season}{w.irrigationRequired ? ' · irrigation requise' : ''}</p>
              <ul className="list-disc pl-5">
                {w.operations.map((op, i) => (<li key={i}>J+{op.timingDays} — {op.label.fr} ({labelOf(OPERATION_TYPE_LABELS, op.type)})</li>))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Ravageurs &amp; maladies ({crop.pests.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {crop.pests.map((p) => (
            <div key={p.pestId} className="mb-3">
              <p className="font-medium">{p.pestName.fr} — <strong>{labelOf(SUSCEPTIBILITY_LABELS, p.susceptibility)}</strong> ({labelOf(PEST_TYPE_LABELS, p.type)})</p>
              <ul className="list-disc pl-5">
                {p.controlMethods.map((m, i) => (<li key={i}>{labelOf(CONTROL_CATEGORY_LABELS, m.category)} : {m.description.fr}</li>))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Nutrition ({crop.nutrition.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.nutrition.map((n, i) => (<li key={i}>{n.nutrient} — {n.amount} {n.unit}{n.stage ? ` (${n.stage})` : ''}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Rendement ({crop.yields.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.yields.map((y, i) => (<li key={i}>{labelOf(INPUT_LEVEL_LABELS, y.inputLevel)} : {y.min}–{y.average}–{y.potential} {y.unit}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Prix ({crop.prices.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.prices.map((p) => (<li key={p.id}>{p.date} — {p.price} {p.unit} @ {p.market}</li>))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```
> Les tables de labels et types de champs (`z.rating`, `p.susceptibility`, `op.type`, etc.) sont exactement ceux utilisés par la fiche détail (`apps/admin/src/app/crops/[id]/page.tsx`) — s'y référer si un champ manque. Le chemin `../../../lib/api` depuis `src/app/crops/[id]/CropReadView.tsx` pointe vers `src/lib/api`.

- [ ] **Step 2 : Créer la page `published/page.tsx`** :
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCropPublished } from '../../../../lib/api';
import { CropReadView } from '../CropReadView';

export default async function PublishedCropPage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) notFound();

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link href={`/crops/${params.id}`} className="text-sm text-primary hover:underline">← Retour au brouillon</Link>
        <h1 className="text-2xl font-bold">
          {crop.name} <em className="text-base font-normal text-muted-foreground">{crop.scientificName}</em>
        </h1>
        <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Version publiée (figée) — v{crop.version}. Lecture seule.
        </div>
      </div>
      <CropReadView crop={crop} />
    </main>
  );
}
```
> Chemin depuis `src/app/crops/[id]/published/page.tsx` : `../../../../lib/api` = `src/lib/api` (4 niveaux) ; `../CropReadView` = `src/app/crops/[id]/CropReadView`.

- [ ] **Step 3 : Typecheck / build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (la nouvelle route `/crops/[id]/published` est compilée).

- [ ] **Step 4 : Smoke manuel** (à rapporter). Sur une fiche publiée, cliquer **« Voir la version publiée »** → la page `/crops/[id]/published` s'affiche avec la bannière ambre « Version publiée (figée) — vN » et les cartes en lecture seule (aucun bouton d'édition). Éditer le brouillon puis rouvrir `/published` → la page montre encore l'**ancienne** valeur (figée). Sur une fiche jamais publiée, aller à l'URL `/crops/<id>/published` → **404**.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/app/crops/[id]/CropReadView.tsx apps/admin/src/app/crops/[id]/published/page.tsx
git commit -m "feat(admin): page de prévisualisation figée de la version publiée (CropReadView)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : Indicateur « modifications non publiées » dans la liste

**Files:**
- Modify: `apps/admin/src/app/crops/page.tsx`

**Interfaces:**
- Consumes : `CropDocument.hasUnpublishedChanges` (Task 1), `Badge`.

- [ ] **Step 1 : Ajouter le badge dans la cellule Statut.** Dans `apps/admin/src/app/crops/page.tsx`, remplacer la cellule Statut :
```tsx
                  <TableCell>
                    <Badge variant={c.status === 'PUBLISHED' ? 'default' : 'secondary'}>{labelOf(CROP_STATUS_LABELS, c.status)}</Badge>
                  </TableCell>
```
par :
```tsx
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === 'PUBLISHED' ? 'default' : 'secondary'}>{labelOf(CROP_STATUS_LABELS, c.status)}</Badge>
                      {c.hasUnpublishedChanges && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">modifs non publiées</Badge>
                      )}
                    </div>
                  </TableCell>
```
> `Badge` est déjà importé dans ce fichier ; `c.hasUnpublishedChanges` est fourni par `listCrops` (Task 1). Aucun autre changement.

- [ ] **Step 2 : Typecheck / build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert**.

- [ ] **Step 3 : Smoke manuel** (à rapporter). Dans `/crops`, une fiche publiée éditée (modifs non republiées) affiche le badge ambre **« modifs non publiées »** à côté de son statut ; une fiche publiée propre ou un brouillon ne l'affiche pas.

- [ ] **Step 4 : Commit**
```bash
git add apps/admin/src/app/crops/page.tsx
git commit -m "feat(admin): indicateur modifs non publiées dans la liste des cultures

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Boucle éditoriale cliquable de bout en bout** : Publier (1er) → éditer → badge + Republier/Abandonner → Republier/Abandonner opèrent → lien « voir le publié ».
- **Page figée** : `/crops/[id]/published` lecture seule, reflète le figé (pas le brouillon), 404 si jamais publiée.
- **Liste** : indicateur « modifs non publiées » présent uniquement quand `hasUnpublishedChanges`.
- **Zéro back-end** ; `pnpm --filter @okko/admin build` vert ; pas de diff calculé, pas d'archivage, pas de « publiée le/par ».
