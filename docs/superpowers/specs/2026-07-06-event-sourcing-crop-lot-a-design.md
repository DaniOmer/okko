# Spec — Event Sourcing du cœur Culture (Lot A : fondation)

**Projet** : Okko — base de connaissances
**Date** : 2026-07-06
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Poser le **socle event sourcing** de l'agrégat Culture, **sans aucun changement de comportement visible**. Aujourd'hui chaque mutation du `Crop` incrémente un compteur et écrase un snapshot en base. Après ce lot, chaque mutation **émet un événement** dans un flux append-only (un flux par culture) ; l'état de l'agrégat se **reconstruit par repli** des événements ; la table `Crop` actuelle devient une **projection** (cache de lecture). C'est le prérequis des lots suivants (brouillon/publication/versions, diff sémantique).

Décision d'architecture actée avec le porteur : **event sourcing** (et non snapshots), **foundation-first**, **départ à neuf** (base vide, aucune migration), **cœur de l'agrégat `Crop` uniquement** — les sections séparées (variétés, fenêtres, zones, ravageurs, prix) restent des agrégats CRUD et entreront dans le flux d'événements dans un lot ultérieur, avant la finalisation du versionnage.

## 2. Périmètre

### Dans le lot
- **Modèle d'événements** de la Culture (union discriminée `CropEvent`).
- **Event store** append-only : table `CropEvent`, port `CropEventStore` (append avec concurrence optimiste + load ordonné), adaptateurs in-memory (tests) et Prisma.
- **Agrégat `Crop`** enrichi : `apply(event)` (repli privé), `static fromEvents(events)`, tampon d'événements non-commités + `pullPendingEvents()`. Les mutations existantes **émettent un événement** au lieu de muter directement.
- **Réécriture des use-cases cœur** pour event-sourcer : create, set-requirements (climat/sol), set-phenology, set-nutrition, set-yields, update (rename/metadata), publish, archive.
- **Projection** : la table `Crop` (via `CROP_REPOSITORY`) est reconstruite après chaque append, de sorte que `findById`/`list` renvoient **le même `CropSnapshot`** qu'aujourd'hui et que `toCropDocument` est inchangé.

### Hors périmètre (lots suivants)
- Sections séparées (variétés/fenêtres/zones/ravageurs/prix) dans le flux d'événements → **lot ultérieur**.
- Brouillon / publication versionnée / historique de versions / republier / diff sémantique → **Lots B, C**.
- Rechargement d'une ancienne version dans le brouillon → **différé**.
- Suppression de l'`AuditLog` : **non** — il est conservé tel quel (redondant avec les événements, mais on ne le touche pas ici).
- Migration de données : **aucune** (base vide).

## 3. Comportement préservé (le « zéro changement visible »)

- `GET /crops`, `GET /crops/:id` et tous les endpoints de mutation renvoient exactement les mêmes documents qu'avant.
- **Sémantique du champ `version`** : inchangée. `create` → `version = 1`. Les mutations de **contenu** (requirements, phenology, nutrition, yields, rename, metadata) font `version += 1`. `publish` et `archive` **ne changent pas** `version` (comme aujourd'hui). → Les tests existants passent à l'identique.
- **Séquence d'événements** : notion **distincte** du `version` domaine. La séquence est la position 1..N de l'événement dans le flux (tous les événements comptent, y compris `Published`/`Archived`). Elle sert à l'ordre et à la **concurrence optimiste**, pas à l'affichage.

## 4. Architecture

### 4.1 Modèle d'événements — `domain/crop/crop-event.ts`
Union discriminée. Chaque événement porte son `type` et son `payload` (données métier), sans champs d'enveloppe (l'enveloppe — streamId, sequence, actor, at — est ajoutée par le store).

```ts
export type CropEvent =
  | { type: 'CropCreated'; commonNames: Record<string,string>; scientificName: string; family: string; cycleType: CycleType }
  | { type: 'Renamed'; commonNames: Record<string,string> }
  | { type: 'MetadataSet'; key: string; value: unknown }
  | { type: 'ClimaticRequirementsSet'; climatic: ClimaticRequirementsJSON }
  | { type: 'EdaphicRequirementsSet'; edaphic: EdaphicRequirementsJSON }
  | { type: 'PhenologySet'; phenology: PhenologicalStageJSON[] }
  | { type: 'NutritionSet'; nutrition: NutrientRequirementJSON[] }
  | { type: 'YieldsSet'; yields: YieldReferenceJSON[] }
  | { type: 'Published' }
  | { type: 'Archived' };
```

### 4.2 Event store — `application/crop/crop-event-store.ts`
Enveloppe persistée : `StoredCropEvent = { streamId: string; sequence: number; event: CropEvent; actor: string; at: string }`.

```ts
export const CROP_EVENT_STORE = Symbol('CROP_EVENT_STORE');
export class ConcurrencyError extends Error { /* attendu vs réel */ }
export interface CropEventStore {
  // expectedSequence = dernière séquence connue (0 pour un flux neuf).
  // Rejette (ConcurrencyError) si la séquence courante du flux ≠ expectedSequence.
  append(streamId: string, expectedSequence: number, events: { event: CropEvent; actor: string; at: string }[]): Promise<void>;
  load(streamId: string): Promise<StoredCropEvent[]>; // ordonné par sequence croissante
}
```
- **Table Prisma `CropEvent`** : `{ id, streamId, sequence Int, type, payload Json, actor, at }`, `@@unique([streamId, sequence])` (garantit la concurrence optimiste au niveau base), `@@index([streamId])`.
- Adaptateur **in-memory** (tests) + **Prisma**.

