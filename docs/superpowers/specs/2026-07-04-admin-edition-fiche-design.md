# Spec — Édition en place de la fiche culture (back-office admin)

**Projet** : Okko — back-office de la base de connaissances
**Date** : 2026-07-04
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Rendre la fiche culture **modifiable depuis l'admin**. Aujourd'hui l'admin sait créer une culture et l'afficher en lecture seule ; toutes les mutations existent côté API mais ne sont pas accessibles à l'utilisateur. On ajoute l'**édition en place, section par section**, pour les **11 catégories** de la fiche, sans changement backend.

## 2. Périmètre

### Dans le lot (toutes les catégories)
Édition/ajout depuis la page détail `/crops/[id]` pour :
- **Publication** (statut `DRAFT → PUBLISHED`)
- **Exigences climatiques + édaphiques**
- **Variétés**
- **Phénologie**
- **Fenêtres de production** (avec sous-liste d'opérations)
- **Nutrition**
- **Rendement**
- **Zones d'adéquation** (rattachement depuis le catalogue)
- **Ravageurs & maladies** (rattachement depuis le catalogue)
- **Prix**

### Hors périmètre
- Aucun changement backend (tous les endpoints existent).
- Pas de suppression d'une entité liée déjà persistée (variété/fenêtre/prix/zone/ravageur) — l'API n'expose pas de DELETE. La suppression *au sein d'une liste remplacée en bloc* (phénologie/nutrition/rendement) est possible car le PATCH remplace toute la liste.
- Édition d'itinéraire ultra-fine post-création d'une fenêtre : on capture les opérations à la création ; retoucher les opérations d'une fenêtre existante est différé.
- Renommage de la culture / édition du `metadata` : optionnel, différé (pas demandé).
- Édition des catalogues eux-mêmes (zone/ravageur) : déjà couverte par `/zones` et `/pests`.

## 3. Architecture

- **`crops/[id]/page.tsx` reste un Server Component** : il fetch la fiche complète (`getCrop`), les **catalogues** `listZones()` + `listPests()` (pour les listes déroulantes des éditeurs de relation) et l'historique (`getCropHistory`). Il rend, pour chaque catégorie, un **composant éditeur client** avec les données courantes + le `cropId` (+ les options de catalogue le cas échéant).
- **Éditeurs = Client Components** (`'use client'`) : bouton « Éditer / Ajouter » → formulaire inline → appel API → `router.refresh()` (re-fetch de la page serveur, pas d'état global) → message d'erreur inline sur `!res.ok`.
- **Aucune dépendance nouvelle.** Réutilise Next.js App Router (`router.refresh`), Tailwind.

### Flux type (ajout d'une variété)
```
[Server page] getCrop → <VarietyEditor cropId data={crop.varieties} />
   └─ [Client] "Ajouter" → formulaire inline → addVariety(cropId, {...})
        └─ succès → router.refresh() → la page serveur re-fetch → la variété apparaît
        └─ échec  → message inline, pas de navigation
```

## 4. Composants

### 4.1 `EditorShell` (cœur DRY)
Wrapper client qui factorise le squelette commun de tous les éditeurs :
- gère l'état **ouvert/fermé** (bouton « Éditer / Ajouter » ↔ formulaire),
- gère l'état **d'erreur** (message inline),
- expose une fonction `submit(fn)` : appelle `fn()` (l'appel API), sur succès → `router.refresh()` + ferme, sur échec → affiche `err.message`.

Chaque éditeur concret rend **ses champs** dans le `EditorShell` et fournit le `fn` de soumission. Il ne contient que ses champs + son appel API.

### 4.2 Les 5 patrons → 11 catégories

| Patron | Composant(s) | Catégories | Appel API |
|---|---|---|---|
| **A** Bouton d'action | `PublishButton` | Publication | `POST /crops/:id/publish` (409 → message) |
| **B** Formulaire objet | `RequirementsEditor` | Climat + Sol | `PATCH /crops/:id/requirements` |
| **C** Éditeur de liste (remplace la liste) | `PhenologyEditor`, `NutritionEditor`, `YieldsEditor` | Phénologie · Nutrition · Rendement | `PATCH .../phenology \| /nutrition \| /yields` |
| **D** Ajout d'un élément | `VarietyEditor`, `PriceEditor`, `WindowEditor` | Variétés · Prix · Fenêtres | `POST .../varieties \| /prices \| /windows` |
| **E** Éditeur de relation | `ZoneSuitabilityEditor`, `PestControlEditor` | Zones · Ravageurs | `PUT .../zones/:zoneId \| /pests/:pestId` |

**Détails par patron :**
- **C (liste remplacée en bloc)** : l'éditeur part des lignes existantes, permet d'**ajouter/retirer des lignes** localement, puis « Enregistrer » PATCH la **liste complète** (sinon un ajout écraserait l'existant).
- **D (ajout)** : formulaire d'un seul élément → POST. `WindowEditor` inclut une **sous-liste d'opérations** répétables (type, libellé, jour, intrants) capturées à la création.
- **E (relation)** : liste déroulante peuplée par le catalogue (zones / ravageurs) reçu de la page serveur + champ(s) spécifiques (zone : `rating` adapté/marginal/déconseillé + justification ; ravageur : `susceptibility` + stades sensibles + méthodes de lutte) → PUT. Si le catalogue est **vide**, afficher « Créez d'abord une zone/un ravageur » + lien vers `/zones` ou `/pests`.

### 4.3 `api.ts` — fonctions de mutation
Ajouter celles qui manquent (chacune `throw new Error("API <status>")` sur `!res.ok`) :
`setRequirements`, `setPhenology`, `setNutrition`, `setYields`, `addWindow`, `addPrice`, `setZoneSuitability`, `setPestControl`.
Déjà présentes (vérifié dans `api.ts`) : `addVariety`, `publishCrop`, `createZone`, `createPest`, `getCrop`, `getCropHistory`, `listZones`, `listPests`, `listCrops`, `createCrop`.

## 5. Organisation des fichiers

```
apps/admin/src/
├── lib/api.ts                          # MODIFY: fonctions de mutation manquantes
└── app/crops/[id]/
    ├── page.tsx                        # MODIFY: fetch catalogues + composer les éditeurs
    └── editors/                        # NEW
        ├── EditorShell.tsx
        ├── PublishButton.tsx
        ├── RequirementsEditor.tsx
        ├── PhenologyEditor.tsx
        ├── NutritionEditor.tsx
        ├── YieldsEditor.tsx
        ├── VarietyEditor.tsx
        ├── PriceEditor.tsx
        ├── WindowEditor.tsx
        ├── ZoneSuitabilityEditor.tsx
        └── PestControlEditor.tsx
```

## 6. Gestion d'erreur

Chaque `EditorShell` affiche le message d'erreur **inline** sans planter la page (ex. « API 409 » sur double-publication, « API 404 » si l'entité n'existe pas). Cohérent avec le formulaire de création actuel et le durcissement récent (tolérance au décalage de version).

## 7. Tests

Conforme au reste de l'app admin (pas de tests unitaires — le **build est la porte**) :
1. `pnpm --filter @okko/admin build` doit réussir (type-check de toutes les pages/éditeurs).
2. **Vérification manuelle** : créer une culture, puis, sur son détail, exercer chaque éditeur (publier, renseigner climat/sol, ajouter variété/prix/fenêtre, éditer phénologie/nutrition/rendement, rattacher une zone et un ravageur) et confirmer que la valeur apparaît après `router.refresh()` et que le **pourcentage de complétude** grimpe.

## 8. Critères de succès

- [ ] Depuis `/crops/[id]`, chacune des 11 catégories peut être renseignée/complétée sans quitter la page.
- [ ] Après une soumission réussie, la donnée apparaît (via `router.refresh()`) et la complétude est mise à jour.
- [ ] Les erreurs API (409, 404, 4xx/5xx) s'affichent inline sans planter la page.
- [ ] Les éditeurs de relation (zones/ravageurs) se peuplent depuis les catalogues et guident vers `/zones`/`/pests` si vides.
- [ ] `next build` réussit ; le read-only reste rendu côté serveur.
- [ ] Aucune dépendance nouvelle ; aucun changement backend.

## 9. Questions ouvertes (à trancher au plan)
- Faut-il un éditeur de **nom/metadata** (PATCH /crops/:id) dans ce lot, ou différé ? (proposé : différé.)
- `EditorShell` : composant unique paramétré, ou hook + petit wrapper ? (à trancher à l'implémentation ; l'objectif est la factorisation du toggle/erreur/refresh.)

---

## Références
- Endpoints consommés : voir le contrôleur `apps/api/src/presentation/crop/crop.controller.ts` (Plans 1-7).
- Patron admin existant : `apps/admin/src/app/crops/new/page.tsx` (Client Component + erreur inline) et `apps/admin/src/app/crops/[id]/page.tsx` (Server Component en lecture).
