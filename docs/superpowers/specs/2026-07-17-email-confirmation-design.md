# Confirmation d'email à l'inscription — Design

**Statut :** validé (brainstorming), prêt pour le plan d'implémentation.

## Objectif

Remplacer l'auto-connexion à l'inscription par un flux de **confirmation d'email** : à la création d'une organisation, le compte admin est créé **non confirmé**, un email de confirmation est envoyé, et la connexion est **bloquée tant que l'email n'est pas confirmé**. Inclut le **renvoi** de l'email de confirmation.

## Flux cible

1. `/register` → crée l'org + le compte admin **non confirmé**, **pas de connexion**, envoie un email avec un lien de confirmation. L'admin affiche « un email a été envoyé à `<adresse>` » + bouton « renvoyer ».
2. L'utilisateur clique le lien de l'email → `/confirm/<token>` confirme le compte → propose « Se connecter » (redirection vers `/login`).
3. Login d'un compte **confirmé** → dashboard. Un compte **non confirmé** ne peut pas se connecter (403 + option de renvoi).

## Contexte & patterns réutilisés

- L'API (Plan A) a déjà le pattern **invitation** : token unique, statut, expiration, envoi email via `NotificationPort`/Brevo, stub `FakeNotificationSender`. Le flux de confirmation en est un parallèle direct.
- Le modèle `User` n'a aujourd'hui pas de notion de confirmation. Comme la relation confirmation↔user est **1:1**, on stocke les champs **directement sur `User`** (pas de table séparée).
- Base admin pour les liens : on réutilise `INVITE_BASE_URL` (défaut `http://localhost:3000`), déjà utilisée pour les liens d'invitation.
- `RegisterUseCase` crée aujourd'hui org+admin+identity et renvoie un JWT (auto-login). `LoginUseCase` ne vérifie pas la confirmation.

## Périmètre

**Inclus :** champs de confirmation sur `User` + migration ; register sans auto-login + email de confirmation ; endpoints confirm + resend ; gating du login ; variante de notification `email_confirmation` + rendu Brevo ; côté admin : page « email envoyé » (avec renvoi), page `/confirm/[token]`, message login « non confirmé » + renvoi, middleware ; tests ciblés.

**Hors périmètre (dette assumée) :** double opt-in avancé (nombre de renvois limité / rate-limiting), expiration configurable par l'utilisateur, confirmation lors de l'**acceptation d'invitation** (les invités passent déjà par un lien à usage unique — inchangé), changement d'email d'un compte existant.

## Décisions produit (validées)

- Org + compte créés **au register** (non confirmés), pas différés jusqu'à la confirmation.
- **Renvoi** de l'email de confirmation **inclus** dès cette brique.
- Confirm **ne connecte pas** (pas de JWT) → l'utilisateur va sur `/login`.
- Login d'un compte non confirmé → **bloqué** (403) avec message + option de renvoi.
- Expiration du lien : **24 h** (`CONFIRM_TTL_HOURS = 24`).
- Endpoint de renvoi **anti-énumération** : retour uniforme quel que soit l'existence/état du compte.

---

## Section 1 — API : modèle de données & use-cases

**Modèle `User`** (champs ajoutés, relation 1:1) :
- `emailVerifiedAt DateTime?` — null = non confirmé.
- `confirmationToken String? @unique`.
- `confirmationExpiresAt DateTime?`.

→ migration Prisma. Le `confirmationToken` est mis à `null` une fois le compte confirmé.

**Frontière domaine / secret.** Le type domaine `User` (application) ne gagne que **`emailVerifiedAt: Date | null`** (timestamp non sensible, exposable dans les réponses). Le `confirmationToken` est un **secret** et **ne doit jamais** apparaître dans le type `User` (sinon il fuiterait via `login` / `/auth/me`). Token + expiration restent dans la couche persistance, accédés via des méthodes repo dédiées sur `UserRepository` :
- `findByConfirmationToken(token: string): Promise<{ user: User; expiresAt: Date } | null>` — le use-case Confirm y lit `user.emailVerifiedAt` (idempotence) et `expiresAt` (expiration).
- `setConfirmationToken(userId: string, token: string, expiresAt: Date): Promise<void>` — utilisé par Register (initial) et Resend (régénération).
- `confirmEmail(userId: string, verifiedAt: Date): Promise<void>` — pose `emailVerifiedAt`, efface `confirmationToken` + `confirmationExpiresAt`.

