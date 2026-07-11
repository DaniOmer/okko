# Spec — Itinéraire technique / fenêtres de production — D1

**Projet** : Okko — API (NestJS) + admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Refondre la fenêtre de production et son itinéraire technique : un **timing clair relatif au semis** (J0 = semis, opérations avant/après en J±n), une **fenêtre de semis en dates**, une **liste d'opérations complétée**, et l'**édition** d'une fenêtre (reportée de la Brique 3).

Référence backlog : `docs/2026-07-11-backlog-retours-usage.md` (§D1).

## 2. Contexte (vérifié)

- **`CroppingWindow`** (table Prisma) : `id, cropId, zoneId, season, sowingStart?, sowingEnd?` (colonnes `String`), `irrigationRequired`, `operations` (**JSON**), `notes?`.
- **`TechnicalOperation`** (JSON) : `type` (`OperationType`), `label` (multilingue), `timingDays` (number), `inputs[]`, `notes?`.
- `OperationType` = CLEARING, NURSERY, PLANTING, FERTILIZATION, WEEDING, PEST_CONTROL, HARVEST, OTHER (8).
- `SEASONS` (admin) = Saison des pluies / Saison sèche / Contre-saison (**gardées**).
- Fenêtre en **append-only** : `CroppingWindowAdded` (pas d'événement de mise à jour). Repo `save` = **upsert par id**. Le flux d'événements et la DB de dev sont **vides** → **pas d'upcasting**.
- Décisions brainstorming : timing **J±n depuis le semis** ; fenêtre de semis en **dates complètes affichées jour-mois** (année ignorée) ; **4 nouvelles opérations** ; **3 saisons gardées**.
- ⚠️ La suite de tests API **efface la DB de dev** — prévenir.

## 3. Périmètre

### Dans le lot
- **Timing** : sémantique explicite `timingDays` = jours / semis (J0), **négatif autorisé** (avant semis) ; itinéraire **trié par `timingDays`** à l'affichage.
- **Fenêtre de semis** : `sowingStart`/`sowingEnd` saisis via **sélecteurs de date** (natifs), stockés `yyyy-MM-dd`, affichés **jour-mois** (sans année).
- **Opérations** : `OperationType` gagne `SEED_TREATMENT`, `TRANSPLANTING`, `THINNING`, `EARTHING_UP` (+ libellés FR).
- **Édition** : `CroppingWindowUpdated` + `UpdateCroppingWindowUseCase` + `PUT /crops/:id/windows/:windowId` (404 si absent) ; mode édition admin.
- **Affichage** : itinéraire trié `J{±n} — libellé (type)`, repère « J0 · Semis », fenêtre de semis jour-mois, bouton « Modifier » par fenêtre.

### Hors périmètre
- Capturer `inputs` / notes **par opération** dans l'UI (non demandé — reste `inputs: []`).
- Jour-mois strict sans année (composant sur-mesure) ; validation **dure** de collision.
- **Migration** (JSON / colonnes String inchangées) ; **upcasting** (flux vide).
- Refontes D3/D4, vue client F1.

### Comportement préservé
- Ajout d'une fenêtre : conservé (avec dates + nouveaux types). Validation zone existante (add **et** update).
- Publication/complétude (catégorie `windows` = présence d'au moins une fenêtre) : inchangée.
- Autres sections : inchangées.

## 4. Architecture — API

### 4.1 `OperationType` — `apps/api/src/domain/window/operation-type.ts`
Ajouter (ordre agronomique) : après `CLEARING` → `SEED_TREATMENT` ; après `NURSERY` → `TRANSPLANTING` ; après `WEEDING` → `THINNING`, `EARTHING_UP`. (L'ordre d'énumération est cosmétique ; l'affichage suit `OPERATION_TYPE_LABELS`.) Valeurs string identiques au nom.

### 4.2 Timing
Aucun changement de modèle : `timingDays: number` accepte déjà les négatifs. La sémantique (J0 = semis, négatif = avant) est portée par l'UI et l'affichage (§5). Le tri est fait **à l'affichage** (pas de tri imposé au stockage) pour ne pas surcharger le domaine.

### 4.3 Édition de fenêtre
- **Événement** (`crop-event.ts`) : `| { type: 'CroppingWindowUpdated'; window: CroppingWindowSnapshot }`.
- **Domaine** (`crop.ts`) : `updateCroppingWindow(w: CroppingWindowSnapshot): void { this.raise({ type: 'CroppingWindowUpdated', window: w }); }` ; `apply` : `case 'CroppingWindowUpdated': this._windows = this._windows.map((x) => x.id === e.window.id ? e.window : x); this._hasUnpublishedChanges = true; break;`.
- **Use-case** `UpdateCroppingWindowUseCase` (miroir de l'ajout, sans `IdGenerator`) : charge les événements (`CropNotFoundError` si vide) ; valide la zone (`ZoneNotFoundError`) ; **`CroppingWindowNotFoundError`** si `windowId` absent de `crop.windows` ; construit le snapshot avec l'id fourni ; `crop.updateCroppingWindow(snap)` ; append ; `windows.save(snap)` (upsert par id) ; audit.
- **Endpoint** (`crop.controller.ts`) : `PUT /crops/:id/windows/:windowId`, corps identique à l'ajout (`{ zoneId, season, sowingStart?, sowingEnd?, irrigationRequired?, operations?, notes? }`). `mapCropError` : `CroppingWindowNotFoundError → NotFoundException (404)` (la `ZoneNotFoundError` est déjà mappée). Provider câblé dans le module.

### 4.4 Tests (TDD)
- `update-cropping-window.use-case.spec` : met à jour par id (même count, nouvelles valeurs dont opérations et dates) ; id absent → `CroppingWindowNotFoundError` ; zone absente → `ZoneNotFoundError`.
- e2e : `POST` fenêtre → `PUT /crops/:id/windows/:wid` → `GET` reflète ; `PUT` id absent → 404.
- Non-régression : l'ajout de nouveaux `OperationType` n'invalide pas les envois existants (`PLANTING`, etc.) ; les e2e/helper fenêtre restent verts.

## 5. Architecture — Admin

### 5.1 `labels.ts`
- `OPERATION_TYPE_LABELS` gagne : `SEED_TREATMENT: 'Traitement de semences'`, `TRANSPLANTING: 'Repiquage / transplantation'`, `THINNING: 'Démariage / éclaircissage'`, `EARTHING_UP: 'Buttage / billonnage'` (aux bonnes positions).

### 5.2 `lib/api.ts`
- `addWindow` inchangé ; ajouter `updateWindow(cropId, windowId, body)` (`PUT /crops/:id/windows/:windowId`, corps identique à `addWindow`).
- Type `CroppingWindow` inchangé (déjà `sowingStart?`/`sowingEnd?`, `operations`).

### 5.3 `WindowEditor.tsx` — dates, J±, tri, mode édition
- **Fenêtre de semis** : `sowingStart`/`sowingEnd` via `DatePicker` (natif). Libellé « Fenêtre de semis (début / fin) ».
- **Itinéraire** : chaque opération a **type** (`OPERATION_TYPE_LABELS` complété), **libellé**, et **`J±`** (jours / semis) — l'input accepte les **négatifs** (avant semis) ; aide « J0 = semis ; négatif = avant ». Un « × » retire une ligne. Les lignes restent en **ordre de saisie dans l'éditeur** (l'édition se fait par index — les trier casserait la saisie) ; le **tri par `timingDays` est fait à l'affichage** (§5.4).
- **Mode édition** : prop `initial?` (la fenêtre existante) → label « Modifier », champs (zone, saison, dates, irrigation, opérations) pré-remplis, soumission `updateWindow(cropId, initial.id, …)` ; sinon ajout (`addWindow`, avec reset). Bouton `{editing ? 'Enregistrer' : 'Ajouter'}`.

### 5.4 `page.tsx` & `CropReadView.tsx`
- Afficher par fenêtre : **saison**, **fenêtre de semis** en jour-mois (`sowingStart`/`sowingEnd` → « 15 juin → 30 juin », un helper de format jour-mois), **irrigation**, puis l'**itinéraire trié par `timingDays`** : ligne « J{±n} — {op.label.fr} ({type}) », avec un repère **« J0 · Semis »** inséré à la position 0. Bouton **« Modifier »** par fenêtre (mode édition).

## 6. Gestion d'erreur
- `PUT` fenêtre : crop/zone/fenêtre inexistants → 404 (`CropNotFoundError`/`ZoneNotFoundError`/`CroppingWindowNotFoundError`). `timingDays` négatif = valide (avant semis).

## 7. Vérification
- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir).
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke : ajouter une fenêtre avec fenêtre de semis (dates), des opérations avant (J-) et après (J+) le semis, des nouveaux types ; l'itinéraire s'affiche trié avec « J0 · Semis » ; « Modifier » une fenêtre pré-remplit et enregistre ; affichage jour-mois.

## 8. Critères de succès
- [ ] `timingDays` = J / semis (négatif = avant) ; itinéraire trié à l'affichage.
- [ ] Fenêtre de semis en `DatePicker` ; affichage jour-mois (sans année).
- [ ] 4 nouveaux `OperationType` + libellés FR.
- [ ] Édition : `CroppingWindowUpdated` + `UpdateCroppingWindowUseCase` + `PUT /crops/:id/windows/:windowId` (404) ; mode édition admin.
- [ ] Affichage retravaillé (saison, semis jour-mois, itinéraire trié, repère J0, bouton Modifier).
- [ ] Suite API verte ; build admin vert. Pas de migration ; ajout inchangé ; hors-périmètre respecté.

## Références
- Backlog : `docs/2026-07-11-backlog-retours-usage.md` (§D1).
- API : `src/domain/window/{cropping-window,technical-operation,operation-type}.ts`, `src/domain/crop/{crop-event,crop}.ts`, `src/application/window/{add-cropping-window,update-cropping-window}.use-case.ts`, `src/presentation/crop/crop.controller.ts`, `src/crop.module.ts`.
- Admin : `src/lib/labels.ts`, `src/lib/api.ts`, `src/app/crops/[id]/editors/WindowEditor.tsx`, `src/app/crops/[id]/page.tsx`, `src/app/crops/[id]/CropReadView.tsx`, `src/lib/format.ts` (helper jour-mois).
- Tests : `apps/api/test/window.e2e-spec.ts`, `crop-sections-event-sourcing.e2e-spec.ts`, `helpers/complete-crop.ts`.
