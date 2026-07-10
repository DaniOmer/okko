# Spec — Admin : câblage de la sécurité éditoriale brouillon/publié

**Projet** : Okko — admin (Next.js)
**Date** : 2026-07-10
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Rendre **utilisable dans l'admin** la sécurité éditoriale brouillon/publié construite côté API (Lot B). Aujourd'hui l'API sait figer une version publiée, republier, abandonner un brouillon et signaler des modifications non publiées — mais l'admin n'expose **rien** de tout ça : le `PublishButton` affiche « Publiée » (texte mort) une fois publié, il n'y a aucun bouton **Republier** ni **Abandonner**, aucun signal « modifications non publiées », et aucun moyen de voir la version figée.

Ce lot consomme l'API existante (aucun changement back-end) pour :
- afficher l'état brouillon/publié et le badge **« modifications non publiées »** (fiche **et** liste) ;
- offrir **Republier** et **Abandonner** ;
- offrir une **page de prévisualisation en lecture seule** de la version publiée figée.

**Contexte technique vérifié :**
- Les éditeurs de la page détail (`VarietyEditor`, `RequirementsEditor`, …) sont rendus **sans condition de statut** : éditer une fiche publiée fonctionne déjà côté UI. Le manque est côté **actions** (republier/abandonner) et **signal** (drapeaux), pas côté édition.
- `GET /crops` et `GET /crops/:id` renvoient déjà `hasUnpublishedChanges` / `hasPublishedVersion` (Lot B). `GET /crops/:id/published` renvoie le document figé ; `POST /crops/:id/discard` abandonne ; `POST /crops/:id/publish` (déjà utilisé) sert aussi de « republier » (`PUBLISHED→PUBLISHED` désormais légal).
- L'admin n'a **aucun framework de test** (scripts `dev`/`build`/`start`). Vérification = `next build` (typecheck) + smoke manuel.

**Décisions (brainstorming 2026-07-10) :**
- Périmètre **B** : contrôles d'action **+** prévisualisation du publié.
- Prévisualisation = **page dédiée en lecture seule** `/crops/[id]/published` (pas de bascule ni de côte-à-côte).
- Indicateur « modifications non publiées » **aussi dans la liste** `/crops`.
- Prévisualisation = **afficher** le document figé, **pas** un diff calculé (Lot C).

## 2. Périmètre

### Dans le lot
- Types + 2 fonctions dans le client API (`src/lib/api.ts`).
- Contrôles d'action sur la fiche détail (`PublishButton` étendu) : états + Republier + Abandonner + lien vers le publié.
- Page de prévisualisation lecture seule (`src/app/crops/[id]/published/page.tsx`) + composant d'affichage `CropReadView`.
- Indicateur « modifications non publiées » dans la liste `/crops`.

### Hors périmètre
- **Diff sémantique** calculé (Lot C).
- Affichage « publiée le … par … » (champs sur l'enregistrement `PublishedCrop`, absents du document renvoyé par `GET /published` → nécessiterait un changement d'API).
- UI d'**archivage** (inexistante ; on n'y touche pas).
- Mise en place d'un **framework de test** admin (brique à part).
- Toute modification **back-end** (l'API a tout ce qu'il faut).

## 3. Architecture

### 3.1 Client API — `src/lib/api.ts`
- Ajouter à l'interface **`CropDocument`** (héritée par `CropDetail` et par les items de `listCrops`) :
  ```ts
  hasUnpublishedChanges: boolean;
  hasPublishedVersion: boolean;
  ```
- **`getCropPublished(id: string): Promise<CropDetail>`** → `GET /crops/:id/published`. Le document figé a la même forme que `CropDetail`. 404 si jamais publiée (géré par la page, §3.3).
- **`discardDraft(id: string): Promise<void>`** → `POST /crops/:id/discard`, message d'erreur via le helper `readError` existant.
- **`publishCrop`** (existant) réutilisé tel quel pour publier **et** republier.

### 3.2 Contrôles d'action — `PublishButton` étendu (fiche détail)
Le composant reçoit `cropId`, `status`, `hasUnpublishedChanges`, `hasPublishedVersion` et pilote **3 états** (logique fondée sur les drapeaux, ce qui gère le cas `ARCHIVED→DRAFT`) :

| État (drapeaux) | Affichage |
|---|---|
| `!hasPublishedVersion` (jamais publiée) | bouton **Publier** (flux de confirmation existant, `publishCrop`) |
| `hasPublishedVersion && !hasUnpublishedChanges` | texte « Publiée » + lien **Voir la version publiée** |
| `hasPublishedVersion && hasUnpublishedChanges` | badge **« Modifications non publiées »** + **Republier** (`publishCrop`) + **Abandonner** (`discardDraft`, confirmation) + lien **Voir la version publiée** |

