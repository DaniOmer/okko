# Onboarding : prénom/nom + UX d'invitation — Design

**Statut :** validé (brainstorming), prêt pour le plan d'implémentation.

## Objectif

Trois améliorations d'onboarding : (1) séparer le champ `name` en **prénom / nom** partout (register et acceptation d'invitation) ; (2) sur la page d'acceptation, **pré-remplir l'email** (verrouillé) et afficher l'organisation ; (3) **vider le champ email** du formulaire d'invitation après un envoi réussi.

## Contexte & état existant

- `User` a un seul champ `name` (colonne Prisma + type domaine). **`User.name` n'est affiché nulle part** dans l'admin (le header montre l'email, `/membres` montre l'email des invitations) — le découper n'a donc aucun impact d'affichage.
- `RegisterUseCase` / `AcceptInvitationUseCase` prennent `name`. L'email de l'invité vient déjà du token (`inv.email`), pas du client.
- **Aucun endpoint** ne résout un token d'invitation → email ; la page `/invite/[token]` ne connaît donc pas l'email (impossible de pré-remplir aujourd'hui).
- `/membres` `InviteForm` : input non contrôlé, pas de reset après succès.
- Le type `Invitation` a `email`, `organizationId`, `status`, `expiresAt` mais pas de nom d'org (jointure nécessaire pour l'afficher).

## Périmètre

**Inclus :** migration `name` → `firstName`/`lastName` (backfill) ; adaptation register/accept (use-cases, endpoints, formulaires) ; nouvel endpoint public `GET /auth/invitations/:token` + use-case ; page `/invite/[token]` avec org + email verrouillé + gestion précoce du lien invalide ; reset du champ d'invitation ; tests ciblés.

**Hors périmètre :** affichage du nom complet dans l'UI (rien ne l'affiche ; on ne l'ajoute pas) ; renvoi d'invitation ; modification d'un nom existant.

## Décisions produit (validées)

- **Remplacer** `name` par `firstName` + `lastName` (pas de champ `name` conservé) ; backfill des lignes existantes.
- Page d'acceptation **complète** : nom d'org, email **pré-rempli verrouillé**, détection précoce du lien invalide.

---

## Section 1 — API : modèle & use-cases

