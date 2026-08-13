# Spec — Module 2 / Brique H « Conseils par phase phénologique »

**Date** : 2026-08-14
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 2 (carnet de suivi) — dernière brique du chantier notifications

## Contexte

Les briques F (canal email) et G (planificateur + cadence par utilisateur) envoient des **rappels
d'échéances**. La brique H ajoute un second type de notification : un **conseil lié au stade
phénologique courant** de la culture (« vous êtes en floraison → voici les travaux recommandés »).

Découverte clé : la fiche culture **porte déjà** les stades phénologiques avec leur conseil. On
réutilise donc massivement l'existant — aucun nouveau modèle de contenu.

### État actuel (audité, réutilisé)

- **`PhenologicalStage`** (`domain/crop/phenological-stage.ts`) : `{ name (TranslatableText),
  startDay, endDay (jours depuis le semis), order, description?, recommendedWork? }`. Exposé dans la
  fiche publiée : `CropDocument.phenology: PhenologicalStageJSON[]` (`application/crop/crop-read-model.ts`).
- **`PUBLISHED_CROP_REPOSITORY`** (`application/crop/published-crop.repository.ts`) :
  `findLatest(cropId): Promise<PublishedCropRecord | null>` ; `PublishedCropRecord.document: CropDocument`.
  Impl Prisma + in-memory déjà présentes.
- **F/G — canal & cadence** : `NotificationPort`/`BrevoEmailNotificationSender` ; `resolveCampaignRecipients(users,
  prefs, orgId): Promise<{ userId, email, everyNDays }[]>` (rôles terrain, email confirmé, `everyNDays > 0`) ;
  `NotificationLogRepository` (`lastSentAt`/`recordSent`, clé par (campagne, utilisateur)) ; `daysBetween`
  (actuellement locale au use-case de rappel) ; `RunDueRemindersUseCase` + `RemindersScheduler` (@Cron quotidien).
- **D — ancrage** : 1re opération de journal `PLANTING`/`NURSERY` `??` `campaign.startDate`. `OPERATION_LOG_REPOSITORY.listByCampaign`.
- **Campagne** : `cropId?` (absent si culture « Autre » libre → pas de fiche → pas de conseil).

## Objectifs

1. Déterminer le **stade phénologique courant** d'une campagne (ancrage + jours écoulés) et son
   **conseil** (`recommendedWork` du stade, repli `description`).
2. Envoyer ce conseil par **email séparé** (`campaign_advice`), **selon la cadence** de l'utilisateur
   (`reminderEveryNDays`), déclenché par le **cron quotidien existant** (brique G).
3. Afficher le conseil du stade courant **in-app** sur la page journal.

## Non-objectifs (hors périmètre)