Les doubles en mémoire et l'adaptateur Prisma implémentent ces trois méthodes. `save(user)` persiste `emailVerifiedAt` comme les autres champs.

**`RegisterUseCase`** (modifié) : crée org + user admin (`emailVerifiedAt = null`) + identity via `save` ; génère `token = ids.next()`, appelle `setConfirmationToken(user.id, token, now + 24h)` ; envoie une notification `email_confirmation` ; **ne renvoie plus de JWT** → `execute(...) : Promise<{ email: string }>`. En cas d'échec d'envoi email, l'inscription est tout de même persistée (l'utilisateur pourra renvoyer) — cohérent avec le comportement invitation.

**`ConfirmEmailUseCase`** (nouveau) : `execute({ token }) : Promise<{ email: string; alreadyConfirmed: boolean }>` → `const found = users.findByConfirmationToken(token)` ; `!found` → `ConfirmationInvalidError` ; si `found.user.emailVerifiedAt` déjà posé → `{ email: found.user.email, alreadyConfirmed: true }` (idempotent) ; si `found.expiresAt < now` → `ConfirmationInvalidError` ; sinon `confirmEmail(found.user.id, now)` → `{ email: found.user.email, alreadyConfirmed: false }`. Pas de JWT.

**`ResendConfirmationUseCase`** (nouveau) : `execute({ email }) : Promise<void>` → `const user = users.findByEmail(email)` ; si `user` existe **et** `user.emailVerifiedAt == null`, `setConfirmationToken(user.id, ids.next(), now + 24h)` + envoie la notification. Dans **tous** les autres cas (inexistant, déjà confirmé), **ne fait rien** et retourne — retour uniforme (anti-énumération).

**`LoginUseCase`** (modifié) : après vérif du mot de passe et récupération du user, si `user.emailVerifiedAt == null` → `EmailNotConfirmedError`. Sinon, JWT comme aujourd'hui.

## Section 2 — API : notification, endpoints & mapping d'erreurs

**Port `Notification`** — union étendue :
```ts
export type Notification =
  | { kind: 'invitation'; to: string; organizationName: string; inviteUrl: string; expiresAt: Date }
  | { kind: 'email_confirmation'; to: string; confirmUrl: string; expiresAt: Date };
```
`BrevoEmailNotificationSender.render` ajoute un `case 'email_confirmation'` (sujet « Confirmez votre inscription sur Okko », corps HTML avec `confirmUrl` échappé). `FakeNotificationSender` fonctionne déjà (stocke toute `Notification`). `confirmUrl = ${INVITE_BASE_URL ?? 'http://localhost:3000'}/confirm/<token>`.

**Erreurs** (`errors.ts`) : `EmailNotConfirmedError`, `ConfirmationInvalidError`.

**Endpoints** (`AuthController`, tous `@Public()`) :
- `POST /auth/register` — renvoie `201 { status: 'confirmation_sent', email }` (plus de token).
- `POST /auth/confirm/:token` — `ConfirmationInvalidError` → **410** ; sinon `200 { confirmed: boolean, alreadyConfirmed: boolean, email }`.
- `POST /auth/confirm/resend` — body `{ email }` → toujours **202** (retour uniforme).
- `POST /auth/login` — `EmailNotConfirmedError` → **403** (message « Confirmez votre email avant de vous connecter »).

## Section 3 — Admin : pages & flux

