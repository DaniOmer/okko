# Admin — saisie & affichage de la note de publication (E2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saisir une note optionnelle au moment de publier/republier une culture (admin) et l'afficher dans la table des versions.

**Architecture :** L'API (E1) accepte déjà `POST /crops/:id/publish` avec `{ note? }` et renvoie `note` dans `GET /crops/:id/versions`. Côté admin : on élargit `publishCrop(id, note?)` pour envoyer le corps, on ajoute `note` au type `CropVersion`, on introduit un composant `PublishDialog` (EditorShell + Textarea) réutilisé pour Publier et Republier, et on ajoute une colonne « Note » à la table des versions.

**Tech Stack :** Next.js 14 (App Router), TypeScript, shadcn/ui (Textarea, Button), Tailwind.

## Global Constraints

- **Zéro changement back-end** : l'API E1 fournit tout (`{ note? }` en entrée, `note` dans `/versions`).
- **Pas de framework de test admin** : barrière = **`pnpm --filter @okko/admin build`** vert + smoke manuel (à rapporter ; app live non lancée par l'implémenteur).
- **Portée A** : affichage dans la **table des versions seulement**. Note sur `/versions/[revision]` et dans le diff = **hors périmètre**.
- **Comportement préservé** : **Abandonner** (pas de note), état « Publiée » propre + lien « Voir la version publiée » : **inchangés**.
- **Normalisation** : la chaîne vide/undefined est normalisée en `null` **par l'API** ; l'admin envoie simplement `{ note }` (l'état local, éventuellement `''`).
- Copie UI en français. Commits `feat(admin):`. Terminer chaque message de commit par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Commandes depuis la racine du repo `/Users/scalens_01/Documents/personal-project/okko` ; éditions sous `apps/admin/`.

---

## File Structure

**Modifiés :**
- `apps/admin/src/lib/api.ts` — `publishCrop(id, note?)` envoie `{ note }` ; `CropVersion` gagne `note: string | null`.
- `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx` — remplace les confirmations inline de Publier/Republier par `<PublishDialog>`.
- `apps/admin/src/app/crops/[id]/versions/page.tsx` — colonne « Note ».

**Créé :**
- `apps/admin/src/app/crops/[id]/editors/PublishDialog.tsx` — dialogue de publication (EditorShell + Textarea + confirmation).

**Réutilisés sans modification :** `EditorShell` (render-prop `{submit, close, busy}`), `Textarea` (`@/components/ui/textarea`), `Button`, `formatDateTime`.

---

## Task 1 : couche client `api.ts` (`publishCrop` + `CropVersion.note`)

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (fonction `publishCrop` L29-32 ; interface `CropVersion` L114-119)

**Interfaces:**
- Consumes : `BASE` (const déjà présente dans le fichier).
- Produces :
  - `publishCrop(id: string, note?: string): Promise<void>` — `POST /crops/${id}/publish` avec corps JSON `{ note }`.
  - `CropVersion { revision: number; version: number; publishedAt: string; publishedBy: string; note: string | null }`.

- [ ] **Step 1 : Élargir `publishCrop`** — dans `apps/admin/src/lib/api.ts`, remplacer la fonction actuelle :
```ts
export async function publishCrop(id: string): Promise<void> {
  const res = await fetch(`${BASE}/crops/${id}/publish`, { method: 'POST' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
}
```
par :
```ts
export async function publishCrop(id: string, note?: string): Promise<void> {
  const res = await fetch(`${BASE}/crops/${id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
}
```
(`note` undefined → `JSON.stringify({ note: undefined })` = `"{}"` → l'API lit `body?.note` undefined → `null`.)

- [ ] **Step 2 : Ajouter `note` à `CropVersion`** — remplacer l'interface :
```ts
export interface CropVersion {
  revision: number;
  version: number;
  publishedAt: string;
  publishedBy: string;
}
```
par :
```ts
export interface CropVersion {
  revision: number;
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string | null;
}
```

- [ ] **Step 3 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert**. (`publishCrop(cropId)` sans 2ᵉ argument reste valide — `note?` est optionnel ; les appels existants dans `PublishButton` ne cassent pas.)

- [ ] **Step 4 : Commit**
```bash
git add apps/admin/src/lib/api.ts
git commit -m "feat(admin): publishCrop transmet la note, CropVersion.note

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : composant `PublishDialog` + câblage dans `PublishButton`

**Files:**
- Create: `apps/admin/src/app/crops/[id]/editors/PublishDialog.tsx`
- Modify: `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx`

**Interfaces:**
- Consumes :
  - `publishCrop(cropId, note)` (Task 1).
  - `EditorShell({ label, children })` render-prop `{ submit, close, busy }` — `submit(fn)` attend `fn`, ferme, `router.refresh()`.
  - `Textarea` (`@/components/ui/textarea`), `Button` (`@/components/ui/button`).
- Produces : `PublishDialog({ cropId, label, prompt }: { cropId: string; label: string; prompt: string })` — dialogue de publication avec zone de note optionnelle.

- [ ] **Step 1 : Créer `PublishDialog.tsx`** — `apps/admin/src/app/crops/[id]/editors/PublishDialog.tsx` :
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { publishCrop } from '../../../../lib/api';

export function PublishDialog({
  cropId,
  label,
  prompt,
}: {
  cropId: string;
  label: string;
  prompt: string;
}) {
  const [note, setNote] = useState('');
  return (
    <EditorShell label={label}>
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">{prompt}</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note optionnelle (ex. Ajout variété Obatanpa, MAJ prix)"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => submit(() => publishCrop(cropId, note))}>Confirmer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
```

- [ ] **Step 2 : Câbler l'état « Jamais publiée » dans `PublishButton.tsx`** — dans `apps/admin/src/app/crops/[id]/editors/PublishButton.tsx`, remplacer le bloc `if (!hasPublishedVersion)` (actuellement un `EditorShell label="Publier"` inline, L19-33) par :
```tsx
  // 1) Jamais publiée : premier publish.
  if (!hasPublishedVersion) {
    return <PublishDialog cropId={cropId} label="Publier" prompt="Publier cette fiche ?" />;
  }
```

- [ ] **Step 3 : Câbler l'état « Modifications non publiées »** — dans le même fichier, dans le bloc `return` final (état 3), remplacer le `EditorShell label="Republier"` inline (L55-65) par :
```tsx
      <PublishDialog cropId={cropId} label="Republier" prompt="Republier la fiche avec les modifications en cours ?" />
```
Ne pas toucher au `EditorShell label="Abandonner"` qui suit (inchangé), ni au `publishedLink`.

- [ ] **Step 4 : Mettre à jour les imports de `PublishButton.tsx`** — ajouter l'import de `PublishDialog` et retirer les imports devenus inutiles. `Button` reste utilisé par le bloc Abandonner ; `publishCrop` n'est plus appelé directement dans ce fichier (déplacé dans `PublishDialog`). L'en-tête d'imports doit devenir :
```tsx
'use client';
import Link from 'next/link';
import { EditorShell } from './EditorShell';
import { PublishDialog } from './PublishDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { discardDraft } from '../../../../lib/api';
```
> `EditorShell` et `Button` restent utilisés par le bloc **Abandonner** ; `Badge` par l'état 3 ; `Link` par `publishedLink`. `publishCrop` disparaît des imports de ce fichier.

- [ ] **Step 5 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (compile + typecheck ; aucun import inutilisé — `next build` échoue sinon via ESLint `no-unused-vars` si configuré, donc vérifier que `publishCrop` a bien été retiré).

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/app/crops/[id]/editors/PublishDialog.tsx apps/admin/src/app/crops/[id]/editors/PublishButton.tsx
git commit -m "feat(admin): PublishDialog avec note pour Publier et Republier

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : colonne « Note » dans la table des versions

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/versions/page.tsx` (en-tête de table L27-34 ; corps L37-53)

**Interfaces:**
- Consumes : `CropVersion.note` (Task 1) via `getCropVersions`.

- [ ] **Step 1 : Ajouter l'en-tête « Note »** — dans `apps/admin/src/app/crops/[id]/versions/page.tsx`, dans `<TableRow>` de l'en-tête, insérer une colonne « Note » après « Version » :
```tsx
              <TableRow>
                <TableHead>Révision</TableHead>
                <TableHead>Publiée le</TableHead>
                <TableHead>Par</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
```

- [ ] **Step 2 : Ajouter la cellule « Note »** — dans le `versions.map(...)`, insérer la cellule correspondante après `<TableCell>v{v.version}</TableCell>` :
```tsx
                  <TableCell>v{v.version}</TableCell>
                  <TableCell className="text-muted-foreground">{v.note ?? '—'}</TableCell>
                  <TableCell className="text-right space-x-2">
```

- [ ] **Step 3 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (`v.note` est typé grâce à Task 1).

- [ ] **Step 4 : Smoke manuel** (à rapporter, non bloquant). API sur `:3001` + `pnpm --filter @okko/admin dev` :
  - Publier une fiche avec une note → la table `/crops/[id]/versions` montre la note dans la colonne « Note ».
  - Publier/republier **sans** note → « — » dans la colonne.
  - **Abandonner** : inchangé (pas de champ note) ; état « Publiée » propre + lien « Voir la version publiée » : inchangés.

- [ ] **Step 5 : Commit**
```bash
git add apps/admin/src/app/crops/[id]/versions/page.tsx
git commit -m "feat(admin): colonne Note dans la table des versions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- `publishCrop(id, note?)` envoie `{ note }` ; publier sans 2ᵉ argument reste valide et donne `null` côté API.
- `PublishDialog` (Textarea) utilisé pour **Publier** ET **Republier** ; **Abandonner**, état propre + lien « Voir la version publiée » inchangés.
- Colonne « Note » dans la table des versions (`—` si `null`).
- `CropVersion.note` déclaré ; `v.note` typé.
- Zéro back-end ; note sur `/versions/[revision]` et diff hors périmètre.
- `pnpm --filter @okko/admin build` vert à chaque tâche ; smoke manuel rapporté.

## Self-review (couverture spec)

- §4.1 `publishCrop(id, note?)` + `CropVersion.note` → Task 1. ✅
- §4.2 `PublishDialog` → Task 2 Step 1. ✅
- §4.3 câblage Publier + Republier, Abandonner inchangé → Task 2 Steps 2-4. ✅
- §4.4 colonne « Note » → Task 3. ✅
- §3 comportement préservé (Abandonner, état propre) → Task 2 Step 3 (bloc Abandonner intact), Notes finales. ✅
- §6 vérification (build + smoke) → chaque tâche. ✅
- §2 hors périmètre (version-view/diff, back-end) → Global Constraints + Notes finales. ✅
