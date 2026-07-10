# Spec — Sécurité éditoriale : brouillon / publié (Lot B, socle)

**Projet** : Okko — base de connaissances
**Date** : 2026-07-09
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Poser la **sécurité éditoriale** de la Culture : pouvoir retravailler une fiche déjà publiée **sans que les modifications soient visibles** tant qu'elles ne sont pas republiées. Une fiche possède désormais une **version publiée** (figée, ce que les lecteurs voient) et un **brouillon de travail** (la tête du flux d'événements, éditable). « Publier » promeut le brouillon en nouvelle version publiée ; « Abandonner » jette les modifications non publiées et ramène le brouillon à la version publiée.

Ce lot s'appuie sur le socle event sourcing déjà en place : l'agrégat `Crop` (cœur **et** les 5 sections) se reconstruit intégralement par repli des événements. C'est ce qui rend « figer une version publiée » et « revenir au publié » naturels.

**Décision d'architecture actée avec le porteur (brainstorming 2026-07-09) :**
- **Motivation n°1** : sécurité éditoriale (et non traçabilité, rollback ou diff — surcouches différées).
- **Lecture** : toujours la dernière version **publiée** ; le brouillon n'est visible que dans l'écran d'édition de l'admin.
- **Périmètre** : **brique minimale** — brouillon/publié uniquement. Consulter l'historique des versions, restaurer une version passée, diff sémantique → **briques ultérieures**.
- **Cycle de brouillon** : **implicite** (éditer une fiche publiée accumule des modifications non publiées) + boutons **Publier** / **Abandonner**.
- **Approche de représentation** : **snapshot publié figé** (approche 2) — un flux unique, source de vérité ; la version publiée est figée dans une projection dédiée.
- **Mécanique d'abandon** : événement `DraftDiscarded` **sans payload** + point de contrôle re-dérivé au repli (bonne pratique : ne pas stocker de donnée dérivable dans un événement).

## 2. Périmètre

### Dans le lot
- **Projection publiée** : nouvelle table `PublishedCrop` figeant le **document composé complet** (cœur + 5 sections) à la publication.
- **Nouvel événement** `DraftDiscarded` + **point de contrôle publié** interne à l'agrégat `Crop`.
- **Drapeau dérivé** `hasUnpublishedChanges` (et `hasPublishedVersion`) exposé sur le document brouillon.
- **`publish-crop`** (existant) enrichi : fige `PublishedCrop` en plus de sa logique actuelle.
- **`discard-draft`** (nouveau use-case) : abandonne le brouillon, reconstruit les projections (cœur + sections) à l'état publié.
- **Deux endpoints** : `GET /crops/:id/published` (lecture figée) et `POST /crops/:id/discard` (abandon).

### Hors périmètre (briques suivantes)
- **Historique des versions** (lister/consulter les versions publiées passées) → brique ultérieure. La table `PublishedCrop` est conçue pour l'accueillir (passage d'une ligne par culture à plusieurs).
- **Restaurer** une version antérieure dans le brouillon → différé.
- **Diff sémantique** entre versions → différé.
- **Numéro de révision publiée** distinct du compteur `version` actuel → différé (appartient à la brique historique).
- **Raffiner « archivé = masqué du public »** → différé.
- Bascule de la **lecture par défaut** (`GET /crops/:id`) sur le publié → différée à l'arrivée de l'API publique (le stockage figé et les mécaniques sont posés dès maintenant).

## 3. Comportement préservé & changements assumés

**Préservé :**
- `GET /crops` et `GET /crops/:id` restent branchés sur le **brouillon/tête** : l'admin continue de voir son travail et de lister toutes les fiches (brouillons compris). **Aucun changement de branchement.**
- **Statut** : enum `DRAFT/PUBLISHED/ARCHIVED` inchangé. Éditer une fiche `PUBLISHED` la laisse `PUBLISHED` (comme aujourd'hui). **Amendement (2026-07-10, Lot B)** : on ajoute la transition `PUBLISHED→PUBLISHED` (`ALLOWED[PUBLISHED] = [PUBLISHED, ARCHIVED]`) pour permettre de **republier** (re-figer sur place) une fiche déjà publiée — c'est le cœur de la boucle éditoriale et sans elle la version publiée ne pourrait jamais être mise à jour.
- **`version`** : sémantique inchangée (compteur de mutations de contenu). Aucun « numéro de révision publiée » introduit ici.
- Édition en place, validation de publication (transition + complétude), `AuditLog` : **intacts**.

**Changements assumés (brique fonctionnelle, pas refactor pur) :**
- Deux champs **additifs** sur le document brouillon : `hasUnpublishedChanges: boolean`, `hasPublishedVersion: boolean`. Les documents existants gardent tous leurs champs.
- Quelques specs existantes qui asservissent la **forme exacte** du document (read-model, e2e crop) seront **complétées** de ces 2 champs. Ce n'est donc pas « aucune modif de test » — c'est « ajout de 2 champs, comportement existant préservé ».

## 4. Architecture

### 4.1 Deux vues dérivées du même flux

| Vue | Contenu | Sert | Support |
|---|---|---|---|
| **Brouillon** (= tête du flux) | l'état courant, éditions comprises | l'écran d'édition admin | projection actuelle (`Crop` + tables de section), inchangée |
| **Publié** (figé) | le document composé à la dernière publication | lecteurs / future API publique | **nouvelle table `PublishedCrop`** |

### 4.2 Table `PublishedCrop` (projection publiée)

`{ cropId (clé), document Json, version Int, publishedAt, publishedBy }`

- `document` = le **document composé complet et figé** (cœur + 5 sections) tel que renvoyé par `composeCropDocument` au moment du `Publier`.
- **Une ligne par culture** dans cette brique. La future brique *historique* passera à plusieurs lignes/versions — d'où le choix d'une table dédiée dès maintenant.
- Immuable jusqu'à la prochaine publication (qui l'écrase). L'abandon n'y touche pas.
- **Choix assumé** : blob document composé (pas une reprojection normalisée). Redondance volontaire avec les tables normalisées — principe d'un snapshot figé ; rend la lecture publiée triviale (on renvoie le JSON tel quel).

