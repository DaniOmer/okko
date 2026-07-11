# Spec — Admin : historique des versions & restauration (Lot C-admin D1)

**Projet** : Okko — admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Rendre **utilisable dans l'admin** l'historique des versions publiées (C1) et la restauration (C2) construits côté API. Aujourd'hui l'admin ne montre rien des versions : pas de liste, pas de consultation d'une version passée, pas de restauration. Cette brique livre : une **page liste des versions**, une **page de consultation** d'une version figée (réutilise `CropReadView`), et une **action Restaurer** (remplace le brouillon par la version choisie).

Le **diff** (C3 admin) est la sous-brique suivante (D2) et n'est **pas** inclus ici.

**Contexte technique (vérifié) :**
- L'API a déjà tous les endpoints (Lot C mergé) : `GET /crops/:id/versions`, `GET /crops/:id/versions/:revision`, `POST /crops/:id/versions/:revision/restore`.
- `CropReadView` (`src/app/crops/[id]/CropReadView.tsx`) affiche déjà n'importe quel `CropDetail` figé, sans éditeurs — **réutilisable tel quel**.
- `EditorShell` (`src/app/crops/[id]/editors/EditorShell.tsx`) gère les actions confirmées (dialogue + erreur + `busy` + `router.refresh()` au succès).
- L'admin n'a **aucun framework de test** → vérification = `pnpm --filter @okko/admin build` (compile + typecheck) + smoke manuel.

**Décisions (brainstorming 2026-07-11) :**
- **Découpage** : D1 (historique + consultation + restauration) → D2 (diff). D1 d'abord.
- **Liste des versions = page dédiée** `/crops/[id]/versions` (table), liée depuis la fiche.
- **Consultation** d'une version = route `/crops/[id]/versions/[revision]` réutilisant `CropReadView` + bannière.
- **Restauration** = confirmée (elle remplace le brouillon courant), disponible sur la page de consultation **et** en action rapide dans la table ; après succès → **redirection vers `/crops/[id]`**.

## 2. Périmètre

### Dans le lot
- 3 fonctions client + type `CropVersion` (`src/lib/api.ts`).
- Page liste `/crops/[id]/versions` (table) + lien depuis la fiche détail.
- Page consultation `/crops/[id]/versions/[revision]` (réutilise `CropReadView`).
- Composant `RestoreButton` (confirmation + redirection).

