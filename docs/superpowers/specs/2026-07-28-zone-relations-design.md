# Zone agro-écologique — relations (Brique 2)

_Design validé en brainstorming le 2026-07-28._

## Contexte

La Brique 1 a enrichi la zone de champs descriptifs, mais (a) ces champs ne sont **affichés nulle
part** en lecture (zones = liste + modales d'édition seulement), et (b) la grille métier prévoit deux
relations N-N encore absentes : **cultures adaptées** et **bioagresseurs fréquents**. Cette Brique 2
ajoute une **fiche zone** `/zones/[id]` comme surface de lecture, la vue « cultures adaptées » (inverse
de l'existant) et la relation « bioagresseurs fréquents » (nouvelle).

Rappels d'infra : `CropZoneSuitability` (table de liaison culture↔zone, `listByZone(zoneId)` déjà
disponible) porte l'aptitude d'une culture à une zone. `Pest` (« bioagresseur ») a un `kind`
(ANIMAL/DISEASE/WEED) pour le regroupement. Aucune relation zone↔bioagresseur n'existe.

## Décisions actées (brainstorming)

1. **Bioagresseurs fréquents = relation directe** (nouvelle table de liaison zone↔bioagresseur),
   éditable depuis la zone — connaissance régionale, indépendante des cultures.
2. **Le lien porte un niveau de fréquence** : `OCCASIONAL` / `FREQUENT` / `ENDEMIC`
   (Occasionnel / Fréquent / Endémique).
3. **Cultures adaptées = vue en lecture seule** (vue inverse de `CropZoneSuitability`) ; l'édition
   reste sur la fiche culture (source unique de vérité). Renvoi « modifier depuis la fiche culture ».
4. **Fiche zone `/zones/[id]`** = surface : lecture des champs descriptifs + les 2 relations.

## Relation `ZonePestPresence` (nouvelle)

Table de liaison **autonome** (mirroir de `CropZoneSuitability`/`CropPestControl` — **pas** sur
l'agrégat CRUD `AgroEcologicalZone`).

- **Prisma** `model ZonePestPresence { zoneId String; pestId String; frequency String; createdAt DateTime @default(now()); @@id([zoneId, pestId]); @@index([pestId]) }`.
- **Domaine** : entité `ZonePestPresence` (fichier `apps/api/src/domain/zone/zone-pest-presence.ts`)
  avec `create({ zoneId, pestId, frequency })`, getters, `toSnapshot()`, `fromSnapshot()`.
  `ZonePestPresenceSnapshot { zoneId; pestId; frequency }`. Le domaine ne valide pas l'énum `frequency`
  (contrainte portée par le Select admin, cohérent avec le reste).
- **Repository** `ZonePestPresenceRepository` (+ token + impl Prisma + in-memory) :
  `save(s)` (upsert par `(zoneId, pestId)`), `listByZone(zoneId)`, `listByPest(pestId)`,
  `delete(zoneId, pestId)`, `deleteByZone(zoneId)`.
- **Use-cases** :
  - `SetZonePestPresenceUseCase` : vérifie la zone (`ZoneRepository.findById` → `ZoneNotFoundError`)
    ET le bioagresseur (`PestRepository.findById` → erreur pest introuvable) ; `save` le lien ; audit
    `entityType: 'ZonePestPresence'`, `entityId: '${zoneId}:${pestId}'`, `changes: { set: snap }`.
  - `RemoveZonePestPresenceUseCase` : `delete(zoneId, pestId)` ; audit `changes: { removed }`.
  - `ListZonePestsUseCase` : `listByZone` + noms/kind des bioagresseurs (`PestRepository`) →
    `ZonePestView { pestId; pestName: Record<string,string>; kind: string; frequency: string }`.
- **API** (sous `ZoneController`, garde `superadmin`) :
  - `PUT /zones/:id/pests/:pestId` body `{ frequency: string }` → set (upsert).
  - `DELETE /zones/:id/pests/:pestId` (204) → remove.
  - `GET /zones/:id/pests` → `ZonePestView[]`.
- **Suppression de zone** : `DeleteZoneUseCase` appelle en plus `zonePests.deleteByZone(id)` (les liens
  sont possédés par la zone ; ils ne bloquent pas la suppression, contrairement aux cultures).

## Cultures adaptées (vue inverse, lecture seule)

- `ListZoneCropsUseCase` : `suitabilities.listByZone(zoneId)` + noms de cultures (`CropRepository` ou
  le read repo variétés/cultures) → `ZoneCropView { cropId; cropName: Record<string,string>; rating: string; justification?: string }`.
- **API** : `GET /zones/:id/crops` → `ZoneCropView[]`.
- Aucune écriture. (L'édition de l'aptitude reste `PUT /crops/:id/zones/:zoneId` côté culture.)

## Admin — fiche `/zones/[id]`

- **Page serveur** `apps/admin/src/app/zones/[id]/page.tsx` : `getZone(id)` (détail, déjà exposé par
  `GET /zones/:id`) + `getZoneCrops(id)` + `getZonePests(id)`.
- **Rendu** (`ZoneFicheView`) :
  - Héros : nom, pays, badge type de climat.
  - Sections descriptives **en lecture** (Identification / Climat / Saisons / Sols) — affiche les
    champs Brique 1 via les libellés (`CLIMATE_TYPE_LABELS`, `MONTH_LABELS`, `FERTILITY_LABELS`,
    `DRAINAGE_LABELS`) ; altitude/pluviométrie en `min–max`.
  - **Cultures adaptées** : liste lecture seule (nom + badge `SUITABILITY_RATING_LABELS` +
    justification), renvoi « Modifier depuis la fiche culture ». Vide → message.
  - **Bioagresseurs fréquents** : groupés par `kind` (Ravageurs / Maladies / Adventices), chaque ligne
    = nom + badge fréquence (`FREQUENCY_LABELS`) + bouton détacher (confirmation via `DeleteWithConfirm`
    existant) ; éditeur `ZonePestPresenceEditor` (Select bioagresseur non déjà lié + Select fréquence →
    `setZonePest`). `router.refresh()` après action.
- **Liste `/zones`** : le nom de la zone devient un lien vers `/zones/[id]` ; « Modifier » reste la
  modale existante.
- **Plomberie** : `api.ts` types `ZoneCropView`, `ZonePestView` ; actions `getZoneCrops(id)`,
  `getZonePests(id)`, `setZonePest(zoneId, pestId, frequency)`, `removeZonePest(zoneId, pestId)` ;
  libellé `FREQUENCY_LABELS = { OCCASIONAL: 'Occasionnel', FREQUENT: 'Fréquent', ENDEMIC: 'Endémique' }`.

## Migration & données

- **Une nouvelle table** `ZonePestPresence` (aucune colonne ajoutée aux tables existantes). Migration
  additive `CREATE TABLE` ; rien à effacer, aucune donnée existante impactée.

## Tests (unitaires ciblés uniquement)

Rappel : **jamais** `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts` (ils effacent la base).

- **Domaine** : `ZonePestPresence` (create/toSnapshot/fromSnapshot round-trip).
- **Use-cases** : `SetZonePestPresenceUseCase` (zone inconnue → erreur ; bioagresseur inconnu → erreur ;
  set + relecture via `listByZone` ; upsert = maj de la fréquence) ; `RemoveZonePestPresenceUseCase`
  (retrait reflété) ; `ListZonePestsUseCase` / `ListZoneCropsUseCase` (mapping nom/kind/rating) ;
  `DeleteZoneUseCase` appelle `deleteByZone`.
- **Admin** : `tsc --noEmit` comme garde.

## Décomposition (le plan aura ~2 phases)

1. **Backend** : entité + table + repo `ZonePestPresence` ; use-cases set/remove/list + endpoints ;
   `ListZoneCropsUseCase` + endpoint ; nettoyage `DeleteZoneUseCase` ; câblage module.
2. **Admin** : fiche `/zones/[id]` (lecture descriptive + 2 relations) + `ZonePestPresenceEditor` +
   plomberie (types/actions/libellé) + lien depuis la liste.

## Hors périmètre

- Édition de « cultures adaptées » depuis la zone (reste sur la fiche culture).
- Attributs supplémentaires sur le lien bioagresseur (saisonnalité, sévérité) — `frequency` seul pour l'instant.
- Fiche zone publique / vue technicien (l'admin suffit à ce stade).
