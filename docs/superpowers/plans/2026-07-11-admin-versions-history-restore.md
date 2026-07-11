# Admin — historique des versions & restauration (Lot C-admin D1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre utilisable dans l'admin Next.js l'historique des versions publiées (C1) et la restauration (C2) : une page liste des versions, une page de consultation d'une version figée, et un bouton Restaurer.

**Architecture :** Aucun changement back-end — on consomme l'API Lot C existante. On étend le client fetch (`lib/api.ts`), on ajoute deux routes Server Component (`/crops/[id]/versions` et `/crops/[id]/versions/[revision]`) qui réutilisent `CropReadView`, un composant client `RestoreButton` (via `EditorShell`), et un lien depuis la fiche.

**Tech Stack :** Next.js 14 (App Router, Server Components), TypeScript, Tailwind, shadcn/ui (`Table`, `Badge`, `Button`, `Dialog` via `EditorShell`).

## Global Constraints

- **Aucun changement back-end** : l'API Lot C est mergée (`GET /crops/:id/versions`, `GET /crops/:id/versions/:revision`, `POST /crops/:id/versions/:revision/restore`).
- **Pas de framework de test dans l'admin** : la barrière de vérif de chaque tâche = **`pnpm --filter @okko/admin build`** vert (compile + typecheck), + un **smoke manuel** décrit (non bloquant pour le commit, à rapporter ; l'app live ne peut pas être lancée par l'implémenteur).
- **Réutiliser l'existant** : `CropReadView` (affiche un `CropDetail` figé, sans modif), `EditorShell` (dialogue/erreur/`busy`/`router.refresh()`), helper `readError`, liens stylés `className="text-sm text-primary hover:underline"`, bannière figée `border-amber-500 bg-amber-50 text-amber-800`.
- **Restauration** : confirmée (remplace le brouillon) ; après succès → `router.push('/crops/${cropId}')`.
- **Hors périmètre** : diff (D2) ; changement back-end ; framework de test.
- Copie UI en français. Commits `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Toutes les commandes depuis la racine du repo `/Users/scalens_01/Documents/personal-project/okko` ; éditions sous `apps/admin/`.

---

## File Structure

**Modifiés :**
- `apps/admin/src/lib/api.ts` — type `CropVersion` + `getCropVersions`/`getCropVersion`/`restoreVersion`.
- `apps/admin/src/app/crops/[id]/page.tsx` — lien « Historique des versions → ».

**Créés :**
- `apps/admin/src/app/crops/[id]/versions/RestoreButton.tsx` — bouton client (confirmation + redirection).
- `apps/admin/src/app/crops/[id]/versions/page.tsx` — page liste (table).
- `apps/admin/src/app/crops/[id]/versions/[revision]/page.tsx` — page consultation (CropReadView).

---

## Task 1 : Client API — versions + restauration

**Files:**
- Modify: `apps/admin/src/lib/api.ts`

**Interfaces:**
- Produces : `CropVersion { revision: number; version: number; publishedAt: string; publishedBy: string; }` ; `getCropVersions(id): Promise<CropVersion[]>` ; `getCropVersion(id, revision): Promise<CropDetail>` ; `restoreVersion(id, revision): Promise<void>`.

- [ ] **Step 1 : Ajouter le type + les 3 fonctions** dans `api.ts`, juste après la fonction `discardDraft` existante (le helper `readError` et l'interface `CropDetail` sont déjà définis plus haut) :
```ts
export interface CropVersion {
  revision: number;
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export async function getCropVersions(id: string): Promise<CropVersion[]> {
  const res = await fetch(`${BASE}/crops/${id}/versions`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function getCropVersion(id: string, revision: number): Promise<CropDetail> {
  const res = await fetch(`${BASE}/crops/${id}/versions/${revision}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function restoreVersion(id: string, revision: number): Promise<void> {
  const res = await fetch(`${BASE}/crops/${id}/versions/${revision}/restore`, { method: 'POST' });
  if (!res.ok) throw new Error(await readError(res));
}
```

- [ ] **Step 2 : Typecheck / build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (rien ne consomme encore ces fonctions ; le build valide la compilation TS).

- [ ] **Step 3 : Commit**
```bash
git add apps/admin/src/lib/api.ts
git commit -m "feat(admin): client API versions & restauration (getCropVersions/getCropVersion/restoreVersion)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Bouton Restaurer + page liste des versions + lien depuis la fiche

**Files:**
- Create: `apps/admin/src/app/crops/[id]/versions/RestoreButton.tsx`
- Create: `apps/admin/src/app/crops/[id]/versions/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes : `getCropVersions`, `restoreVersion` (Task 1), `EditorShell`, `CropReadView` non requis ici.
- Produces : `RestoreButton({ cropId: string; revision: number })` ; route `/crops/[id]/versions`.

- [ ] **Step 1 : Créer `RestoreButton.tsx`** (Client Component) :
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { EditorShell } from '../editors/EditorShell';
import { Button } from '@/components/ui/button';
import { restoreVersion } from '../../../../lib/api';

export function RestoreButton({ cropId, revision }: { cropId: string; revision: number }) {
  const router = useRouter();
  return (
    <EditorShell label="Restaurer">
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">Restaurer la version {revision} dans le brouillon ? Cela remplace le contenu du brouillon courant.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button size="sm" disabled={busy}
              onClick={() => submit(async () => { await restoreVersion(cropId, revision); router.push(`/crops/${cropId}`); })}>
              Restaurer
            </Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```
> Chemins depuis `src/app/crops/[id]/versions/RestoreButton.tsx` : `EditorShell` = `../editors/EditorShell` ; `restoreVersion` = `../../../../lib/api` (4 niveaux → `src/lib/api`). `Button` via l'alias `@/components/ui/button`.

- [ ] **Step 2 : Créer `versions/page.tsx`** (Server Component) :
```tsx
import Link from 'next/link';
import { getCropVersions } from '../../../../lib/api';
import { RestoreButton } from './RestoreButton';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function CropVersionsPage({ params }: { params: { id: string } }) {
  const versions = await getCropVersions(params.id).catch(() => []);
  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link href={`/crops/${params.id}`} className="text-sm text-primary hover:underline">← Retour à la fiche</Link>
        <h1 className="text-2xl font-bold">Versions publiées</h1>
      </div>
      {versions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune version publiée.</div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Révision</TableHead>
                <TableHead>Publiée le</TableHead>
                <TableHead>Par</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v, i) => (
                <TableRow key={v.revision}>
                  <TableCell className="font-medium">
                    v{v.revision}
                    {i === 0 && <Badge variant="secondary" className="ml-2">courante</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.publishedAt}</TableCell>
                  <TableCell>{v.publishedBy}</TableCell>
                  <TableCell>v{v.version}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/crops/${params.id}/versions/${v.revision}`}>Voir</Link>
                    </Button>
                    <RestoreButton cropId={params.id} revision={v.revision} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
```
> `i === 0` = première ligne = révision la plus haute (l'API trie décroissant) → badge « courante ». Chemin `getCropVersions` = `../../../../lib/api`.

- [ ] **Step 3 : Lien depuis la fiche** — dans `apps/admin/src/app/crops/[id]/page.tsx`, ajouter (si absent) `import Link from 'next/link';` en tête, puis, **juste après** l'élément `<PublishButton ... />` dans l'en-tête, ajouter :
```tsx
          {crop.hasPublishedVersion && (
            <Link href={`/crops/${params.id}/versions`} className="text-sm text-primary hover:underline">
              Historique des versions →
            </Link>
          )}
```
> Lire l'en-tête pour placer le lien dans le même bloc `<div className="space-y-1">` que le `PublishButton`, après sa balise fermante `/>`.

- [ ] **Step 4 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (la route `/crops/[id]/versions` compile).

- [ ] **Step 5 : Smoke manuel** (à rapporter, non bloquant). API sur `:3001` + `pnpm --filter @okko/admin dev` : publier une culture 2 fois → `/crops/[id]/versions` liste 2 lignes (tri décroissant, la 1ʳᵉ marquée « courante ») ; le lien « Historique des versions → » apparaît sur la fiche publiée ; « Restaurer » ouvre une confirmation.

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/app/crops/[id]/versions/RestoreButton.tsx apps/admin/src/app/crops/[id]/versions/page.tsx apps/admin/src/app/crops/[id]/page.tsx
git commit -m "feat(admin): page liste des versions + bouton Restaurer + lien depuis la fiche

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Page de consultation d'une version figée

**Files:**
- Create: `apps/admin/src/app/crops/[id]/versions/[revision]/page.tsx`

**Interfaces:**
- Consumes : `getCropVersion` (Task 1), `CropReadView` (existant), `RestoreButton` (Task 2).

- [ ] **Step 1 : Créer `versions/[revision]/page.tsx`** (Server Component) :
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCropVersion } from '../../../../../lib/api';
import { CropReadView } from '../../CropReadView';
import { RestoreButton } from '../RestoreButton';

export default async function CropVersionPage({ params }: { params: { id: string; revision: string } }) {
  const revision = Number(params.revision);
  const version = await getCropVersion(params.id, revision).catch(() => null);
  if (!version) notFound();

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link href={`/crops/${params.id}/versions`} className="text-sm text-primary hover:underline">← Retour aux versions</Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">
            {version.name} <em className="text-base font-normal text-muted-foreground">{version.scientificName}</em>
          </h1>
          <RestoreButton cropId={params.id} revision={revision} />
        </div>
        <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Version {revision} (figée) — Lecture seule.
        </div>
      </div>
      <CropReadView crop={version} />
    </main>
  );
}
```
> Chemins depuis `src/app/crops/[id]/versions/[revision]/page.tsx` : `getCropVersion` = `../../../../../lib/api` (5 niveaux) ; `CropReadView` = `../../CropReadView` ; `RestoreButton` = `../RestoreButton`.

- [ ] **Step 2 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (la route `/crops/[id]/versions/[revision]` compile).

- [ ] **Step 3 : Smoke manuel** (à rapporter). Depuis la table, **Voir** une version → page en lecture seule (`CropReadView`), bannière « Version N (figée) », aucun éditeur ; **Restaurer** (depuis la page ou la table) → confirmation → redirection vers `/crops/[id]`, brouillon = contenu restauré + badge « modifications non publiées » ; une révision inexistante (`/crops/[id]/versions/999`) → 404.

- [ ] **Step 4 : Commit**
```bash
git add apps/admin/src/app/crops/[id]/versions/[revision]/page.tsx
git commit -m "feat(admin): page de consultation d'une version figée (CropReadView + Restaurer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Historique cliquable** : fiche → « Historique des versions → » → table (tri décroissant, « courante ») → **Voir** une version figée → **Restaurer** → brouillon peuplé.
- **Réutilisation** : `CropReadView` et `EditorShell` réutilisés sans modification ; seul `RestoreButton` est neuf.
- **Restauration** : confirmée (protège le brouillon), redirige vers le brouillon au succès.
- **Zéro back-end** ; `pnpm --filter @okko/admin build` vert ; diff (D2) non inclus.