### Hors périmètre
- **Diff** (vue de comparaison) → D2.
- Toute modification **back-end** (l'API a tout).
- Framework de test admin (brique à part).
- Affichage fin de l'AuditLog / journal global.

## 3. Comportement préservé
- La carte « Historique » (AuditLog) de la fiche : **inchangée** (distincte des versions publiées).
- Les endpoints/pages existants : inchangés ; on **ajoute** des routes et un lien.

## 4. Architecture

### 4.1 Client API — `src/lib/api.ts`
```ts
export interface CropVersion { revision: number; version: number; publishedAt: string; publishedBy: string; }

export async function getCropVersions(id: string): Promise<CropVersion[]>;            // GET /crops/:id/versions
export async function getCropVersion(id: string, revision: number): Promise<CropDetail>; // GET /crops/:id/versions/:revision
export async function restoreVersion(id: string, revision: number): Promise<void>;    // POST /crops/:id/versions/:revision/restore
```
- GET avec `cache: 'no-store'` (comme les autres GET) ; erreurs via le helper `readError` existant.
- Le document renvoyé par `getCropVersion` a la forme `CropDetail` (document figé composé).

### 4.2 Page liste — `src/app/crops/[id]/versions/page.tsx` (Server Component)
- `getCropVersions(id)`. **Table** (`@/components/ui/table`) : colonnes **Révision · Publiée le · Par · Version (contenu) · Actions**.
- La **1ʳᵉ ligne** (révision max, tri décroissant renvoyé par l'API) porte un badge **« courante »**.
- Actions par ligne : **Voir** (`Link` vers `/crops/[id]/versions/[revision]`) + `<RestoreButton cropId revision />`.
- En-tête : titre « Versions publiées » + lien retour `/crops/[id]`. État vide : « Aucune version publiée. »
- Dates : affichage minimal de `publishedAt` (chaîne brute, comme la carte « Historique »), pas de dépendance de formatage.

### 4.3 Lien depuis la fiche — `src/app/crops/[id]/page.tsx`
- Ajouter un lien discret **« Historique des versions → »** vers `/crops/[id]/versions`, dans l'en-tête, affiché quand `crop.hasPublishedVersion`. Modif minimale.

### 4.4 Page consultation — `src/app/crops/[id]/versions/[revision]/page.tsx` (Server Component)
- `const version = await getCropVersion(id, Number(revision)).catch(() => null); if (!version) notFound();`
- **Bannière** : « **Version {revision} (figée) — Lecture seule** » + lien **« ← Retour aux versions »** vers `/crops/[id]/versions`.
- `<CropReadView crop={version} />` (aucune modif de `CropReadView`).
- `<RestoreButton cropId={id} revision={Number(revision)} />` en tête.
- La date/auteur ne sont **pas** affichés ici (absents du document figé ; ils vivent dans la table — évite un fetch supplémentaire, comme `/published`).

### 4.5 Composant `RestoreButton` — `src/app/crops/[id]/versions/RestoreButton.tsx` (Client Component)
- Réutilise `EditorShell` (label « Restaurer »). Props `{ cropId: string; revision: number }`. Utilisé dans la table **et** la page de consultation.
- Confirmation prévenant du remplacement du brouillon :
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
- **Après succès → `router.push('/crops/${cropId}')`** (le brouillon). L'`EditorShell` ferme le dialogue et déclenche `router.refresh()` (inoffensif après la navigation). Le brouillon montre alors le contenu restauré + le badge « modifications non publiées ».
- Chemins d'import (depuis `src/app/crops/[id]/versions/RestoreButton.tsx`) : `EditorShell` = `../editors/EditorShell` ; `restoreVersion` = `../../../../lib/api`.

## 5. Gestion d'erreur
- `getCropVersion` sur une révision inexistante → 404 → `notFound()` sur la page de consultation.
- `restoreVersion` en échec (409 jamais publié, 404 révision, infra) → message remonté par `EditorShell` (via `readError`).
- `getCropVersions` sur une culture sans versions → `[]` → état vide.

## 6. Vérification
- `pnpm --filter @okko/admin build` (⇒ typecheck) sans erreur.
- Smoke manuel contre une API vivante :
  - créer → publier → éditer → republier (2 versions) ;
  - `/crops/[id]/versions` : 2 lignes, tri décroissant, la plus récente marquée **« courante »** ;
  - **Voir** une version → page figée en lecture seule (`CropReadView`), bannière « Version N (figée) », aucun éditeur ;
  - **Restaurer** une version (depuis la page **ou** la table) → confirmation → redirection vers `/crops/[id]`, brouillon = contenu restauré + badge « modifications non publiées » ;
  - lien « Historique des versions → » présent sur la fiche quand publiée.

## 7. Critères de succès
- [ ] `CropVersion` + `getCropVersions` / `getCropVersion` / `restoreVersion` dans `api.ts`.
- [ ] Page `/crops/[id]/versions` (table + badge « courante » + actions Voir/Restaurer).
- [ ] Lien « Historique des versions → » sur la fiche (si publiée).
- [ ] Page `/crops/[id]/versions/[revision]` (CropReadView + bannière + Restaurer, 404 si absente).
- [ ] `RestoreButton` (confirmation + redirection vers le brouillon).
- [ ] `next build` vert ; smoke manuel OK.
- [ ] Diff (D2) & changement back-end **non** inclus.

## Références
- API Lot C : specs `2026-07-10-crop-version-history-design.md` (C1), `2026-07-11-crop-version-restore-design.md` (C2).
- Admin : `src/lib/api.ts`, `src/app/crops/[id]/page.tsx`, `src/app/crops/[id]/CropReadView.tsx`, `src/app/crops/[id]/published/page.tsx`, `src/app/crops/[id]/editors/EditorShell.tsx`, `src/app/crops/[id]/editors/PublishButton.tsx`, `src/components/ui/{table,badge,button,card}.tsx`.
