# Spec — Module 2 / Brique C « Campagne & Journal des opérations »

**Date** : 2026-08-11
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 2 (carnet de suivi) — cœur générateur de données terrain

## Contexte

Les briques A (accès tenant) et B (bénéficiaires & parcelles) sont livrées. La brique C
introduit le **cœur du carnet** : sur une parcelle, une **campagne** (une culture + variété
optionnelle, sur une saison) porte un **journal** d'opérations réelles datées (défrichage,
pépinière, mise en terre, apports d'intrants, opérations culturales, récolte…). C'est ce qui
**génère la donnée terrain** — l'actif que personne d'autre n'accumule (vision §9).

Les **recommandations datées** (croisement du journal avec le calendrier de référence
`CroppingWindow.operations`) sont la brique D. Les **photos géolocalisées** (carburant du
diagnostic IA) sont la brique E. La brique C reste **texte/structuré, sans photo**.

### État actuel (audité, réutilisé)

- Isolation tenant établie (A) : `organizationId` du JWT, `RolesGuard` match exact, gardes
  par contrôleur `@UseGuards(AuthGuard, RolesGuard)`.
- Entités tenant (B) : `Parcel`, `Beneficiary` dans `domain/parcel/` + `SuiviModule` ; pattern
  de validation croisée même-org (parcelle→bénéficiaire) à répliquer.
- Base : `OperationType` (enum, 12 valeurs, `domain/window/operation-type.ts`) — **réutilisé**
  par le journal. Côté admin, `OPERATION_TYPE_LABELS` existe déjà (`lib/labels.ts`) — réutilisé.
- Fiches publiées lisibles par les tenants (A) : `GET /crops/published` (liste) et
  `getCropPublished` (détail avec variétés) — servent aux sélecteurs culture/variété.

## Objectifs

1. Entité **`Campaign`** (culture sur une parcelle, une saison) — CRUD scopé tenant.
2. Entité **`OperationLog`** (opération datée riche : intrants structurés, coût, agent) —
   CRUD scopé tenant, rattachée à une campagne.
3. **Isolation tenant stricte** (org du JWT) + validation croisée même-org sur `parcelId`
   (campagne) et `campaignId` (opération).
4. **Frontière de rôles** : lecture = 4 rôles tenant ; écriture = `ORG_ADMIN`/`AGRONOMIST`/
   `FIELD_AGENT`.
5. Réutiliser `OperationType`. `recordedByUserId` posé automatiquement (JWT).
6. Surface admin : détail parcelle → campagnes → journal (timeline d'opérations).

## Non-objectifs (briques suivantes)

- **Recommandations datées** (D) : croisement journal × calendrier de référence.
- **Photos géolocalisées** (E) → diagnostic IA.
- Sélecteur d'**exécutant distinct** (nécessiterait un endpoint « liste des membres de l'org ») ;
  seul `recordedByUserId` (auteur du log) est capturé.
- Catalogue produits/intrants (les intrants sont saisis en texte libre) ; mobile.

## Modèle de données

### `Campaign`

| Champ | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `organizationId` | string | isolation tenant |
| `parcelId` | string | requis — réf. `Parcel` (même org, validé) |
| `cropId` | string | requis — réf. Culture (Base, non validé en profondeur) |
| `varietyId` | string? | optionnel — variété de la culture |
| `season` | string | ex. « Saison des pluies 2026 » |
| `startDate` | string? | date ISO (optionnel) |
| `status` | string (enum) | `ACTIVE` \| `CLOSED` (défaut `ACTIVE`) |
| `notes` | string? | |
| `createdAt` | Date | |

### `OperationLog`

| Champ | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `organizationId` | string | isolation tenant |
| `campaignId` | string | requis — réf. `Campaign` (même org, validé) |
| `type` | string | **`OperationType`** (12 valeurs) |
| `date` | string | date ISO réelle de l'opération (requis) |
| `inputs` | `OperationInput[]` | liste `{ product: string; quantity?: number; unit?: string; cost?: number }` (JSON) |
| `laborCost` | number? | coût main d'œuvre |
| `notes` | string? | |
| `recordedByUserId` | string | posé par le use-case depuis `user.sub` (JWT) |
| `createdAt` | Date | |

Tables Prisma `Campaign` et `OperationLog` : `organizationId` + index ; `Campaign` index aussi
`parcelId` ; `OperationLog` index `campaignId` ; `inputs` en `Json`. Migration additive.

## API

- **Domaine** (`apps/api/src/domain/parcel/`) : `campaign.ts` (`CampaignSnapshot`),
  `operation-log.ts` (`OperationLogSnapshot` + `OperationInput`). `type` typé par
  `OperationType` importé de `domain/window/operation-type`.