**Modèle `User`** : remplacer `name String` par `firstName String` + `lastName String`.
- Migration Prisma : ajouter `firstName`/`lastName` (d'abord nullable), **backfill** depuis `name` :
  - `firstName` = partie avant le 1er espace ; `lastName` = le reste (`''` si pas d'espace).
  - SQL : `UPDATE "User" SET "firstName" = split_part("name", ' ', 1), "lastName" = CASE WHEN position(' ' in "name") > 0 THEN trim(substring("name" from position(' ' in "name") + 1)) ELSE '' END;`
  - puis `ALTER COLUMN ... SET NOT NULL` sur les deux, et `DROP COLUMN "name"`.
- Type domaine `User` : `name: string` → `firstName: string; lastName: string`.
- **Seed superadmin** (`prisma/seed.ts`) : `firstName: 'Super', lastName: 'Admin'`.

**`RegisterUseCase`** : `RegisterInput = { email, password, firstName, lastName, organizationName }` ; crée le user avec `firstName`/`lastName`. Reste inchangé (compte non confirmé, email de confirmation).

**`AcceptInvitationUseCase`** : `AcceptInvitationInput = { token, firstName, lastName, password }` ; l'email vient de `inv.email` (jamais du client) ; crée l'editor avec `firstName`/`lastName` (+ `emailVerifiedAt: now`, inchangé).

**Nouveau `GetInvitationByTokenUseCase`** :
- Constructeur `(invitations: InvitationRepository, orgs: OrganizationRepository, clock: Clock)`.
- `execute({ token }): Promise<{ email: string; organizationName: string; acceptable: boolean }>` :
  - `inv = invitations.findByToken(token)` ; `!inv` → `InvitationNotFoundError`.
  - `org = orgs.findById(inv.organizationId)` ; `organizationName = org?.name ?? 'Okko'`.
  - `acceptable = inv.status === 'pending' && inv.expiresAt.getTime() > now`.
  - retourne `{ email: inv.email, organizationName, acceptable }`. Ne révèle rien de sensible (l'invité possède déjà le token via son email).

## Section 2 — API : endpoint & câblage

**Endpoint** (`AuthController`, `@Public()`) :
- `@Get('invitations/:token')` → `GetInvitationByTokenUseCase` ; retourne `{ email, organizationName, acceptable }` ; `InvitationNotFoundError` → **410** (Gone). Déclaré après `@Get('invitations')` (route liste, admin) — sous-chemins distincts, pas de conflit.
- `POST /auth/invitations/:token/accept` : body `{ firstName, lastName, password }` (au lieu de `{ name, password }`).
- `POST /auth/register` : body `{ email, password, firstName, lastName, organizationName }`.

**Module DI** (`auth.module.ts`) : ajouter la factory `GetInvitationByTokenUseCase` (inject `[INVITATION_REPOSITORY, ORGANIZATION_REPOSITORY, CLOCK]`) et l'injecter dans `AuthController`.

## Section 3 — Admin : formulaires & client

**`/register` (`RegisterForm`)** : le champ « Votre nom » devient **Prénom** (`name="firstName"`) + **Nom** (`name="lastName"`), tous deux requis. `registerAction` lit les deux et les transmet à `apiRegister`.

**`/invite/[token]`** : la page (server component) appelle `apiInvitationByToken(token)` :
- token introuvable (410) OU `acceptable === false` → écran « Cette invitation est invalide ou expirée » (pas de formulaire).
- valide → titre « Rejoindre **<organizationName>** », **email pré-rempli en lecture seule** (`<Input value={email} disabled />`, non soumis), + **Prénom** / **Nom** / **Mot de passe**. `AcceptForm` (client) reçoit `email` (affichage seul) et poste `firstName`/`lastName`/`password` via `acceptInviteAction`.

**`/membres` (`InviteForm`)** : après un envoi réussi (`state.ok`), vider le champ via une `ref` sur le `<form>` + `useEffect(() => { if (state.ok) formRef.current?.reset(); }, [state.ok])`. Input non contrôlé, reset propre.

**Client & actions** (`lib/api.ts`, `lib/auth-actions.ts`) :
- `apiRegister({ organizationName, firstName, lastName, email, password })`.
- `apiAcceptInvite(token, { firstName, lastName, password })`.
- nouveau `apiInvitationByToken(token): Promise<{ email: string; organizationName: string; acceptable: boolean }>` (via `publicFetch`).
- `registerAction` lit `firstName`/`lastName` ; `acceptInviteAction` lit `firstName`/`lastName`/`password`.

## Section 4 — Tests

**API** (Jest, doubles en mémoire + `FakeNotificationSender`, aucun réseau réel) :
- `RegisterUseCase` : user créé avec `firstName`/`lastName` (spec mis à jour).
- `AcceptInvitationUseCase` : editor créé avec `firstName`/`lastName`, email tiré du token (spec mis à jour).
- `GetInvitationByTokenUseCase` (nouveau) : pending non expiré → `acceptable: true` + email + org ; expiré/accepté/révoqué → `acceptable: false` ; introuvable → `InvitationNotFoundError`.
- **e2e** (⚠️ efface la DB — prévenir) : le scénario register→confirm→login + invite→accept passe aux champs `firstName`/`lastName` ; ajout d'un `GET /auth/invitations/:token` (200 email+org+acceptable) et token bidon → 410.

**Admin** (Vitest, mocks) :
- `registerAction` : lit `firstName`/`lastName` (test existant adapté).
- Formulaires + reset input + page invite : validés par `tsc --noEmit` + `pnpm build` (pas de test unitaire par formulaire).

**Validation manuelle finale** : inviter (l'input se vide) → ouvrir le lien (org affichée + email verrouillé + prénom/nom) → accepter → login.

---

## Critères de succès

- [ ] `User` porte `firstName`/`lastName` (migration + backfill) ; plus de colonne `name` ; seed superadmin adapté.
- [ ] Register et acceptation d'invitation utilisent prénom + nom (use-cases, endpoints, formulaires).
- [ ] `GET /auth/invitations/:token` public renvoie `{ email, organizationName, acceptable }` ; 410 si introuvable.
- [ ] Page `/invite/[token]` : org affichée, email pré-rempli verrouillé, lien invalide détecté au chargement.
- [ ] Champ d'invitation vidé après envoi réussi.
- [ ] Suites API + admin vertes ; aucun réseau réel en test.
- [ ] Périmètre respecté : pas d'affichage du nom complet ajouté, pas de renvoi d'invitation.

## Suite

Brique **Carnet** (parcelles/cycles) inchangée dans son planning.