- **Republier** et **Publier** appellent tous deux `publishCrop` (même endpoint), relibellés selon l'état.
- **Abandonner** est destructif → passe par le pattern `EditorShell` (popover de confirmation, comme `PublishButton` aujourd'hui).
- Le badge de statut (`DRAFT/PUBLISHED/ARCHIVED`) déjà présent dans l'en-tête de la fiche **reste inchangé** ; ce composant ajoute le badge « modifs non publiées » + les boutons.
- Après action réussie : `router.refresh()` (comportement d'`EditorShell`).
- Le lien **Voir la version publiée** pointe vers `/crops/[id]/published` (composant `Link` Next), affiché dès que `hasPublishedVersion`.
- Câblage dans `src/app/crops/[id]/page.tsx` : passer les 2 drapeaux au composant.

### 3.3 Page de prévisualisation — `src/app/crops/[id]/published/page.tsx`
- **Server Component**. `const published = await getCropPublished(params.id).catch(() => null); if (!published) notFound();` → **404** si jamais publiée ou erreur.
- **En-tête distinctif** : bannière « **Version publiée (figée) — v{version}** » + lien **« ← Retour au brouillon »** vers `/crops/[id]`.
- **Contenu** : mêmes cartes que la fiche détail (climatique, édaphique, variétés, zones, phénologie, fenêtres, ravageurs, nutrition, rendement, prix), **en lecture seule**, via un nouveau composant **`CropReadView`** (rend la grille figée à partir d'un `CropDetail`, sans éditeurs ni actions).
- **Décomposition (DRY)** : on crée `CropReadView` dédié pour la page `/published` ; la page détail **reste inchangée** (elle garde sa grille éditable). Duplication d'affichage bornée et assumée (les deux vues divergent : éditable vs figée). Mutualisation plus poussée différée (YAGNI).

### 3.4 Indicateur liste — `src/app/crops/page.tsx`
- Dans la cellule **Statut** du tableau, quand `c.hasUnpublishedChanges`, afficher un **petit badge secondaire** (ambre/outline, ex. « modifs non publiées ») à côté du badge de statut. Le drapeau est déjà renvoyé par `listCrops` ; aucun autre changement.

## 4. Gestion d'erreur
- `POST /crops/:id/discard` en échec → message remonté par `EditorShell` (via `readError`).
- `GET /crops/:id/published` sur une fiche jamais publiée → 404 → `notFound()` sur la page `/published`. Le lien « voir le publié » n'est de toute façon affiché que si `hasPublishedVersion`.
- Republier/Abandonner : erreurs affichées via le flux `EditorShell` existant.

## 5. Vérification
- `pnpm --filter @okko/admin build` (⇒ typecheck TS) sans erreur.
- Smoke manuel contre une API vivante :
  - créer → publier → éditer → badge « modifs non publiées » apparaît (**liste + fiche**) ;
  - **Republier** → badge disparaît, `/crops/[id]/published` reflète la nouvelle valeur ;
  - éditer → **Abandonner** (confirmation) → le brouillon revient à l'état publié ;
  - `/crops/[id]/published` montre la version figée ; jamais publiée → `/published` = 404 et pas de lien « voir le publié ».

## 6. Critères de succès
- [ ] `CropDocument` porte `hasUnpublishedChanges` / `hasPublishedVersion` ; `getCropPublished` et `discardDraft` ajoutés.
- [ ] Contrôles d'action à 3 états (Publier / Publiée+lien / Republier+Abandonner+lien) sur la fiche.
- [ ] Page `/crops/[id]/published` lecture seule via `CropReadView` (404 si jamais publiée).
- [ ] Indicateur « modifications non publiées » dans la liste.
- [ ] `next build` vert ; smoke manuel OK.
- [ ] Aucun changement back-end ; pas de diff calculé, pas d'archivage, pas de « publiée le/par ».

## Références
- API Lot B : `docs/superpowers/specs/2026-07-09-event-sourcing-crop-lot-b-brouillon-publie-design.md`.
- Admin : `apps/admin/src/lib/api.ts`, `src/app/crops/page.tsx`, `src/app/crops/[id]/page.tsx`, `src/app/crops/[id]/editors/PublishButton.tsx`, `src/app/crops/[id]/editors/EditorShell.tsx`.
