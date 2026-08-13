# Spec — Module 2 / Brique G « Planificateur de rappels »

**Date** : 2026-08-13
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 2 (carnet de suivi) — automatisation de l'envoi des rappels

## Contexte

La brique F a livré le **canal** de rappels : un use-case `SendCampaignReminderDigestUseCase` (email
digest par campagne, idempotent), un déclencheur manuel, et une préférence de désabonnement
(`remindersEnabled`). Il manque **l'automatisation** : personne ne déclenche l'envoi tout seul.

La brique G ajoute un **planificateur in-process** (`@nestjs/schedule`) qui, chaque jour, parcourt
les campagnes actives (toutes organisations) et déclenche l'envoi. Elle introduit aussi une
**cadence par utilisateur** (quotidien par défaut, ou tous les 2/3/7 jours, ou jamais), ce qui
**remanie** la décision d'envoi de F : de « 1 digest/campagne/jour pour tous » à « par destinataire,
selon sa cadence ».

### État actuel (audité, réutilisé/remanié)

- **F — `SendCampaignReminderDigestUseCase`** (`application/notification/send-campaign-reminder-digest.use-case.ts`) :
  garde org, dédup `campaign_reminder:{campaignId}:{jour}`, résout les destinataires (emails),
  envoie à tous, écrit un journal. **Remanié par G** (voir §Décision d'envoi).
- **F — résolveur `resolveCampaignRecipients(users, prefs, orgId): Promise<string[]>`**
  (`application/notification/campaign-recipients.ts`) : rôles terrain + email confirmé + préférence.
  **Remanié** : renvoie désormais `{ userId, email, everyNDays }[]`.
- **F — `NotificationPreference { userId, remindersEnabled: boolean }`** + repo + endpoints
  `/me/notification-preferences`. **Remanié** : `remindersEnabled` → `reminderEveryNDays: number`.
- **F — `NotificationLog { id, organizationId, dedupKey @unique, kind, sentAt }`** + repo
  (`existsByDedupKey`, `record`). **Réutilisé** avec une nouvelle clé et un upsert (voir §Suivi).
- **D — `GetCampaignRecommendationsUseCase`** (moteur d'échéances, satisfait `CampaignRecommendationsReader`).
- **`CampaignSnapshot.status: 'ACTIVE' | 'CLOSED'`** ; `CampaignRepository` n'a **pas** de « lister
  les actives » cross-org → à ajouter.
- **`main.ts`** : serveur NestJS long-running (`app.listen(3001)`) → un cron in-process est viable.
  `@nestjs/schedule` **non installé**.
- **F non déployée** (main en avance sur origin, jamais mis en prod) → les migrations qui restructurent
  `NotificationPreference`/`NotificationLog` ne touchent aucune donnée réelle.

## Objectifs

1. **Cadence par utilisateur** : `reminderEveryNDays` (0 = jamais, 1 = quotidien par défaut, 2, 3, 7),
   modifiable par l'utilisateur dans ses préférences.
2. **Décision d'envoi par (destinataire, campagne)** : un destinataire reçoit le digest d'une campagne
   aujourd'hui si elle a des échéances dues **et** que sa cadence est écoulée depuis le dernier rappel.
3. **Planificateur quotidien in-process** (`@nestjs/schedule`) qui parcourt les campagnes actives de
   toutes les organisations et déclenche l'envoi, robuste aux erreurs (une campagne en échec
   n'interrompt pas le passage).
4. **UI** : la préférence devient un sélecteur de fréquence (shadcn `Select`).

## Non-objectifs (hors périmètre)

- **Fuseau horaire par organisation** — calculs en UTC (jour = `today.slice(0,10)`).
- **Pagination/batching** des campagnes actives si le volume devient très grand — à noter (log) si la
  liste dépasse un seuil, mais pas de pagination en v1.
- Conseils par phase phénologique (**brique H**) ; file de reprise dédiée ; SMS/push/in-app ;
  déclencheur externe (endpoint + secret) — le cron in-process suffit.

## Modèle de données

### `NotificationPreference` — cadence (remplace le booléen)

| Champ | Type | Notes |
|---|---|---|
| `userId` | `String @id` | inchangé |
| `reminderEveryNDays` | `Int @default(1)` | 0 = jamais ; 1 = quotidien (défaut) ; 2 ; 3 ; 7 |
| `updatedAt` | `DateTime @updatedAt` | inchangé |

Migration : `ADD COLUMN reminderEveryNDays INTEGER NOT NULL DEFAULT 1` ; backfill
(`remindersEnabled = false → 0`, sinon `1`) ; `DROP COLUMN remindersEnabled`. Table vide → sans risque.

### `NotificationLog` — dernier rappel par (campagne, utilisateur)

**Schéma inchangé** (`{ id, organizationId, dedupKey @unique, kind, sentAt }`). Change d'usage :
- Clé : `dedupKey = campaign_reminder:{campaignId}:{userId}` (**sans le jour**).
- `sentAt` = **date du dernier rappel** envoyé à cet utilisateur pour cette campagne, **mis à jour à
  chaque envoi** (upsert). Une ligne par (campagne, utilisateur).

Nouvelles méthodes du repo (remplacent `existsByDedupKey`/`record`) :
- `lastSentAt(dedupKey: string): Promise<string | null>` — `sentAt` ISO de la ligne, ou `null`.
- `recordSent(entry: NotificationLogSnapshot): Promise<void>` — upsert par `dedupKey`, met à jour `sentAt`.

## Décision d'envoi (cœur remanié)

`resolveCampaignRecipients(users, prefs, organizationId): Promise<{ userId: string; email: string; everyNDays: number }[]>` :
- garde `role ∈ {ORG_ADMIN, AGRONOMIST, FIELD_AGENT}` **et** `emailVerifiedAt != null` ;
- `everyNDays = pref?.reminderEveryNDays ?? 1` (absence de ligne = quotidien) ;
- **exclut `everyNDays === 0`** (jamais) ; renvoie `{ userId, email, everyNDays }`.

`SendCampaignReminderDigestUseCase.execute({ campaignId, organizationId, today })` → `{ sent, skipped? }` :
1. charge la campagne ; garde org (`!= organizationId` → `CampaignNotFoundError`) ;
2. `reco.execute` → `items = filter(status ∈ {OVERDUE, DUE_SOON})` ; si vide → `{ sent:0, skipped:'no_due_items' }` ;
3. `recipients = resolveCampaignRecipients(...)` ; si vide → `{ sent:0, skipped:'no_recipients' }` ;
4. charge parcelle → `campaignLabel = ${parcel?.name ?? 'Parcelle'} — ${campaign.season}` ;
   `journalUrl = ${INVITE_BASE_URL}/parcelles/${campaign.parcelId}/campagnes/${campaignId}` ;
5. **pour chaque destinataire** : `dedupKey = campaign_reminder:${campaignId}:${userId}` ;
   `last = log.lastSentAt(dedupKey)` ; **si `last` et `daysBetween(last, today) < everyNDays` → passer** ;
   sinon `notifier.send({ kind:'campaign_reminder', to: email, campaignLabel, items, journalUrl })`
   puis `log.recordSent({ id: ids.next(), organizationId, dedupKey, kind:'campaign_reminder', sentAt: clock.nowIso() })` ;
6. `{ sent: nombre d'emails effectivement envoyés }`.

`daysBetween(aIso, bIso)` : différence entière de jours UTC entre les portions `YYYY-MM-DD` —
`Math.floor((Date.parse(b.slice(0,10)) - Date.parse(a.slice(0,10))) / 86400000)`.

> Cette règle **remplace** la dédup « 1/campagne/jour » de F et unifie cron + bouton manuel : un
> utilisateur en quotidien (1) reçoit au plus un rappel/jour/campagne ; en « tous les 2 jours » (2), il
> est passé si `daysBetween < 2`. Un `sent: 0` sans `skipped` signifie « aucun destinataire n'était dû
> aujourd'hui ».

## Planificateur & itération

- **`CampaignRepository.listActive(): Promise<CampaignSnapshot[]>`** — toutes les campagnes `status = 'ACTIVE'`,
  toutes organisations (impl Prisma + in-memory). Si la liste dépasse **500** entrées, `log.warn` (pas de pagination en v1).
- **`RunDueRemindersUseCase.execute({ today }): Promise<{ campaigns: number; sent: number }>`** :
  `campaigns = listActive()` ; pour chaque campagne, appelle `SendCampaignReminderDigestUseCase.execute({
  campaignId: c.id, organizationId: c.organizationId, today })` dans un **try/catch** (log l'erreur,
  continue) ; agrège le nombre de campagnes traitées et la somme des `sent`.
- **`RemindersScheduler`** (provider `@Injectable`) : `@Cron(process.env.REMINDERS_CRON ?? '0 5 * * *')`
  (UTC ≈ 6h WAT, configurable) → méthode `handleCron()` : garde anti-recouvrement (drapeau booléen
  `running` ; si un passage est en cours, log et sort) ; appelle `RunDueRemindersUseCase.execute({
  today: clock.nowIso() })` ; `log` de synthèse (`campaigns`, `sent`) ; `finally { running = false }`.
- **`ScheduleModule.forRoot()`** importé par le `SuiviModule` ; `RemindersScheduler` + `RunDueRemindersUseCase`
  fournis par le `SuiviModule`. Dépendance ajoutée : `@nestjs/schedule`.

## Admin & endpoints

- **Endpoints F remaniés** : `GET /me/notification-preferences` → `{ reminderEveryNDays: number }` ;
  `PATCH` body `{ reminderEveryNDays: number }` (valeurs acceptées `0,1,2,3,7` ; toute autre valeur →
  ramenée à `1` côté contrôleur pour rester robuste). Rôles inchangés (4 rôles tenant).
- **Préférence UI** : `NotificationPreferenceToggle` (case à cocher) → **sélecteur shadcn `Select`**
  `NotificationFrequencySelect` : Quotidien (1) / Tous les 2 jours (2) / Tous les 3 jours (3) /
  Hebdomadaire (7) / Jamais (0). Lit/écrit via les actions remaniées. (Règle le follow-up F « checkbox
  native → shadcn ».)
- **Actions admin** (`suivi-actions.ts`) : `getNotificationPreference(): { reminderEveryNDays }` ;
  `setNotificationPreference(reminderEveryNDays: number)`. Le bouton « Envoyer un rappel » (F)
  respecte désormais la cadence via le use-case remanié : `notifyCampaignReminder` ne renvoie plus
  `already_sent` (la dédup par jour a disparu) — retirer ce code du type et du message ; un `sent: 0`
  sans `skipped` affiche « Aucun rappel dû aujourd'hui » (les messages `no_due_items`/`no_recipients`
  restent).

## Tests

- **Résolveur** : renvoie `{ userId, email, everyNDays }` ; défaut `everyNDays = 1` sans préférence ;
  exclut `everyNDays === 0`, VIEWER, email non confirmé.
- **`SendCampaignReminderDigestUseCase` (remanié)** : envoie aux destinataires dus (filtre OVERDUE/DUE_SOON) ;
  **cadence** : `lastSentAt = hier` + `everyNDays = 2` → destinataire **passé** ; `lastSentAt = il y a 2 jours`
  + `everyNDays = 2` → **envoyé** ; premier envoi (`lastSentAt = null`) → envoyé ; upsert du `sentAt` après
  envoi ; `no_due_items` (journal non touché) ; `no_recipients` ; garde org → `CampaignNotFoundError`.
- **`RunDueRemindersUseCase`** : parcourt les campagnes actives, agrège `{ campaigns, sent }` ; une
  campagne dont l'envoi **lève** n'interrompt pas le passage (les autres sont traitées).
- **`CampaignRepository.listActive` (in-memory)** : ne renvoie que les `ACTIVE`, toutes orgs.
- **`NotificationLog` (in-memory)** : `lastSentAt` null puis date après `recordSent` ; `recordSent` en
  upsert (2 appels même clé → une seule ligne, `sentAt` mis à jour).
- **Préférence endpoint** : `PATCH` avec `reminderEveryNDays` hors {0,1,2,3,7} → ramené à `1`.
- **Type-check** : `tsc --noEmit` vert API + admin.

## Points de touche (récap)

**API** : `application/notification/campaign-recipients.ts` (retour `{userId,email,everyNDays}`) ;
`application/notification/send-campaign-reminder-digest.use-case.ts` (décision par destinataire +
cadence + `daysBetween`) ; `application/notification/run-due-reminders.use-case.ts` (nouveau) ;
`application/notification/notification-log.repository.ts` + repos (`lastSentAt`/`recordSent`) ;
`domain/notification/notification-preference.ts` + repos + `notification-preference.repository.ts`
(`reminderEveryNDays`) ; `application/parcel/campaign.repository.ts` + repos (`listActive`) ;
`presentation/notification/reminders.scheduler.ts` (nouveau, `@Cron`) ;
`presentation/notification/notification-preference.controller.ts` (body `reminderEveryNDays`) ;
`schema.prisma` + migration (`NotificationPreference`) ; `suivi.module.ts` (`ScheduleModule.forRoot()`,
`RunDueRemindersUseCase`, `RemindersScheduler`, `listActive`) ; `package.json` (`@nestjs/schedule`).

**Admin** : `lib/suivi-actions.ts` (`reminderEveryNDays`) ; `app/membres/NotificationFrequencySelect.tsx`
(remplace le toggle) + `app/membres/page.tsx`.

**Ordre de construction** : (1) préférence `reminderEveryNDays` (domaine/repo/migration/endpoint) ;
(2) `NotificationLog` `lastSentAt`/`recordSent` (upsert) ; (3) résolveur `{userId,email,everyNDays}` ;
(4) use-case remanié (cadence) ; (5) `listActive` + `RunDueRemindersUseCase` ; (6) `@nestjs/schedule` +
`RemindersScheduler` + câblage module ; (7) admin (`Select` de fréquence).

**Sans** : fuseau par org, pagination, conseils par phase (H), file de reprise, SMS/push, déclencheur externe.