- **Application** (`apps/api/src/application/parcel/`) : repos + tokens
  (`CAMPAIGN_REPOSITORY`, `OPERATION_LOG_REPOSITORY`), in-memory, use-cases, erreurs
  (`CampaignNotFoundError`, `OperationLogNotFoundError`).
  - Campaign : `create` (valide `parcelId` même-org via `PARCEL_REPOSITORY`, défaut
    `status='ACTIVE'`), `listByParcel` (valide la parcelle même-org, filtre org+parcel),
    `update`, `delete` (cross-org → `CampaignNotFoundError`).
  - OperationLog : `create` (valide `campaignId` même-org via `CAMPAIGN_REPOSITORY`, pose
    `recordedByUserId`), `listByCampaign` (valide la campagne même-org), `update`, `delete`.
  - `cropId`/`varietyId` stockés sans validation profonde (données de référence).
- **Infrastructure** (`apps/api/src/infrastructure/parcel/`) : repos Prisma (`inputs` JSON).
- **Présentation** (`apps/api/src/presentation/parcel/`) : `campaign.controller.ts`,
  `operation-log.controller.ts`, chacun `@UseGuards(AuthGuard, RolesGuard)`.
  - Lecture `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT','VIEWER')` ; écriture
    `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT')`.
  - `organizationId` de `@CurrentUser()` (403 si absent), jamais du body.
  - `GET /campaigns?parcelId=…` (valide parcelle même-org avant liste) ; `POST /campaigns`
    (body porte `parcelId`) ; `PATCH`/`DELETE /campaigns/:id`.
  - `GET /operations?campaignId=…` (valide campagne même-org) ; `POST /operations`
    (`recordedByUserId` posé côté use-case depuis le JWT, pas du body) ; `PATCH`/`DELETE
    /operations/:id`.
- **`SuiviModule`** : ajouter les 2 repos, use-cases (via `useFactory`+`inject`, `create`
  campaign injecte `PARCEL_REPOSITORY`, `create` operation injecte `CAMPAIGN_REPOSITORY`) et
  les 2 contrôleurs.

## Admin (une seule app, gatée par rôle)

Les campagnes/journal sont des **sous-ressources de la parcelle** — pas de nouvel item de nav.

- **Détail parcelle** `app/parcelles/[id]/page.tsx` : la parcelle + liste de ses **campagnes**
  + créer/éditer/supprimer une campagne. La liste `/parcelles` gagne un lien « Voir » (→ détail).
  - Formulaire campagne : sélecteur **culture** (depuis `listPublishedCrops`), sélecteur
    **variété** (depuis `getCropPublished(cropId).varieties`), `season`, `startDate`, `status`,
    `notes`. `parcelId` vient de l'URL.
- **Journal de campagne** `app/parcelles/[id]/campagnes/[cid]/page.tsx` : la campagne + la
  **timeline des opérations** triées par date + ajouter/éditer/supprimer une opération.
  - Formulaire opération : `Select` `type` (réutilise `OPERATION_TYPE_LABELS`), `date`,
    **intrants répétables** `{produit, quantité, unité, coût}`, `laborCost`, `notes`.
- **Clients API + server actions** pour campagnes et opérations. Boutons d'écriture visibles
  seulement pour les 3 rôles rédacteurs (`VIEWER` = lecture ; la frontière serveur reste la
  source de vérité).

## Tests

- **Use-cases** (in-memory) :
  - `create campaign` : valide `parcelId` même-org (rejet cross-org → `ParcelNotFoundError`),
    défaut `status='ACTIVE'`.
  - `create operation` : valide `campaignId` même-org (rejet cross-org →
    `CampaignNotFoundError`), pose `recordedByUserId` depuis l'input.
  - `listByParcel` / `listByCampaign` : ne renvoient que l'org+parent demandés.
  - `update`/`delete` cross-org → `*NotFoundError`.
- **Type-check** : `tsc --noEmit` vert API + admin.

## Points de touche (récap)

**API** : `domain/parcel/{campaign,operation-log}.ts` ; `application/parcel/` (repos +
in-memory + use-cases + erreurs) ; `infrastructure/parcel/` (2 repos Prisma) ;
`presentation/parcel/` (2 contrôleurs) ; `schema.prisma` (2 modèles + migration) ;
`suivi.module.ts`.

**Admin** : `lib/api.ts` (types + listes) ; server actions ; `app/parcelles/[id]/page.tsx`
(campagnes) ; `app/parcelles/[id]/campagnes/[cid]/page.tsx` (journal) ; formulaires ;
lien « Voir » sur la liste parcelles ; réutilise `OPERATION_TYPE_LABELS`.

**Ordre de construction** : `Campaign` (domaine→persistance→contrôleur), puis `OperationLog`,
puis surface admin (détail parcelle + campagnes, puis journal).

**Sans** : recommandations (D), photos (E), exécutant distinct, catalogue intrants, mobile.
