# Spec — Module 2 / Brique B « Bénéficiaires & Parcelles »

**Date** : 2026-08-07
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 2 (carnet de suivi) — première brique de données

## Contexte

La brique A a posé l'accès tenant (organisations clientes, rôles `ORG_ADMIN`/`AGRONOMIST`/
`FIELD_AGENT`/`VIEWER`, isolation par `organizationId`). La brique B introduit les **premières
données de suivi** : les **bénéficiaires** (agriculteurs, sans compte) et les **parcelles** (le
conteneur auquel se rattacheront ensuite les campagnes et le journal). C'est la fondation du
carnet de production.

Le journal des opérations, la campagne (culture × saison × parcelle) et les recommandations
datées viennent aux briques suivantes (C, D). La parcelle reste ici **agnostique de la
culture**.

### État actuel (audité)

- Domaines existants : `crop`, `zone`, `pest`, `price`, `window`, `media`, `shared`. Aucune
  notion de parcelle / agriculteur / campagne.
- Modules : `app.module` importe `AuthModule` + `CropModule` (ce dernier héberge aussi les
  contrôleurs `zone`/`pest`). Un nouveau module sera ajouté à `app.module`.
- **Gardes appliquées par contrôleur** : chaque contrôleur porte
  `@UseGuards(AuthGuard, RolesGuard)` (pas d'`APP_GUARD` global). `RolesGuard` = match exact ;
  `organizationId` provient du JWT (`AuthTokenPayload.organizationId`).
- `zone.controller` est `@Roles('superadmin')` au niveau classe (lecture comprise).
- Pattern d'entité de référence (zone/pest) = value object + snapshot + repo Prisma +
  use-cases + contrôleur + module ; DTO via un read-model.

## Objectifs

1. Entité **`Beneficiary`** (bénéficiaire, sans compte) — CRUD scopé tenant.
2. Entité **`Parcel`** (parcelle, conteneur) — CRUD scopé tenant, référence optionnelle
   bénéficiaire + zone.
3. **Isolation tenant stricte** : toute lecture/écriture filtrée par `organizationId` du JWT
   (jamais du body).
4. **Frontière de rôles** : lecture = 4 rôles tenant ; écriture (create/update/delete) =
   `ORG_ADMIN`/`AGRONOMIST`/`FIELD_AGENT` (pas `VIEWER`). La plateforme Okko n'accède **pas**
   aux données tenant.
5. Ouvrir la **liste des zones** en lecture aux rôles tenant (sélecteur de zone du formulaire
   parcelle).
6. Surface tenant : routes `/beneficiaires` et `/parcelles`, remplaçant le placeholder
   « Suivi (bientôt) ».

## Non-objectifs (briques suivantes)

- **Campagne** (culture × variété × saison sur une parcelle) — brique C.
- **Journal** des opérations, **Recommandations** datées — briques C, D.
- Surface mobile, self-service agriculteur, facturation.
- Édition des zones par les tenants (les écritures zone restent `superadmin`).

## Modèle de données

### `Beneficiary`

| Champ | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `organizationId` | string | isolation tenant |
| `name` | string | requis |
| `phone` | string? | optionnel |
| `notes` | string? | optionnel |
| `createdAt` | Date | |

### `Parcel`

| Champ | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `organizationId` | string | isolation tenant |
| `name` | string | requis (libellé, ex. « Champ nord ») |
| `beneficiaryId` | string? | optionnel — réf. `Beneficiary` (même org) |
| `zoneId` | string? | optionnel — réf. `AgroEcologicalZone` |
| `gpsLat` | number? | optionnel |
| `gpsLng` | number? | optionnel |
| `locality` | string? | optionnel (texte libre) |
| `areaHectares` | number? | optionnel |
| `notes` | string? | optionnel |
| `createdAt` | Date | |

Les deux tables Prisma portent `organizationId` (+ index) et `createdAt`. Migration additive.

## API

- **Domaine** (`apps/api/src/domain/parcel/`) : `beneficiary.ts` (+ snapshot), `parcel.ts`
  (+ snapshot). Value objects simples (pas d'event-sourcing).
- **Application** (`apps/api/src/application/parcel/`) : interfaces de repo + tokens
  (`BENEFICIARY_REPOSITORY`, `PARCEL_REPOSITORY`), repos in-memory (tests), use-cases par
  entité : `create`, `update`, `delete`, `listByOrganization`, et read-model/DTO.
  - Toutes les use-cases prennent `organizationId` en entrée et **filtrent dessus**.
  - `update`/`delete` vérifient que l'entité appartient à l'`organizationId` fourni ; sinon
    `*NotFoundError` (traité comme 404 — ne révèle pas l'existence cross-org).
  - `create` de parcelle : si `beneficiaryId` fourni, vérifier qu'il appartient à la même org
    (sinon rejet).
- **Infrastructure** (`apps/api/src/infrastructure/parcel/`) : repos Prisma
  (`findById`, `listByOrganization`, `save`, `delete`).
- **Présentation** (`apps/api/src/presentation/parcel/`) : `beneficiary.controller.ts`,
  `parcel.controller.ts`. Chacun `@UseGuards(AuthGuard, RolesGuard)`.
  - Lecture (`@Get`) : `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT','VIEWER')`.
  - Écriture (`@Post`/`@Patch`/`@Delete`) : `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT')`.
  - `organizationId` toujours pris de `@CurrentUser().organizationId` (jamais du body) ; 403
    si absent.
- **`SuiviModule`** (`apps/api/src/suivi.module.ts`) : DI des repos/use-cases/contrôleurs
  (mirror `crop.module`), ajouté à `app.module`.
- **Zones lisibles par les tenants** : sur `zone.controller`, ajouter un `@Roles(...)`
  method-level sur le handler **liste** (`@Get()`) incluant les 4 rôles tenant + les rôles
  plateforme (override du class-level `@Roles('superadmin')`). Les écritures zone restent
  `superadmin`. (Même technique qu'en brique A pour les fiches publiées.)

## Admin (une seule app, gatée par rôle)

- **Routes** : `/beneficiaires` (liste + formulaire créer/éditer) et `/parcelles` (liste +
  formulaire). Suppression via bouton confirmé.
- **Navigation** : groupe **« Suivi »** (rôles tenant) avec *Bénéficiaires* et *Parcelles*
  (remplace le lien placeholder `/bientot`).
- **Middleware** : ajouter `/beneficiaires` et `/parcelles` aux zones autorisées aux rôles
  tenant.
- **Gating écriture** : les boutons créer/éditer/supprimer ne s'affichent que pour
  `ORG_ADMIN`/`AGRONOMIST`/`FIELD_AGENT` ; `VIEWER` voit les listes en lecture seule. (La
  frontière serveur reste la source de vérité.)
- **Formulaire parcelle** : `name`, sélecteur **bénéficiaire** (liste tenant), sélecteur
  **zone** (liste zones ouverte ci-dessus), `areaHectares`, `gpsLat`/`gpsLng`, `locality`,
  `notes`. Sélecteurs = `Select` shadcn.
- **Clients API + server actions** pour les 2 entités ; réutilise `listZones` (désormais
  ouverte aux tenants) pour le sélecteur de zone.

## Tests

- **Use-cases** (in-memory) :
  - `create` pose `organizationId` et l'entité est relue via `listByOrganization`.
  - `listByOrganization` ne renvoie **que** les entités de l'org demandée (seeder 2 orgs).
  - `update`/`delete` sur une entité d'une **autre** org → `*NotFoundError` (isolation croisée).
  - `create` parcelle avec `beneficiaryId` d'une autre org → rejet.
- **Type-check** : `tsc --noEmit` vert côté API et admin.

## Points de touche (récap)

**API** : `schema.prisma` (2 modèles + migration) ; `domain/parcel/` (2 value objects) ;
`application/parcel/` (repos + in-memory + use-cases + read-model) ; `infrastructure/parcel/`
(2 repos Prisma) ; `presentation/parcel/` (2 contrôleurs) ; `suivi.module.ts` + `app.module` ;
`zone.controller` (liste ouverte aux tenants).

**Admin** : `lib/api.ts` (types + clients + réutilise `listZones`) ; server actions ;
`app/beneficiaires/` + `app/parcelles/` (pages + formulaires) ; `sidebar.tsx` (groupe Suivi) ;
`middleware.ts` (zones tenant).

**Tests** : specs use-cases (isolation org) ; `tsc` API + admin.

**Ordre de construction** : `Beneficiary` d'abord (la parcelle le référence), puis `Parcel`,
puis l'ouverture zones + la surface admin.

**Sans** : campagne/journal/reco, event-sourcing, mobile, self-service agriculteur.