### 4.3 Agrégat `Crop` — point de contrôle publié

Le flux reste la source de vérité. Deux ajouts :

- **Nouvel événement** `DraftDiscarded` (sans payload). `Published` existe déjà et son sens s'enrichit : il marque le point où la tête a été figée.
- **Point de contrôle publié** interne : pendant le repli (`fromEvents`), à chaque `Published` appliqué, l'agrégat mémorise une **copie profonde de son état complet** (cœur + les 5 collections de sections) dans un champ privé `_publishedCheckpoint`.
  - `DraftDiscarded` appliqué → l'agrégat **restaure** cet état depuis `_publishedCheckpoint` (la tête redevient identique au dernier publié).
  - Les événements restent **sans payload lourd** ; toute la logique de re-base vit dans l'agrégat (un seul endroit).
  - **Déterministe** : rejouer le même flux recrée le point de contrôle (ré-application de `Published`) puis le restaure — même résultat à chaque repli.

- **Drapeau dérivé `hasUnpublishedChanges`** : `true` dès qu'un événement de **contenu** (requirements, phénologie, nutrition, rendements, rename, metadata, + ajouts/upserts de section) est appliqué **après** le dernier `Published` ; `false` juste après `Published` ou `DraftDiscarded`. Pur dérivé du repli — aucun champ persistant à maintenir.

- **Invariants nouveaux :**
  - `discardDraft()` lève une erreur si aucun `Published` n'a jamais eu lieu (rien vers quoi revenir).
  - `publish()` conserve **toute** sa validation actuelle (transition de statut + complétude).

- **Inchangé** : `toSnapshot()`/`fromSnapshot()` cœur, sémantique de `version`, `pullPendingEvents`, les 5 mutations de section. `_publishedCheckpoint` et `hasUnpublishedChanges` sont de l'état **dérivé du repli**, hors du snapshot cœur.

### 4.4 Use-cases

**`publish-crop` (existant, enrichi)** — garde sa validation actuelle. Après `Published` et rafraîchissement de la projection brouillon : compose le document complet (`composeCropDocument`) et **upsert** dans `PublishedCrop`. `hasUnpublishedChanges → false`.

**`discard-draft` (nouveau)** :
```
stored = eventStore.load(id)
if (stored.length === 0) throw CropNotFoundError
crop = Crop.fromEvents(stored)
crop.discardDraft()                       // lève si jamais publié ; sinon raise(DraftDiscarded) + restaure le checkpoint
eventStore.append(id, stored.length, [{ event: DraftDiscarded, actor, at }])
// reconstruire la projection brouillon à l'état publié :
crops.save(crop.toSnapshot())             // cœur
// remplacer les lignes de section de la culture par celles du checkpoint :
varieties.replaceForCrop(id, crop.varieties)
windows.replaceForCrop(id, crop.windows)
zones.replaceForCrop(id, crop.zones)
pests.replaceForCrop(id, crop.pests)
prices.replaceForCrop(id, crop.prices)
audit.record(...)
return <document brouillon reconstruit>
```

> **Conséquence à assumer** : l'abandon doit **rebâtir les projections normalisées de section** de la culture. Chaque repo de section doit savoir « remplacer toutes les lignes d'une culture par cette liste » (`replaceForCrop` = delete-for-crop + insert). C'est le seul vrai morceau de plomberie nouveau de la brique. (Vérifier au plan quels repos exposent déjà une opération équivalente.)

### 4.5 Endpoints