**`/register`** — `registerAction` n'appelle plus `setSession`/`redirect`. Retourne `{ ok: true, email }` (ou `{ error }`). `RegisterForm` : sur `ok`, remplace le formulaire par un panneau « Un email de confirmation a été envoyé à `<email>` » + bouton « Renvoyer l'email » (→ `resendConfirmationAction`).

**`/confirm/[token]`** *(route publique)* — page affichant un bouton « Confirmer mon inscription » qui déclenche `confirmAction(token)` (Server Action ; évite de confirmer sur un prefetch). Résultat :
- confirmé / déjà confirmé → « Compte confirmé ✓ » + bouton « Se connecter » (`/login`) ;
- 410 (invalide/expiré) → message + champ email + bouton « Renvoyer un email de confirmation ».

**`/login`** — `loginAction` mappe le **403 non-confirmé** vers un message dédié (distinct du 401). La page affiche alors un lien/bloc « Renvoyer l'email de confirmation ».

**Server Actions admin** : `resendConfirmationAction(email)`, `confirmAction(token)` (via `publicFetch`). Nouveaux appels `lib/api.ts` : `apiConfirmEmail(token)`, `apiResendConfirmation(email)` ; `apiRegister` renvoie désormais `{ status, email }` (plus `AuthResult`).

**Middleware** : `/confirm/` ajouté à `isPublic` ; `/confirm/*` ajouté au rendu « bare » d'`AppShell`.

## Section 4 — Tests

**API** (Jest, doubles en mémoire + `FakeNotificationSender`, aucun réseau réel) :
- `RegisterUseCase` : user non confirmé, **pas** de token, notification `email_confirmation` émise.
- `ConfirmEmailUseCase` : token valide → confirme (`emailVerifiedAt` posé, token effacé) ; inconnu/expiré → `ConfirmationInvalidError` ; déjà confirmé → `alreadyConfirmed`.
- `ResendConfirmationUseCase` : non confirmé → nouveau token + notification ; inexistant/déjà confirmé → aucun effet, aucune fuite.
- `LoginUseCase` : non confirmé → `EmailNotConfirmedError` ; confirmé → token OK.
- **e2e** (⚠️ efface la DB — prévenir) : `register` (201, pas de token) → `login` **403** → `confirm/:token` → `login` OK → `/auth/me` ; `confirm` token invalide → 410.

**Admin** (Vitest, `fetch`/actions mockés) :
- `registerAction` : succès → `{ ok, email }` (plus de redirect) ; `resendConfirmationAction`/`confirmAction` mappent les erreurs.
- `loginAction` : 403 → message dédié.
- Middleware : `/confirm/tok` public sans session.

**Validation manuelle finale** : register → email (stub/log) → `/confirm/<token>` → login → dashboard.

---

## Critères de succès

- [ ] `User` porte `emailVerifiedAt`/`confirmationToken`/`confirmationExpiresAt` + migration.
- [ ] Register crée un compte non confirmé, **sans JWT**, et envoie l'email de confirmation.
- [ ] `POST /auth/confirm/:token` confirme (idempotent si déjà confirmé), 410 si invalide/expiré.
- [ ] `POST /auth/confirm/resend` renvoie l'email pour un compte non confirmé, **anti-énumération** (202 uniforme).
- [ ] Login bloqué pour un compte non confirmé (403) ; OK une fois confirmé.
- [ ] Notification `email_confirmation` + rendu Brevo ; stub en test (aucun appel Brevo réel en CI).
- [ ] Admin : page « email envoyé » + renvoi ; `/confirm/[token]` ; message login non-confirmé + renvoi ; middleware public sur `/confirm/`.
- [ ] Suites API + admin vertes ; aucun réseau réel en test.
- [ ] Périmètre respecté : pas de rate-limiting, pas de confirmation sur l'acceptation d'invitation, pas de changement d'email.

## Suite

Brique **Carnet** (parcelles/cycles) inchangée dans son planning. Durcissements possibles ultérieurs : rate-limiting du renvoi, expiration/renvoi configurables.