### 4.3 Agrégat `Crop`
- Constructeur privé inchangé. Ajout d'un tampon privé `_pending: CropEvent[]`.
- **Mutations** : au lieu de modifier l'état + `_version += 1` directement, chaque mutation valide ses invariants puis appelle `this.raise(event)`. `raise` **applique** l'événement à l'état (via `apply`) **et** l'ajoute à `_pending`.
- `private apply(e: CropEvent): void` — le **seul** endroit qui modifie l'état (fold) : `CropCreated` initialise ; `ClimaticRequirementsSet`/… posent le champ + `_version += 1` ; `Published`/`Archived` changent `_status` **sans** toucher `_version`.
- `static fromEvents(stored: StoredCropEvent[]): Crop` — crée une instance vide puis `apply` chaque événement dans l'ordre (sans remplir `_pending`).
- `pullPendingEvents(): CropEvent[]` — renvoie et vide `_pending`.
- `toSnapshot()` / `fromSnapshot()` : **conservés** (utilisés par la projection). Les invariants de transition de statut (`assertCanTransition`) restent appliqués dans `publish()`/`archive()` **avant** `raise`.

### 4.4 Use-cases (patron réécrit)
Patron unique (exemple sur les requirements) :
```
load = eventStore.load(id)              // -> StoredCropEvent[]
if (load.length === 0) throw CropNotFoundError
crop = Crop.fromEvents(load)
crop.setClimaticRequirements(...)        // -> raise(ClimaticRequirementsSet)
newEvents = crop.pullPendingEvents()
expectedSequence = load.length           // dernière séquence connue
eventStore.append(id, expectedSequence, newEvents.map(e => ({ event: e, actor, at: clock.nowIso() })))
crops.save(crop.toSnapshot())            // rafraîchit la projection
audit.record(...)                        // conservé
return crop.toSnapshot()
```
- **create** : pas de load ; `Crop.create(...)` émet `CropCreated` ; `append(id, 0, …)` ; save projection.
- **publish/archive** : la validation de transition reste dans la mutation ; émet `Published`/`Archived`.
- `CropNotFoundError` (déjà défini dans `publish-crop.use-case.ts`) : levé si `load` est vide.

### 4.5 Projection
La table `Crop` reste une **projection** dérivée : après chaque `append`, le use-case appelle `crops.save(crop.toSnapshot())`. `findById`/`list` lisent la projection (inchangés). L'event store est la **source de vérité** ; la projection est un cache reconstructible. (Un rebuild complet depuis les événements n'est pas requis dans ce lot, mais l'architecture le permet.)

## 5. Gestion d'erreur
- Culture introuvable (flux vide) → `CropNotFoundError` → 404 (inchangé).
- Transition de statut illégale → `CropStatusError` → 409 (inchangé).
- Conflit de concurrence (`expectedSequence` périmé / violation d'unicité `(streamId, sequence)`) → `ConcurrencyError`. Mappage HTTP : **409** (nouveau cas ; improbable en admin mono-utilisateur mais correct).

## 6. Tests
- **Non-régression** : **toute la suite crop existante passe sans modification** (comportement identique). C'est le critère de sûreté nº 1.
- **Nouveaux (TDD)** :
  - Event store : `append` puis `load` renvoie les événements ordonnés ; `append` avec `expectedSequence` périmé → `ConcurrencyError` ; deux flux (`streamId`) indépendants.
  - Agrégat : chaque mutation émet **le** bon événement (`pullPendingEvents`) ; `fromEvents` produit un `toSnapshot()` **identique** à la même séquence de mutations sur `Crop.create` (équivalence repli ≡ état) ; `version` suit la sémantique de la §3 (contenu +1, publish/archive +0) ; `apply(Published)` respecte `assertCanTransition`.
  - Use-cases : après exécution, l'event store contient l'événement attendu **et** la projection reflète le nouvel état.
- e2e existants (`crop.e2e-spec.ts`, etc.) restent verts.

## 7. Critères de succès
- [ ] Table `CropEvent` + `CropEventStore` (port, in-memory, Prisma) avec concurrence optimiste.
- [ ] `Crop` : `apply`/`fromEvents`/`raise`/`pullPendingEvents` ; mutations émettent des événements ; `version` sémantique préservée.
- [ ] Tous les use-cases cœur event-sourcés ; projection `Crop` rafraîchie après append.
- [ ] **Suite API entière verte, sans modifier les tests existants** ; documents et endpoints inchangés.
- [ ] Aucune fonctionnalité visible ajoutée (socle uniquement) ; sections & versionnage hors périmètre.

## 8. Notes de découpage (pour le plan)
Ordre TDD suggéré : (1) modèle d'événements + `apply`/`fromEvents`/`raise`/`pullPendingEvents` sur `Crop` (specs d'équivalence) ; (2) port `CropEventStore` + in-memory + specs (ordre, concurrence) ; (3) table Prisma `CropEvent` + adaptateur Prisma + migration ; (4) réécriture des use-cases cœur un par un (projection + audit conservés), suite verte après chaque ; (5) mappage `ConcurrencyError` → 409 + câblage DI. Chaque tâche garde la suite existante verte.

## Références
- Agrégat : `apps/api/src/domain/crop/crop.ts` (mutations, `toSnapshot`/`fromSnapshot`).
- Port projection : `apps/api/src/application/crop/crop.repository.ts`.
- Use-cases cœur : `application/crop/{create-crop,set-crop-requirements,set-crop-phenology,set-crop-nutrition,set-crop-yields,update-crop,publish-crop}.use-case.ts`.
- Schéma : `apps/api/prisma/schema.prisma` (modèle `Crop`, `AuditLog`).
- Décisions amont : brouillon séparé + historique complet + rollback (Lots B+), event sourcing complet, foundation-first, départ à neuf, cœur seulement.
