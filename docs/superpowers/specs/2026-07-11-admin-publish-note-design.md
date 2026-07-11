# Spec — Admin : saisie & affichage de la note de publication (Lot Note, E2)

**Projet** : Okko — admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Rendre utilisable dans l'admin la note de publication (E1, API) : **saisir** une note optionnelle au moment de publier/republier, et l'**afficher** dans l'historique des versions. Dernière sous-brique de la piste « note de publication » (après E1 — API).

**Contexte (vérifié) :** l'API accepte `POST /crops/:id/publish` avec `{ note? }` (E1) et renvoie `note` dans `GET /crops/:id/versions`. Côté admin : `publishCrop(id)` POST sans corps ; `PublishButton` (3 états) confirme la publication via `EditorShell` ; `CropVersion` (client) n'a pas encore `note` ; la table des versions n'affiche pas de note. `Textarea` shadcn est disponible (`src/components/ui/textarea.tsx`).

**Décision (brainstorming 2026-07-11) :** affichage **table des versions seulement** (portée A) ; la note sur la page `/versions/[revision]` et dans le diff = additif ultérieur, hors périmètre.

## 2. Périmètre

### Dans le lot
- `publishCrop(id, note?)` + `CropVersion.note` (`src/lib/api.ts`).
- `PublishDialog` (client) : `EditorShell` + `Textarea`, utilisé pour Publier **et** Republier.
- `PublishButton` : câble `PublishDialog` (états « jamais publiée » et « modifs non publiées »).
- Colonne « Note » dans `/crops/[id]/versions`.

### Hors périmètre
- Note sur `/versions/[revision]` et dans le diff (portée A).
- Changement back-end (l'API a tout).
- Framework de test admin.

## 3. Comportement préservé
- **Abandonner** : inchangé (pas de note ; ce n'est pas une publication).
- État « Publiée » (propre) + lien « voir le publié » : inchangés.
- `RestoreButton`, page de consultation, diff : inchangés.

## 4. Architecture

### 4.1 Client — `src/lib/api.ts`
- `publishCrop(id: string, note?: string): Promise<void>` → `POST /crops/${id}/publish` avec `{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }`. (Chaîne vide/undefined → l'API normalise en `null`.)
- `CropVersion` gagne `note: string | null`.

### 4.2 `PublishDialog` — `src/app/crops/[id]/editors/PublishDialog.tsx` (Client Component)
Réutilise `EditorShell` ; état local `note` ; `Textarea` optionnel ; confirmer → `publishCrop(cropId, note)`.
```tsx
'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { publishCrop } from '../../../../lib/api';

export function PublishDialog({ cropId, label, prompt }: { cropId: string; label: string; prompt: string }) {
  const [note, setNote] = useState('');
  return (
    <EditorShell label={label}>
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">{prompt}</p>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="Note optionnelle (ex. Ajout variété Obatanpa, MAJ prix)" />
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
- Après publication réussie, l'état passe (jamais publiée → publiée / modifs → publiée) et le dialogue se démonte → l'état `note` résiduel n'est pas un problème pratique.

### 4.3 `PublishButton` — `src/app/crops/[id]/editors/PublishButton.tsx`
- Remplacer les confirmations inline de **Publier** et **Republier** par `<PublishDialog>` :
  - `!hasPublishedVersion` → `<PublishDialog cropId={cropId} label="Publier" prompt="Publier cette fiche ?" />`.
  - `hasUnpublishedChanges` → badge + `<PublishDialog cropId={cropId} label="Republier" prompt="Republier la fiche avec les modifications en cours ?" />` + **Abandonner** (inchangé) + lien « voir le publié ».
- État « Publiée » (propre) : inchangé.

### 4.4 Table des versions — `src/app/crops/[id]/versions/page.tsx`
- Ajouter une colonne **Note** : en-tête `Note` + cellule `{v.note ?? '—'}` (par ex. après « Version »).

## 5. Gestion d'erreur
- Échec de publication → message via `EditorShell` (comme aujourd'hui).
- `note` vide → l'API stocke `null` → « — » dans la table.

## 6. Vérification
- `pnpm --filter @okko/admin build` (⇒ typecheck) sans erreur.
- Smoke manuel : publier avec une note → la table `/crops/[id]/versions` la montre dans la colonne « Note » ; publier/republier sans note → « — » ; **Abandonner** inchangé (pas de champ note).

## 7. Critères de succès
- [ ] `publishCrop(id, note?)` envoie `{ note }` ; `CropVersion.note` déclaré.
- [ ] `PublishDialog` (Textarea) utilisé pour Publier **et** Republier.
- [ ] Colonne « Note » dans la table des versions (`— ` si null).
- [ ] Abandonner / état propre / autres pages : inchangés.
- [ ] `next build` vert ; smoke manuel OK.
- [ ] Note sur version-view/diff & back-end **non** inclus.

## Références
- E1 (API note) : `docs/superpowers/specs/2026-07-11-publish-note-api-design.md`.
- Admin : `src/lib/api.ts`, `src/app/crops/[id]/editors/PublishButton.tsx`, `src/app/crops/[id]/editors/EditorShell.tsx`, `src/app/crops/[id]/versions/page.tsx`, `src/components/ui/textarea.tsx`.