| Méthode | Route | Rôle | État |
|---|---|---|---|
| `GET` | `/crops` | liste (brouillon/tête), + drapeaux | inchangé (drapeaux additifs) |
| `GET` | `/crops/:id` | fiche de travail (brouillon/tête), + drapeaux | inchangé (drapeaux additifs) |
| `POST` | `/crops/:id/publish` | publier (fige désormais `PublishedCrop`) | signature inchangée |
| `GET` | `/crops/:id/published` | **version figée** (lecteur/prévisualisation), 404 si jamais publiée | **nouveau** |
| `POST` | `/crops/:id/discard` | abandonner le brouillon, revenir au publié | **nouveau** |

Drapeaux ajoutés au document brouillon (`GET /crops/:id` et la liste) : `hasUnpublishedChanges`, `hasPublishedVersion` — pour le badge « modifs non publiées » et l'activation de **Publier** / **Abandonner**.

## 5. Gestion d'erreur
- Culture introuvable (flux vide) → `CropNotFoundError` → 404 (inchangé).
- `GET /crops/:id/published` sur une fiche jamais publiée → **404**.
- `POST /crops/:id/discard` sans version publiée → erreur domaine dédiée → **409** (ou 422 ; à fixer au plan, cohérent avec le mappage existant).
- Concurrence optimiste (`append`) → `ConcurrencyError` → 409 (inchangé).

## 6. Tests (TDD, rouge d'abord)

**Domaine** (`crop.events.spec.ts` / nouveaux) :
- `Published` pose le point de contrôle ; éditer après `Published` met `hasUnpublishedChanges=true`.
- `DraftDiscarded` restaure cœur **+ sections** et remet le drapeau à `false`.
- `discardDraft()` lève si jamais publié.
- **Déterminisme du repli** : `[Created, éditions, Published, éditions, DraftDiscarded]` ⟶ état == état au `Published` (cœur + sections).

**Use-cases** (unit, in-memory) :
- `publish` fige `PublishedCrop` avec le document composé ; drapeau `false` après.
- éditer après publication → brouillon diverge, projection publiée **inchangée**, drapeau `true`.
- `discard` → projections cœur + section reviennent au publié ; drapeau `false`.
- `discard` sans publié → erreur.

**e2e** (`crop-versioning.e2e-spec.ts`, nouveau) :
- publier fige ; `GET /crops/:id/published` renvoie le document figé.
- éditer un champ → `GET /crops/:id` (brouillon) montre la modif, `/published` reste figé, `hasUnpublishedChanges=true`.
- republier met à jour le figé.
- **abandonner** ramène le brouillon (y compris une section) au publié.
- abandonner sans publié → 4xx ; `GET .../published` sur fiche jamais publiée → 404.
- e2e existants verts (avec les 2 champs additifs intégrés).

## 7. Critères de succès
- [ ] Table `PublishedCrop` + adaptateur ; `publish` fige le document composé.
- [ ] Agrégat : `DraftDiscarded`, point de contrôle publié re-dérivé, `hasUnpublishedChanges`, invariant « abandon interdit sans publié ».
- [ ] Use-case `discard-draft` + reconstruction des projections cœur + section (`replaceForCrop`).
- [ ] Endpoints `GET /crops/:id/published` et `POST /crops/:id/discard`.
- [ ] Drapeaux `hasUnpublishedChanges` / `hasPublishedVersion` sur le document brouillon.
- [ ] Suite API entière verte (specs existantes complétées des 2 champs additifs, comportement préservé).
- [ ] Historique / restauration / diff **non** inclus (briques suivantes).

## 8. Notes de découpage (pour le plan)
Ordre TDD suggéré :
1. **Agrégat** : `DraftDiscarded` + point de contrôle + `hasUnpublishedChanges` + invariant (specs d'équivalence/déterminisme du repli). Suite verte.
2. **Projection publiée** : table `PublishedCrop` + adaptateur ; enrichir `publish-crop` pour figer le document composé (+ specs use-case). Suite verte.
3. **Abandon** : `replaceForCrop` sur les repos de section (là où absent) + use-case `discard-draft` + DI + mappage erreur. Suite verte.
4. **Endpoints** : `GET /crops/:id/published`, `POST /crops/:id/discard` ; drapeaux additifs sur le document brouillon ; compléter les specs existantes. Suite verte.
5. **e2e** `crop-versioning.e2e-spec.ts` (parcours complet publier/éditer/republier/abandonner + 404/4xx).

## Références
- Agrégat : `apps/api/src/domain/crop/crop.ts` (mutations, `apply`, `fromEvents`, `pullPendingEvents`, collections de section).
- Statut : `apps/api/src/domain/crop/crop-status.ts`.
- Use-case publication : `apps/api/src/application/crop/publish-crop.use-case.ts` (`CropNotFoundError`).
- Composition du document : `composeCropDocument` / `toCropDocument`.
- Event store : `apps/api/src/application/crop/crop-event-store.ts` (`append`, `load`, `ConcurrencyError`).
- Schéma : `apps/api/prisma/schema.prisma` (modèles `Crop`, `CropEvent`, tables de section).
- Amont : specs Lot A (`2026-07-06-event-sourcing-crop-lot-a-design.md`) et sections (`2026-07-06-event-sourcing-crop-sections-design.md`).
