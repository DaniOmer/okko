# Spec — Module 2 / Brique D « Recommandations datées »

**Date** : 2026-08-11
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 2 (carnet de suivi) — moteur de recommandations dérivées

## Contexte

Les briques A→C sont livrées : accès tenant, parcelles/bénéficiaires, et campagnes + journal
d'opérations réelles datées. La brique D **exploite** ce journal : elle le croise avec le
**calendrier de référence** de la Base (`CroppingWindow.operations` — opérations-type avec
`timingDays` depuis le semis) pour produire des **recommandations datées** au technicien :
« telle opération est à venir / en retard / faite », et un **avertissement fenêtre de semis**
si la campagne démarre hors de la période recommandée.

C'est un **moteur de dérivation** (pas du CRUD) : rien n'est persisté hormis deux petits
champs sur la campagne. Les fenêtres ravageurs, l'appariement fin des opérations répétées, la
vue admin des cultures « Autre », les photos (brique E) et le mobile sont **hors périmètre**.

### État actuel (audité, réutilisé)

- `Campaign` (brique C) : `parcelId`, `cropId`, `varietyId?`, `season`, `startDate?`, `status`,
  `notes?`. `OperationLog` : `campaignId`, `type` (`OperationType`), `date`, `inputs`…
- `CroppingWindow` (Base) : `cropId`, `zoneId`, `season`, `sowingStart?`/`sowingEnd?` (mois),
  `operations: TechnicalOperation[]` (`type: OperationType`, `label`, **`timingDays`** = jours
  depuis le semis). Repo `CroppingWindowRepository` : a `listByCrop(cropId)` (pas de `findById`).
- La fiche publiée (`getCropPublished`, lisible par les tenants) inclut `croppingWindows` — le
  formulaire campagne y lira les fenêtres pour le sélecteur.
- `OperationType` : `CLEARING, SEED_TREATMENT, NURSERY, TRANSPLANTING, PLANTING, FERTILIZATION,
  WEEDING, THINNING, EARTHING_UP, PEST_CONTROL, HARVEST, OTHER`.

## Objectifs

1. Relier explicitement une campagne à sa fenêtre de référence (`windowId?`) et permettre une
   culture **« Autre »** libre (`customCropName?`, sans calendrier).
2. Calculer, pour une campagne, des **recommandations d'opérations** datées + un
   **avertissement fenêtre de semis**, via une **fonction pure testée unitairement**.
3. Exposer le calcul en lecture (`GET /campaigns/:id/recommendations`) aux 4 rôles tenant,
   scopé `organizationId`.
4. Surface admin : sélecteurs culture(+Autre)/calendrier au formulaire campagne, panneau
   « Recommandations » sur la page journal.

## Non-objectifs (plus tard)

- Vue admin des cultures « Autre » non suivies par Okko.
- Appariement fin des opérations répétées (deux sarclages, etc.).
- Fenêtres à risque ravageurs ; notifications proactives / push ; mobile.
- Photos géolocalisées (brique E).

## Modèle de données

### `Campaign` — 2 champs additifs + `cropId` nullable

| Champ | Type | Notes |
|---|---|---|
| `cropId` | `string?` | **devient optionnel** — absent si culture « Autre » |
| `customCropName` | `string?` | nom libre quand pas de `cropId` |
| `windowId` | `string?` | fenêtre de référence choisie (n'a de sens qu'avec `cropId`) |

Migration : `ADD COLUMN windowId`, `customCropName` ; `ALTER COLUMN cropId DROP NOT NULL`.
Règle de validation (create) : `cropId` **ou** `customCropName` requis (sinon erreur 400).

### Sortie du moteur (dérivée, non persistée)

```ts
type RecommendationStatus = 'DONE' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'UNDATED';

interface RecommendationItem {
  type: OperationType;
  label: string;          // libellé FR de la fenêtre (label.fr ?? code)
  timingDays: number;
  dueDate?: string;       // ISO, si ancrage connu
  status: RecommendationStatus;
}

interface SowingAdvisory {
  withinWindow: boolean;
  sowingStart?: string;   // mois
  sowingEnd?: string;     // mois
  anchorMonth?: string;   // mois du jour 0
}

interface CampaignRecommendations {
  hasReference: boolean;  // false si pas de cropId/windowId/fenêtre introuvable
  items: RecommendationItem[];
  sowingAdvisory?: SowingAdvisory;
}
```

## Logique du moteur (fonction pure)

`computeRecommendations(input)` — `apps/api/src/domain/parcel/recommendations.ts` :

Entrées : `referenceOperations: { type, label, timingDays }[]`, `journalOperations: { type,
date }[]`, `anchorDate?: string`, `today: string`, `sowingStart?`, `sowingEnd?`,
`dueSoonWindowDays: number` (défaut 7).

- **Ancrage** (`jour0`) fourni par l'appelant : date de la 1re op de journal de type
  `PLANTING` ou `NURSERY` `??` `campaign.startDate` `??` `undefined`.
- Pour chaque opération de référence :
  - `FAIT` s'il existe ≥ 1 op de journal du **même `type`** (limite v1 assumée : pas
    d'appariement des répétitions).
  - sinon, si `anchorDate` connu : `dueDate = anchorDate + timingDays` ; puis `OVERDUE` si
    `dueDate < today`, `DUE_SOON` si `today ≤ dueDate ≤ today + dueSoonWindowDays`, sinon
    `UPCOMING`.
  - sinon (`anchorDate` inconnu) : `UNDATED` (séquence sans date).
  - items triés par `timingDays` croissant.