- Diagnostic par photo / IA (Module 3) ; fuseau par organisation ; notification du bénéficiaire ;
  SMS/push/in-app ; édition de la phénologie (déjà dans l'admin fiche culture) ; conseil pour les
  cultures « Autre » sans fiche.

## Cœur : stade courant + conseil

- **`currentStage(phenology: PhenologicalStageJSON[], daysSinceAnchor: number): PhenologicalStageJSON | null`**
  (fonction pure) : renvoie le stade où `startDay <= daysSinceAnchor <= endDay` ; en cas de
  chevauchement, celui de plus petit `order` ; sinon `null`.
- **`resolveCampaignStageAdvice(campaign, phenology, journalOps, today): { stageName: string; advice: string } | null`**
  (fonction pure) :
  - `anchor = première op PLANTING/NURSERY (date min) ?? campaign.startDate` ; si absent → `null` ;
  - `daysSince = daysBetween(anchor, today)` ; `stage = currentStage(phenology, daysSince)` ; si `null` → `null` ;
  - `advice = stage.recommendedWork ?? stage.description` ; si vide/absent → `null` ;
  - `stageName = stage.name.fr ?? Object.values(stage.name)[0] ?? ''` ; renvoie `{ stageName, advice }`.
- **`daysBetween`** extrait vers `application/shared/days.ts` (utilisé par le use-case de rappel **et**
  ce cœur), signature inchangée : `daysBetween(aIso, bIso) = Math.floor((Date.parse(b.slice(0,10)) - Date.parse(a.slice(0,10))) / 86400000)`.

### `SendCampaignStageAdviceUseCase.execute({ campaignId, organizationId, today }) → { sent, skipped? }`

Injecte : `CAMPAIGN_REPOSITORY`, `PARCEL_REPOSITORY`, `PUBLISHED_CROP_REPOSITORY`,
`OPERATION_LOG_REPOSITORY`, `USER_REPOSITORY`, `NOTIFICATION_PREFERENCE_REPOSITORY`,
`NOTIFICATION_LOG_REPOSITORY`, `NOTIFICATION_PORT`, `Clock`, `IdGenerator`.

1. charge la campagne ; garde org (`!= organizationId` → `CampaignNotFoundError`) ;
2. si `!campaign.cropId` → `{ sent: 0, skipped: 'no_reference' }` ;
3. `published = PUBLISHED_CROP_REPOSITORY.findLatest(campaign.cropId)` ; si `null` → `{ sent: 0, skipped: 'no_reference' }` ;
4. `journal = OPERATION_LOG_REPOSITORY.listByCampaign(organizationId, campaignId)` ;
   `advice = resolveCampaignStageAdvice(campaign, published.document.phenology ?? [], journal, today)` ;
   si `null` → `{ sent: 0, skipped: 'no_advice' }` ;
5. `recipients = resolveCampaignRecipients(users, prefs, organizationId)` ; si vide → `{ sent: 0, skipped: 'no_recipients' }` ;
6. `parcel`, `campaignLabel = ${parcel?.name ?? 'Parcelle'} — ${campaign.season}`,
   `journalUrl = ${INVITE_BASE_URL}/parcelles/${campaign.parcelId}/campagnes/${campaignId}` ;
7. **par destinataire** : `dedupKey = campaign_advice:${campaignId}:${userId}` ; `last = log.lastSentAt(dedupKey)` ;
   si `last` et `daysBetween(last, today) < everyNDays` → passer ; sinon
   `notifier.send({ kind: 'campaign_advice', to: email, campaignLabel, stageName: advice.stageName,
   advice: advice.advice, journalUrl })` puis `log.recordSent({ id: ids.next(), organizationId, dedupKey,
   kind: 'campaign_advice', sentAt: clock.nowIso() })` ; `sent += 1` ;
8. `{ sent }`.

> Clé `campaign_advice:{campaignId}:{userId}` **distincte** de `campaign_reminder:…` → horloge de
> cadence indépendante des rappels (email séparé).

### `GetCampaignStageAdviceUseCase.execute({ campaignId, organizationId }) → { stageName, advice } | null`

Injecte `CAMPAIGN_REPOSITORY`, `PUBLISHED_CROP_REPOSITORY`, `OPERATION_LOG_REPOSITORY`, `Clock`.
Garde org (`CampaignNotFoundError`) ; si `!cropId` ou fiche absente → `null` ; sinon
`resolveCampaignStageAdvice(campaign, published.document.phenology ?? [], journal, clock.nowIso())`.

## Notification & rendu

- Union `Notification` (`application/notification/notification-port.ts`) gagne
  `{ kind: 'campaign_advice'; to: string; campaignLabel: string; stageName: string; advice: string; journalUrl: string }`.
- `BrevoEmailNotificationSender.render` gagne un `case 'campaign_advice'` : sujet
  `Conseil de culture — {campaignLabel}` ; HTML = stade + conseil (`escapeHtml`) + lien journal.

## Planificateur & endpoint

- **`RunDueStageAdviceUseCase`** (miroir de `RunDueRemindersUseCase`) : dépend de `CampaignRepository`
  + interface `CampaignAdviceSender { execute({ campaignId, organizationId, today }): Promise<{ sent: number }> }`
  (satisfaite par `SendCampaignStageAdviceUseCase`) ; `listActive()` → try/catch par campagne →
  `{ campaigns, sent, failed }`.
- **`RemindersScheduler`** : `handleCron()` (même `@Cron`, même garde `running`) déclenche **les deux**
  passages — `RunDueRemindersUseCase` puis `RunDueStageAdviceUseCase` — et log les deux synthèses.
- **`GET /campaigns/:id/stage-advice`** sur `CampaignController`, `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT','VIEWER')`,
  org du JWT → `GetCampaignStageAdviceUseCase` → `{ stageName, advice } | null`. `CampaignNotFoundError` → 404.

## Module

`SuiviModule` : fournit `PUBLISHED_CROP_REPOSITORY` (`PrismaPublishedCropRepository`) ; providers de
`SendCampaignStageAdviceUseCase`, `GetCampaignStageAdviceUseCase`, `RunDueStageAdviceUseCase` ; le
`RemindersScheduler` injecte en plus `RunDueStageAdviceUseCase`. `CampaignController` injecte
`GetCampaignStageAdviceUseCase`.

## Admin

- `lib/api.ts` : `getCampaignStageAdvice(campaignId): Promise<{ stageName, advice } | null>` (server, `no-store`).
- Page journal (`app/parcelles/[id]/campagnes/[cid]/page.tsx`) : panneau **« Conseil du stade »** affichant
  `stageName` + `advice` si non-null (récupération parallèle avec le reste). Rien si `null`.

## Tests

- **`currentStage`** : `daysSince` dans `[startDay,endDay]` → le stade ; hors de tout stade → `null` ;
  chevauchement → plus petit `order`.
- **`resolveCampaignStageAdvice`** : ancrage PLANTING/NURSERY (date min) `??` `startDate` ; sans ancrage
  → `null` ; sans stade courant → `null` ; conseil vide → `null` ; `recommendedWork` prioritaire sur `description`.
- **`SendCampaignStageAdviceUseCase`** : envoie le conseil aux destinataires dus ; **cadence** (`lastSentAt`
  hier + `everyNDays=2` → passé ; il y a 2 jours → envoyé ; premier → envoyé) ; `no_reference` (pas de
  `cropId`/fiche) ; `no_advice` ; `no_recipients` ; garde org → `CampaignNotFoundError` ; clé
  `campaign_advice:{campaignId}:{userId}`.
- **`GetCampaignStageAdviceUseCase`** : renvoie `{ stageName, advice }` ou `null` ; garde org.
- **`RunDueStageAdviceUseCase`** : agrège `{ campaigns, sent, failed }` ; une campagne en échec n'interrompt
  pas le passage.
- **Rendu Brevo** : `campaign_advice` → sujet + HTML contenant `stageName`, `advice`, `journalUrl`.
- **Rôles** : `GET /campaigns/:id/stage-advice` = 4 rôles tenant.
- **Type-check** : `tsc --noEmit` vert API + admin.

## Points de touche (récap)

**API** : `application/shared/days.ts` (`daysBetween` extrait) + import dans le use-case de rappel ;
`application/notification/notification-port.ts` (+kind) ; `infrastructure/notification/brevo-email-notification-sender.ts`
(+case) ; `application/notification/campaign-stage-advice.ts` (`currentStage` + `resolveCampaignStageAdvice`) ;
`application/notification/send-campaign-stage-advice.use-case.ts` ; `application/notification/get-campaign-stage-advice.use-case.ts` ;
`application/notification/run-due-stage-advice.use-case.ts` ; `presentation/notification/reminders.scheduler.ts`
(2e passage) ; `presentation/parcel/campaign.controller.ts` (endpoint) ; `suivi.module.ts`
(`PUBLISHED_CROP_REPOSITORY` + 3 use-cases + scheduler).

**Admin** : `lib/api.ts` (`getCampaignStageAdvice`) ; page journal (panneau « Conseil du stade »).

**Ordre de construction** : (1) `daysBetween` partagé + kind `campaign_advice` + rendu ; (2) `currentStage`
+ `resolveCampaignStageAdvice` ; (3) `SendCampaignStageAdviceUseCase` + `GetCampaignStageAdviceUseCase` ;
(4) `RunDueStageAdviceUseCase` + scheduler (2e passage) + endpoint + câblage module ; (5) admin (panneau journal).

**Sans** : IA/photo (Module 3), fuseau par org, bénéficiaire, SMS/push, édition phénologie, cultures « Autre ».
