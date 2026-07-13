# Spec — Authentification, organisations & rôles (Carnet, brique 1a)

**Projet** : Okko — API (NestJS + Prisma/Postgres) + admin (Next.js 14)
**Date** : 2026-07-13
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Poser le socle d'**identité et d'accès** avant de construire le Carnet de suivi (Phase 1). Aujourd'hui l'app n'a **aucune authentification** : la Base éditoriale est ouverte et l'audit utilise un `ACTOR = 'admin'` codé en dur (`crop.controller.ts:51`).

Cette brique introduit : comptes utilisateurs, **organisations** (multi-tenant), **rôles** (`superadmin`/`admin`/`editor`), inscription, connexion, **invitations par email**, et le **gating** des surfaces — le tout **côté API (JWT + guards)** pour être réutilisable par la future app mobile agriculteur. Elle ne construit pas encore le domaine carnet (parcelles/cycles = brique 1b) : la vue « Suivi » est un placeholder gardé.

C'est la première des deux sous-briques de la Phase 1, pièce 1 (auth d'abord, puis parcelle+cycle).

## 2. Contexte (vérifié)

- API : NestJS, `AppModule` importe `CropModule`. Persistance **Prisma/Postgres** (`schema.prisma`, migrations). CORS vers `http://localhost:3000` (`app.setup.ts`, `CORS_ORIGIN`). Aucune dépendance auth (`@nestjs/jwt`, `bcryptjs`, `jsonwebtoken` absents).
- Repos non systématiquement event-sourcés : seul l'agrégat `Crop` l'est ; zones/ravageurs sont des modèles Prisma simples → **User/Org/Invitation en Prisma simple** (pas d'event-sourcing).
- Admin : Next.js 14 App Router. `apps/admin/src/lib/api.ts` fetch l'API via `BASE` (`NEXT_PUBLIC_API_URL`), server components en `no-store`, writes via un helper `mutate`. **Aucun `middleware.ts`.** Sections existantes : `/crops`, `/zones`, `/pests`, `/history`, dashboard `/`.
- Audit : `ACTOR = 'admin'` codé en dur, passé comme `actor` à tous les use-cases (`crop.controller.ts`).
- Décisions brainstorming (verbatim) : auth **API-owned (JWT)** ; **3 rôles** superadmin/admin/editor ; superadmin **semé**, hors org, accède à l'admin Base ; `admin` s'inscrit → **crée son organisation** ; `editor` **invité** (saisie) ; schéma d'auth **agnostique du provider** (`User` séparé de `AuthIdentity`) pour préparer le social auth ; invitation **par email** via une **couche notification hexagonale** avec adaptateur **Brevo** (swappable, extensible SMS/push) ; endpoints Base **superadmin-only** ; `/published` public.

## 3. Périmètre

### Dans le lot
- **Modèles** Prisma : `Organization`, `User`, `AuthIdentity`, `Invitation` (+ migration).
- **API `AuthModule`** : register, login, me, invitations (créer/lister/révoquer/accepter). JWT `{sub, role, organizationId}`, `AuthGuard` + `RolesGuard`.
- **Port notification** hexagonal + **adaptateur Brevo** (email transactionnel) + **stub de test**.
- **Protection de l'existant** : endpoints éditoriaux Base → `superadmin` ; `/published` public ; audit `actor` = utilisateur authentifié.
- **Admin (Next, BFF)** : pages `/login`, `/register`, `/invite/[token]`, écran **Membres** (liste + inviter) ; login/accept posent un **cookie httpOnly** ; `/logout` ; **middleware** de gating ; server components transmettent le `Bearer` à l'API.
- **Seed** d'un compte superadmin.

### Hors périmètre (prêt mais non fait)
- **Domaine carnet** : parcelles, cycles, plan daté, journal (brique 1b). La route `/suivi` est un placeholder gardé.
- **App mobile/offline** agriculteur (surface future, même auth API).
- **Reset de mot de passe**, vérification d'email, **refresh tokens** (JWT à durée de vie simple en v1).
- **Providers sociaux** (schéma prêt via `AuthIdentity.provider`, non implémentés).
- **SMS/push** (port prêt, un seul adaptateur email en v1).
- Permissions fines au-delà des 3 rôles ; changement de mot de passe en libre-service.

### Comportement préservé
- Les fonctionnalités Base (édition/publication/versions/vue client) : inchangées, simplement **gardées** derrière `superadmin`.
- `/published` reste **publique** (consommation client, future app).

## 4. Modèle de données (Prisma)

```prisma
model Organization {
  id        String   @id
  name      String
  createdAt DateTime @default(now())
  users     User[]
  invitations Invitation[]
}

model User {
  id             String        @id
  email          String        @unique
  name           String
  role           String        // 'superadmin' | 'admin' | 'editor'
  organizationId String?       // null pour superadmin
  organization   Organization? @relation(fields: [organizationId], references: [id])
  identities     AuthIdentity[]
  createdAt      DateTime      @default(now())
}

model AuthIdentity {
  id         String   @id
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  provider   String   // 'password' (futurs: 'google', ...)
  identifier String   // email pour 'password'
  secret     String   // hash bcrypt pour 'password'
  createdAt  DateTime @default(now())
  @@unique([provider, identifier])
}

model Invitation {
  id               String   @id
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id])
  email            String
  role             String   // 'editor'
  token            String   @unique
  status           String   // 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt        DateTime
  invitedByUserId  String
  createdAt        DateTime @default(now())
  acceptedAt       DateTime?
}
```

Rôles = union de chaînes typée côté domaine (`Role = 'superadmin' | 'admin' | 'editor'`). Ids générés via l'`UuidIdGenerator` existant.

## 5. Rôles & accès

| Rôle | Organisation | Accès |
|---|---|---|
| `superadmin` | aucune | admin Base (`/crops`, `/zones`, `/pests`, dashboard éditorial) |
| `admin` | la sienne (créée à l'inscription) | Suivi de son org ; invite/révoque des `editor` ; gère son org |
| `editor` | celle de l'invitation | Suivi de son org (saisie en 1b) ; pas de gestion d'org/invitations |

- Le **cloisonnement inter-organisations** est une règle de sécurité : un `admin`/`editor` n'agit **que** dans `organizationId` de son JWT. Les endpoints d'org (invitations, et tout le carnet en 1b) filtrent par cet `organizationId` ; jamais par un id fourni par le client.

## 6. Architecture — API

### 6.1 `AuthModule`
Déps ajoutées : `@nestjs/jwt`, `bcryptjs`. Pas de Passport (garde maison, moins de déps).

**Domaine / application**
- `Role` (union typée). `PasswordHasher` (port) → `BcryptPasswordHasher` (adaptateur, `bcryptjs`).
- `AuthTokenService` : signe/vérifie un JWT `{ sub, role, organizationId }` (secret `JWT_SECRET`, expiration `JWT_EXPIRES_IN` p.ex. `7d`).
- Use-cases : `RegisterUseCase`, `LoginUseCase`, `CreateInvitationUseCase`, `AcceptInvitationUseCase`, `RevokeInvitationUseCase`, `ListInvitationsUseCase`, `GetMeUseCase`.
- Repositories (ports) : `UserRepository`, `OrganizationRepository`, `InvitationRepository` → adaptateurs Prisma.
- Erreurs de domaine mappées HTTP : `EmailAlreadyUsedError`→409, `InvalidCredentialsError`→401, `InvitationNotFoundError`/`InvitationInvalidError` (expirée/consommée/révoquée)→404/410, `ForbiddenOrgError`→403.

**Endpoints (`AuthController`, `@Controller('auth')`)**
- `POST /auth/register` `{ email, password, name, organizationName }` → crée `Organization` + `User(role='admin')` + `AuthIdentity(provider='password')` → `{ token, user }`. Email déjà pris → 409.
- `POST /auth/login` `{ email, password }` → vérifie `AuthIdentity(password)` → `{ token, user }` ; échec → 401.
- `GET /auth/me` (authentifié) → profil `{ id, email, name, role, organizationId }`.
- `POST /auth/invitations` (`admin`) `{ email }` → crée `Invitation(role='editor', token, status='pending', expiresAt = now + 7j)` dans **son** org → **envoie l'email via le port notification** → renvoie l'invitation (avec `inviteUrl`). Email déjà membre de l'org → 409.
- `GET /auth/invitations` (`admin`) → invitations de **son** org.
- `POST /auth/invitations/:id/revoke` (`admin`, invitation de son org) → `status='revoked'`.
- `POST /auth/invitations/:token/accept` `{ name, password }` (public) → valide le token (pending & non expiré) → crée `User(role='editor', organizationId=invitation.org)` + `AuthIdentity` → `status='accepted'`, `acceptedAt` → `{ token, user }` (auto-login). Token invalide/expiré/consommé → 410.

**Guards**
- `AuthGuard` : lit `Authorization: Bearer <jwt>`, vérifie, pose `request.user = { id, role, organizationId }`. Absent/invalide → 401.
- `RolesGuard` + décorateur `@Roles(...roles)` : 403 si le rôle n'est pas autorisé.
- Décorateur `@CurrentUser()` pour injecter l'utilisateur.

### 6.2 Protection de l'existant
- `CropController`, `ZoneController`, `PestController` (endpoints éditoriaux) → `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('superadmin')`. **Exception** : la vue client `/published` reste **publique** (pas de guard).
- Remplacer `ACTOR` codé en dur par l'utilisateur courant : `actor = req.user.email` (via `@CurrentUser()`), propagé aux use-cases. (`AuthModule` exporte les guards ; `CropModule` les importe.)

### 6.3 Notification (hexagonal)
- **Port** `NOTIFICATION_PORT` (Symbol) : `interface NotificationPort { send(n: Notification): Promise<void> }`.
- `Notification` (union discriminée, v1 un seul membre) : `{ kind: 'invitation'; to: string; organizationName: string; inviteUrl: string; expiresAt: Date }`.
- **Adaptateur** `BrevoEmailNotificationSender` : appelle l'API transactionnelle Brevo (`POST https://api.brevo.com/v3/smtp/email`, header `api-key: BREVO_API_KEY`, expéditeur `BREVO_SENDER`) via `fetch` natif ; mappe `kind='invitation'` → sujet + corps HTML contenant `inviteUrl`. Toute erreur réseau/HTTP est **propagée** (l'admin doit savoir que l'envoi a échoué) mais **ne casse pas** la création de l'invitation déjà persistée → l'endpoint renvoie l'invitation avec un indicateur `emailSent: boolean`.
- **Stub** `FakeNotificationSender` (enregistre les `send`, aucune I/O) : **branché dans tous les tests** → aucun appel Brevo en CI. L'envoi réel est validé en **smoke** uniquement.
- Extension future (SMS/push) = nouvel adaptateur + nouveaux `kind`, sans toucher le domaine.

### 6.4 Seed superadmin
- Script `prisma/seed` (ou commande Nest) créant un `User(role='superadmin', organizationId=null)` + `AuthIdentity(password)` depuis `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` (env). Idempotent (upsert par email). Documenté dans le README.

## 7. Architecture — Admin (Next, BFF)

### 7.1 Session
- `POST /login` et l'acceptation d'invitation appellent l'API via un **route handler Next** (`app/api/auth/.../route.ts`) qui reçoit le JWT et le pose en **cookie httpOnly** (`Secure`, `SameSite=Lax`) sur l'origine Next.
- Les server components lisent le cookie (`cookies()`), et `lib/api.ts` transmet `Authorization: Bearer <jwt>` à l'API (les fetch serveur passent le token ; garder `no-store`).
- `/logout` : route handler qui efface le cookie et redirige vers `/login`.

### 7.2 Pages
- `/login` : email + mot de passe.
- `/register` : nom, email, mot de passe, **nom de l'organisation** → connecte et redirige vers `/suivi`.
- `/invite/[token]` : affiche l'org invitante ; formulaire nom + mot de passe → accepte → connecte → `/suivi`. Token invalide → message clair.
- **Membres** (`/membres`, `admin`) : liste des membres + invitations (statut), formulaire « Inviter un editor » (email) ; action révoquer.
- `/suivi` : **placeholder** gardé (« Le carnet de suivi arrive bientôt »), rempli en 1b.
- `lib/api.ts` : `register`, `login`, `me`, `logout`, `createInvitation`, `listInvitations`, `revokeInvitation`, `acceptInvitation`.

### 7.3 Middleware (`apps/admin/src/middleware.ts`)
- Lit le cookie de session (présence + rôle ; le rôle est lu depuis un cookie non sensible ou décodé du JWT côté serveur).
- Non authentifié → redirection `/login` (sauf routes publiques : `/login`, `/register`, `/invite/*`).
- `superadmin` → autorisé sur `/crops`, `/zones`, `/pests`, dashboard éditorial ; redirigé hors `/suivi`.
- `admin`/`editor` → autorisés sur `/suivi`, `/membres` (admin seulement pour `/membres`) ; redirigés hors des sections Base.
- Un rôle sur la mauvaise section → redirigé vers **sa** section d'accueil.

## 8. Gestion d'erreur

| Cas | Réponse API | UX admin |
|---|---|---|
| Email déjà utilisé (register/invite) | 409 | message inline |
| Identifiants invalides (login) | 401 | « email ou mot de passe incorrect » |
| Token d'invitation invalide/expiré/consommé | 410 | page invite : message + lien vers `/login` |
| Endpoint Base sans token / mauvais rôle | 401 / 403 | middleware redirige avant l'appel |
| Action inter-org (admin agit sur une autre org) | 403 | n/a (filtrage serveur) |
| Envoi email Brevo en échec | 200 + `emailSent:false` | écran Membres : « invitation créée, email non envoyé — partagez le lien » (affiche `inviteUrl`) |

## 9. Tests

### API (Jest ; ⚠️ la suite efface la DB — prévenir)
- `BcryptPasswordHasher` : hash ≠ clair, `verify` ok/ko.
- `AuthTokenService` : round-trip `{sub, role, organizationId}` ; token trafiqué → rejet.
- `RegisterUseCase` : crée Org + admin + identity ; email déjà pris → `EmailAlreadyUsedError`.
- `LoginUseCase` : identifiants ok → token ; ko → `InvalidCredentialsError`.
- `CreateInvitationUseCase` : crée l'invitation dans l'org de l'admin, appelle le **stub** notification ; email déjà membre → 409.
- `AcceptInvitationUseCase` : crée l'`editor` dans la **bonne** org ; token **à usage unique** (2e accept → invalide) ; expiré → rejet.
- **Isolation inter-org** : un admin ne peut ni lister ni révoquer les invitations d'une autre org (403).
- `RolesGuard`/`AuthGuard` (e2e) : `POST /crops` sans token → 401 ; avec `editor` → 403 ; avec `superadmin` → 200. `GET /published` reste 200 sans token.
- e2e complet : register → invite (stub) → accept via token → login de l'editor → `GET /auth/me`.
- Non-régression : suite existante verte (les guards ajoutés sur les endpoints Base ne cassent pas les tests, qui passent un token superadmin de test ou un contexte d'auth injecté).

### Admin
- `pnpm --filter @okko/admin build` vert.
- Smoke manuel : inscription → `/suivi` ; superadmin (semé) → Base ; invite un editor → **email Brevo réel reçu** → accept via lien → `/suivi` ; un rôle sur la mauvaise section → redirigé ; logout.

## 10. Critères de succès
- [ ] Modèles `Organization`/`User`/`AuthIdentity`/`Invitation` + migration ; schéma provider-agnostique.
- [ ] `AuthModule` : register/login/me + invitations (créer/lister/révoquer/accepter) ; JWT + `AuthGuard`/`RolesGuard` ; erreurs mappées.
- [ ] Port notification + adaptateur Brevo + **stub en test** (aucun appel Brevo en CI) ; email d'invitation en smoke.
- [ ] Endpoints Base `superadmin`-only ; `/published` public ; audit `actor` = utilisateur authentifié.
- [ ] Admin : `/login`, `/register`, `/invite/[token]`, `/membres`, `/suivi` placeholder, `/logout` ; cookie httpOnly ; middleware de gating.
- [ ] Seed superadmin (env, idempotent, documenté).
- [ ] Suite API verte ; build admin vert ; cloisonnement inter-org testé.
- [ ] Périmètre respecté : pas de domaine carnet, pas de social/SMS/push/reset (seulement le terrain préparé).

## Références
- Vision §Module 2 (Carnet), feuille de route Phase 1.
- API : `apps/api/prisma/schema.prisma`, `app.module.ts`, `app.setup.ts`, `crop.controller.ts:51` (ACTOR), `infrastructure/uuid-id-generator.ts`, `infrastructure/prisma/prisma.service.ts`. Nouveaux : `auth.module.ts`, `application/auth/*`, `infrastructure/auth/*`, `infrastructure/notification/*`, `presentation/auth/auth.controller.ts`.
- Admin : `lib/api.ts`, `middleware.ts` (nouveau), `app/(auth)/login|register|invite/[token]`, `app/membres`, `app/suivi`, `app/api/auth/*` (route handlers).
- Brevo : API transactionnelle `POST https://api.brevo.com/v3/smtp/email`.
