# Spec — Module 2 / Brique F « Canal & préférences de notification »

**Date** : 2026-08-12
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 2 (carnet de suivi) — socle d'envoi des notifications de suivi

## Contexte

Les recommandations datées (brique D) sont aujourd'hui **passives** : le moteur `computeRecommendations`
calcule des statuts d'échéance (`OVERDUE`/`DUE_SOON`/…) affichés **seulement** quand le technicien
ouvre le journal d'une campagne. Rien n'est envoyé. On veut un vrai canal de **rappels** poussés.

Ce chantier se décompose en 3 briques : **F** (ce spec) = le **canal & les préférences** (socle) ;
**G** = le **planificateur/cron** qui recalcule les échéances et appelle F en boucle ; **H** = les
**conseils par phase phénologique**. F est le socle sans lequel G et H n'ont rien pour envoyer.

### État actuel (audité, réutilisé)

- **Canal notification déjà présent** : `NotificationPort.send(n)` (`application/notification/notification-port.ts`),
  type `Notification` en union discriminée (2 kinds : `invitation`, `email_confirmation`). Rendu par
  `BrevoEmailNotificationSender` (**email via l'API Brevo**, env `BREVO_API_KEY`/`BREVO_SENDER`).
  `FakeNotificationSender` (capte `sent[]`) pour les tests. Fourni via `{ provide: NOTIFICATION_PORT, useClass: BrevoEmailNotificationSender }` (auth.module).
- **Moteur reco (brique D)** : `GetCampaignRecommendationsUseCase.execute({ campaignId, organizationId })`
  → `{ hasReference, items: RecommendationItem[], sowingAdvisory? }` ; `RecommendationItem.status ∈
  { DONE, OVERDUE, DUE_SOON, UPCOMING, UNDATED }`, `.label` (FR), `.dueDate?` (ISO). Déjà fourni au `SuiviModule`.
- **Utilisateurs** : `USER_REPOSITORY.listByOrganization(orgId): Promise<User[]>` existe. `User =
  { id, email, firstName, lastName, role, organizationId, emailVerifiedAt: Date|null, createdAt }`.
  **Email confirmé** ⇔ `emailVerifiedAt != null`. Rôles tenant : `ORG_ADMIN`, `AGRONOMIST`, `FIELD_AGENT`, `VIEWER`.
- **Campagne/Parcelle** : `CAMPAIGN_REPOSITORY.findById` (`CampaignSnapshot` : `parcelId`, `season`, `organizationId`…),
  `PARCEL_REPOSITORY.findById` (`ParcelSnapshot.name`). Tous deux déjà fournis au `SuiviModule`.
- **Bénéficiaire** : seulement `phone?`, **pas d'email** → non notifiable par email (hors v1).
- **URL de base des liens email** : `process.env.INVITE_BASE_URL ?? 'http://localhost:3000'` (utilisé par
  les liens de confirmation/invitation) → base de l'app admin.

## Objectifs

1. Envoyer un **rappel d'échéances** par **email** aux **utilisateurs tenant à rôle terrain** d'une
   organisation, sous forme de **digest par campagne** (un email regroupant toutes les échéances dues).
2. **Anti-spam** : au plus **un digest par campagne et par jour** (journal d'envois idempotent).
3. **Préférence par utilisateur** : chacun peut se désabonner des rappels (défaut : activé).
4. **Déclencheur manuel** (endpoint + bouton admin) pour vérifier toute la chaîne dès F, avant le cron (G).

## Non-objectifs (briques suivantes / hors périmètre)

- **Planificateur/cron** (brique G) — F expose le use-case ; G l'appellera en boucle.
- **Conseils par phase phénologique** (brique H).
- Canaux **SMS / push / in-app** ; notifier directement le **bénéficiaire** (agriculteur).
- **Digest par utilisateur** multi-campagnes (regroupement transverse) — v1 = digest par campagne.
- URLs signées ; internationalisation au-delà du FR.

## Modèle de données (2 tables additives)

### `NotificationPreference` — désabonnement par utilisateur

| Champ | Type | Notes |
|---|---|---|
| `userId` | `String @id` | 1 ligne par utilisateur (clé = userId) |
| `remindersEnabled` | `Boolean @default(true)` | rappels de suivi par email |
| `updatedAt` | `DateTime @updatedAt` | |

**Absence de ligne = activé** (défaut `true`). Un utilisateur qui se désabonne crée/màj une ligne à `false`.

### `NotificationLog` — journal anti-spam (dédup)

| Champ | Type | Notes |
|---|---|---|
| `id` | `String @id` | uuid |
| `organizationId` | `String` | isolation/observabilité (`@@index`) |
| `dedupKey` | `String @unique` | ex. `campaign_reminder:{campaignId}:{YYYY-MM-DD}` |
| `kind` | `String` | ex. `campaign_reminder` |
| `sentAt` | `DateTime @default(now())` | |

Migrations additives uniquement.

## API (domaine → use-case → présentation)

### Type de notification (étend l'union existante)

Dans `application/notification/notification-port.ts`, ajouter un kind :

```ts
| { kind: 'campaign_reminder'; to: string; campaignLabel: string;
    items: { label: string; dueDate?: string; status: 'OVERDUE' | 'DUE_SOON' }[];
    journalUrl: string }
```

`BrevoEmailNotificationSender.render` gagne un `case 'campaign_reminder'` : sujet
`Rappel de suivi — {campaignLabel}` ; HTML = intro + liste `<ul>` des items (libellé + statut FR
« En retard »/« Bientôt » + `dueDate` formatée si présente) + lien vers le journal (`journalUrl`).
`FakeNotificationSender` capte le kind sans changement (il pousse `n` brut).

### Résolveur de destinataires

`resolveCampaignRecipients(userRepo, prefRepo, organizationId): Promise<string[]>` — fonction pure
du module suivi (les deux repos injectés en paramètres, appelée par le use-case) :
1. `users = userRepo.listByOrganization(organizationId)` ;
2. garde `role ∈ { ORG_ADMIN, AGRONOMIST, FIELD_AGENT }` **et** `emailVerifiedAt != null` ;
3. pour chacun, exclut si `NotificationPreference.remindersEnabled === false` (absence = gardé) ;
4. retourne la liste d'**emails**.

### Use-case `SendCampaignReminderDigestUseCase`

Injecte : `CAMPAIGN_REPOSITORY`, `PARCEL_REPOSITORY`, `GetCampaignRecommendationsUseCase`,
`USER_REPOSITORY`, `NOTIFICATION_PREFERENCE_REPOSITORY`, `NOTIFICATION_LOG_REPOSITORY`,
`NOTIFICATION_PORT`, `Clock`.

`execute({ campaignId, organizationId, today })` → `{ sent: number; skipped?: 'already_sent' | 'no_due_items' | 'no_recipients' }` :
1. charge la campagne ; garde org (`campaign.organizationId !== organizationId` → `CampaignNotFoundError`) ;
2. `dedupKey = campaign_reminder:{campaignId}:{today.slice(0,10)}` ; si `log.existsByDedupKey(dedupKey)`
   → `{ sent: 0, skipped: 'already_sent' }` (idempotent) ;
3. `reco = GetCampaignRecommendationsUseCase.execute({ campaignId, organizationId })` ;
   `items = reco.items.filter(i => i.status === 'OVERDUE' || i.status === 'DUE_SOON')` ;
   si vide → `{ sent: 0, skipped: 'no_due_items' }` (**ne pas** écrire le journal : une échéance
   pourra survenir plus tard le même jour) ;
4. `recipients = resolveCampaignRecipients(organizationId)` ; si vide → `{ sent: 0, skipped: 'no_recipients' }` ;
5. `parcel = PARCEL_REPOSITORY.findById(campaign.parcelId)` ;
   `campaignLabel = ${parcel?.name ?? 'Parcelle'} — ${campaign.season}` ;
   `journalUrl = ${INVITE_BASE_URL}/parcelles/${campaign.parcelId}/campagnes/${campaignId}` ;
6. pour chaque email : `notifier.send({ kind: 'campaign_reminder', to, campaignLabel,
   items: items.map(i => ({ label: i.label, dueDate: i.dueDate, status: i.status })), journalUrl })` ;
7. `log.record({ dedupKey, kind: 'campaign_reminder', organizationId })` ; `{ sent: recipients.length }`.

> Chaque destinataire reçoit **son** email digest (N destinataires = N emails). Le « digest par
> campagne » désigne le **regroupement du contenu** (toutes les échéances dues dans un seul email),
> pas un email unique.

### Endpoints

- **Déclencheur manuel** : `POST /campaigns/:id/notify-reminder` (sur `CampaignController`),
  `@Roles('ORG_ADMIN','AGRONOMIST','FIELD_AGENT')`, `organizationId` du JWT →
  `SendCampaignReminderDigestUseCase.execute({ campaignId, organizationId, today: clock.nowIso() })`.
  Renvoie `{ sent, skipped? }`. `CampaignNotFoundError` → 404.
- **Préférence (self-service)** : petit contrôleur `NotificationPreferenceController` monté sur `/me/notification-preferences` :
  - `GET` (4 rôles tenant) → `{ remindersEnabled: boolean }` (absence = `true`) pour l'utilisateur du JWT (`user.sub`) ;
  - `PATCH` (4 rôles tenant) body `{ remindersEnabled: boolean }` → upsert la préférence de `user.sub`.

### Module

`SuiviModule` gagne : providers des 2 repos (`NOTIFICATION_PREFERENCE_REPOSITORY` →
`PrismaNotificationPreferenceRepository`, `NOTIFICATION_LOG_REPOSITORY` → `PrismaNotificationLogRepository`),
le `SendCampaignReminderDigestUseCase`, le `NotificationPreferenceController`, et
**fournit `NOTIFICATION_PORT`** via `{ provide: NOTIFICATION_PORT, useClass: BrevoEmailNotificationSender }`
(même technique que `STORAGE_PORT` en brique E — le `SuiviModule` a déjà besoin de fournir ses ports).
Le use-case injecte `USER_REPOSITORY` (fourni par `AuthModule`, déjà importé par `SuiviModule`) —
**l'exporter d'`AuthModule` s'il ne l'est pas déjà** ; sinon lier `PrismaUserRepository` localement.

## Admin (une seule app, gatée par rôle)

- **Page journal** (`app/parcelles/[id]/campagnes/[cid]/page.tsx`) : un bouton **« Envoyer un rappel
  maintenant »** (rôles écriture) appelle `POST /campaigns/:id/notify-reminder` via une action serveur,
  puis affiche un retour : `sent > 0` → « Rappel envoyé à {sent} destinataire(s) » ; `skipped` →
  message adapté (« Aucune échéance due », « Déjà envoyé aujourd'hui », « Aucun destinataire éligible »).
- **Préférence utilisateur** : une case à cocher **« Recevoir les rappels de suivi par email »**
  (composant client `NotificationPreferenceToggle`, lit `GET` / écrit `PATCH /me/notification-preferences`),
  placée sur la page **Membres** (`app/membres/…` — en-tête « Mes préférences »), visible par tout
  utilisateur tenant connecté.
- **Client API** (`lib/api.ts` / `lib/suivi-actions.ts`) : action `notifyCampaignReminder(campaignId)`
  → `{ sent, skipped? }` ; `getNotificationPreference()` / `setNotificationPreference(remindersEnabled)`.

## Tests

- **`SendCampaignReminderDigestUseCase`** (in-memory repos + `FakeNotificationSender`) :
  - envoie un digest aux destinataires éligibles ; le payload ne contient que les items
    `OVERDUE`+`DUE_SOON` (les `DONE`/`UPCOMING`/`UNDATED` sont exclus) ;
  - **idempotence** : 2ᵉ appel le même jour → `skipped: 'already_sent'`, aucun email supplémentaire ;
  - aucune échéance due → `skipped: 'no_due_items'`, **journal non écrit** (un appel ultérieur peut envoyer) ;
  - aucun destinataire éligible → `skipped: 'no_recipients'` ;
  - garde d'org : campagne d'une autre org → `CampaignNotFoundError`.
- **Résolveur `resolveCampaignRecipients`** : exclut les rôles non-terrain (VIEWER), les emails non
  confirmés (`emailVerifiedAt == null`), et les préférences `remindersEnabled === false` ; garde
  ceux sans ligne de préférence (défaut activé).
- **Rendu Brevo** : `render({ kind: 'campaign_reminder', … })` produit un `subject` contenant le
  `campaignLabel` et un HTML contenant chaque libellé d'item + le `journalUrl` (échappé).
- **Rôles** (métadonnées `@Roles`, comme les briques précédentes) : `POST /campaigns/:id/notify-reminder`
  = 3 rôles écriture (VIEWER exclu) ; `GET`/`PATCH /me/notification-preferences` = 4 rôles tenant.
- **Type-check** : `tsc --noEmit` vert API + admin.

## Points de touche (récap)

**API** : `application/notification/notification-port.ts` (+kind `campaign_reminder`) ;
`infrastructure/notification/brevo-email-notification-sender.ts` (`case 'campaign_reminder'`) ;
`domain/notification/notification-preference.ts` + `notification-log.ts` (snapshots) ;
`application/notification/*.repository.ts` (2 ports) + `send-campaign-reminder-digest.use-case.ts` +
`campaign-recipients.ts` (résolveur) ; `infrastructure/notification/prisma-*.repository.ts` (+ in-memory
pour tests) ; `presentation/parcel/campaign.controller.ts` (`POST :id/notify-reminder`) ;
`presentation/notification/notification-preference.controller.ts` ; `schema.prisma` + migration
(2 tables) ; `suivi.module.ts` (repos + use-case + résolveur + contrôleur préférence + `NOTIFICATION_PORT`).

**Admin** : `lib/api.ts` + `lib/suivi-actions.ts` (3 actions) ; page journal (bouton « Envoyer un
rappel ») ; `NotificationPreferenceToggle` (case à cocher, page Membres).

**Ordre de construction** : (1) type+rendu+tables+repos+résolveur+use-case+tests ; (2) endpoints
(déclencheur + préférence) + provider `NOTIFICATION_PORT` au module ; (3) admin (bouton rappel + toggle).

**Sans** : cron (G), conseils par stade (H), SMS/push/in-app, notification du bénéficiaire, digest
multi-campagnes, URLs signées.