- **Avertissement fenêtre de semis** : si `anchorDate` et `sowingStart`/`sowingEnd` connus et
  que le **mois** de l'ancrage est hors `[sowingStart, sowingEnd]` → `sowingAdvisory` avec
  `withinWindow=false` (+ les mois) ; sinon `withinWindow=true`.

## API

- **Domaine** : `domain/parcel/recommendations.ts` (types ci-dessus + `computeRecommendations`,
  pure, sans I/O). Enum `OperationType` réutilisé.
- **Campagne** : étendre `CampaignSnapshot` (`cropId?`, `customCropName?`, `windowId?`) ;
  `CreateCampaignInput`/`UpdateCampaignInput` + validation `cropId || customCropName` (nouvelle
  `MissingCropError` → 400) ; repo Prisma + migration ; contrôleur `CampaignBody` (cropId
  optionnel + 2 champs).
- **Use-case** : `GetCampaignRecommendationsUseCase` (injecte `CAMPAIGN_REPOSITORY`,
  `OPERATION_LOG_REPOSITORY`, `CROPPING_WINDOW_REPOSITORY`, `Clock`). `execute({ campaignId,
  organizationId })` :
  1. charge la campagne (garde org → `CampaignNotFoundError`) ;
  2. si pas de `cropId` ou pas de `windowId` → `{ hasReference: false, items: [] }` ;
  3. `windows = croppingWindows.listByCrop(campaign.cropId)` ; `window = windows.find(w => w.id
     === campaign.windowId)` ; si absent → `{ hasReference: false, items: [] }` ;
  4. `journal = operations.listByCampaign(org, campaignId)` ; ancrage = date PLANTING/NURSERY
     `??` `campaign.startDate` ;
  5. `computeRecommendations(...)` avec `today = clock.nowIso()`.
- **Endpoint** : `GET /campaigns/:id/recommendations` sur `CampaignController`,
  `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT','VIEWER')`, `organizationId` du JWT.
- **`SuiviModule`** : provider du `GetCampaignRecommendationsUseCase` + injection du
  `CROPPING_WINDOW_REPOSITORY` (lier au `PrismaCroppingWindowRepository` — lecture de données
  Base, même esprit que l'ouverture zones/fiches en briques A/B).

## Admin (une seule app, gatée par rôle)

- **Formulaire campagne** (`app/parcelles/[id]/CampaignForm*.tsx`) :
  - Sélecteur **Culture** = cultures publiées **+ option « Autre… »**. « Autre » → révèle un
    champ `customCropName`, efface `cropId`/`windowId`. Une vraie culture → sélecteur
    **« Calendrier de référence »** alimenté par `getCropPublished(cropId).croppingWindows`
    (libellé = `season`), stocke `windowId`.
  - Réutilise le chargement `getCropPublished` (déjà là pour les variétés) pour récupérer
    variétés **et** fenêtres.
  - Payload : `cropId` **ou** `customCropName`, `windowId?`, `varietyId?`, `season`, etc.
- **Page journal** (`app/parcelles/[id]/campagnes/[cid]/page.tsx`) : panneau
  **« Recommandations »** appelant `getCampaignRecommendations(campaignId)` :
  - avertissement fenêtre de semis (si `sowingAdvisory.withinWindow === false`) ;
  - liste des `items` avec **badge de statut** (map FR) et `dueDate` ;
  - si `hasReference === false` → indice « Reliez un calendrier de référence… ».
- **Client API** `getCampaignRecommendations(campaignId)` + `RECO_STATUS_LABELS`
  (`DONE:'Fait', OVERDUE:'En retard', DUE_SOON:'Bientôt', UPCOMING:'À venir', UNDATED:'Non
  daté'`).

## Tests

- **`computeRecommendations` (unitaire, le cœur)** :
  - statut `DONE` si une op du même type existe ; `OVERDUE`/`DUE_SOON`/`UPCOMING` selon
    `dueDate` vs `today` ; `UNDATED` si pas d'ancrage.
  - tri par `timingDays`.
  - `sowingAdvisory.withinWindow` true/false selon le mois d'ancrage.
- **`GetCampaignRecommendationsUseCase`** : garde org ; `hasReference:false` sans
  `windowId`/fenêtre introuvable ; chemin nominal (fenêtre + journal → items).
- **Campagne** : `create` avec ni `cropId` ni `customCropName` → `MissingCropError` (400).
- **Type-check** : `tsc --noEmit` vert API + admin.

## Points de touche (récap)

**API** : `domain/parcel/recommendations.ts` ; `domain/parcel/campaign.ts` (+3 champs) ;
`application/parcel/campaign.use-cases.ts` (validation) + `errors.ts` (`MissingCropError`) ;
`get-campaign-recommendations.use-case.ts` ; `schema.prisma` + migration (2 colonnes +
`cropId` nullable) ; `prisma-campaign.repository.ts` ; `campaign.controller.ts` (body +
endpoint recommendations) ; `suivi.module.ts` (use-case + `CROPPING_WINDOW_REPOSITORY`).

**Admin** : `lib/api.ts` (types reco + `getCampaignRecommendations` + `CroppingWindow` déjà
là) ; `lib/labels.ts` (`RECO_STATUS_LABELS`) ; `CampaignForm*.tsx` (culture+Autre, fenêtre) ;
page journal (panneau recommandations).

**Ordre de construction** : (1) fonction pure `computeRecommendations` + tests ; (2) champs
campagne (`cropId?`/`customCropName?`/`windowId?`) + validation + persistance ; (3) use-case +
endpoint + module ; (4) formulaire campagne (culture/Autre/fenêtre) ; (5) panneau journal.

**Sans** : vue « Autre » admin, appariement fin, ravageurs, notifications, photos, mobile.
