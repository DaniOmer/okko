# Admin BFF — Auth, sessions & onboarding org (Carnet 1b, Plan B) — Design

**Statut :** validé (brainstorming), prêt pour le plan d'implémentation.

## Objectif

Doter l'app admin (`apps/admin`, Next.js 14 App Router) de l'authentification qui manque depuis que le Plan A a placé la Base (crops/zones/pests/history) derrière le rôle `superadmin`. Sans cela, tous les appels actuels de l'admin renvoient 401. On ajoute : connexion, session par cookie httpOnly, gating de navigation, inscription d'organisation, acceptation d'invitation, et gestion des invitations (« membres »). Le tout en **BFF léger** : le JWT du Plan A vit dans un cookie httpOnly et les appels API se font côté serveur avec `Authorization: Bearer`.

## Contexte & état existant

- `apps/admin` : Next.js 14 (App Router, port 3000). Pages actuelles : `crops`, `zones`, `pests`, `history`, accueil.
- `apps/admin/src/lib/api.ts` : appelle l'API directement (`fetch` vers `NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`) **sans aucun token** → cassé depuis le Plan A.
- Aucune couche BFF / route handler aujourd'hui.
- **Découverte (importante) : mixte client/serveur.** Les **lectures** (`listCrops`, `getCrop`, `listZones`, `listPests`, `getCropVersions`, `getCropVersion`, `getCropDiff`, `getCropPublished`, `getCropHistory` — 9 fonctions) sont appelées depuis des **Server Components** (pages). Mais les **écritures** (25 fonctions : `createCrop`, `updateCrop`, `publishCrop`, `discardDraft`, `archiveCrop`, `unarchiveCrop`, `restoreVersion`, `addVariety`, `updateVariety`, `setRequirements`, `setPhenology`, `setNutrition`, `setYields`, `addWindow`, `updateWindow`, `addPrice`, `updatePrice`, `setZoneSuitability`, `setPestControl`, `createZone`, `updateZone`, `deleteZone`, `createPest`, `updatePest`, `deletePest`) sont appelées **directement depuis le navigateur** par ~21 composants `use client` (éditeurs de fiche, boutons d'action, pages `new/`). Ces appels navigateur n'ont pas le JWT (cookie httpOnly, cross-origin) → 401 après le Plan A. Ils doivent être migrés en **Server Actions**.
- API Plan A (déjà livrée) : `POST /auth/register` (public → org + user `admin` + `{ token, user }`), `POST /auth/login` (public), `GET /auth/me`, `POST /auth/invitations` (`admin`), `GET /auth/invitations` (`admin`), `POST /auth/invitations/:id/revoke` (`admin`), `POST /auth/invitations/:token/accept` (public). JWT payload : `{ sub, email, role, organizationId }`, expiration `JWT_EXPIRES_IN` (défaut 7j). Erreurs mappées : 409 / 401 / 403 / 404 / 410.

## Périmètre

**Inclus :** login, session cookie httpOnly, middleware de gating, `/register` (self-service), `/invite/[token]`, `/membres` (gestion des invitations), écran `/bientot` (editor), déconnexion ; **migration des ~21 éditeurs client (25 mutations) vers des Server Actions** + injection du Bearer côté serveur sur toutes les lectures Base ; tests unitaires ciblés.

**Hors périmètre (dette explicite, briques futures) :** refresh tokens (on s'appuie sur l'expiration 7j + redirect login), verrouillage de l'inscription côté API (`register` reste public), liste des utilisateurs d'une org au-delà des invitations (pas d'endpoint API), page `/suivi` et le domaine « carnet » (parcelles/cycles), tests e2e navigateur (Playwright).

## Décisions produit (validées)

- **Tout le Plan B en une brique** (pas de découpage débloquage-d'abord).
- **Session** : cookie httpOnly contenant le JWT ; le token n'est **jamais** exposé au JS client. **Écritures via Server Actions** (approche la plus solide/idiomatique App Router — les éditeurs client existants sont migrés vers des actions) ; **lectures en Server Components** (fetch serveur + Bearer). Pas de proxy route-handlers générique.
- **Rôles / navigation** : `superadmin` → Base ; `admin` → `/membres` ; `editor` → `/bientot`. Pas de `/suivi` dans cette brique.
- **Inscription** : `/register` **ouverte en self-service** (lien depuis `/login`). L'endpoint API reste public (pas de changement côté API).

---

## Section 1 — Architecture & session (Server Actions)

**Principe :** le JWT vit dans un cookie httpOnly `okko_session` ; le token ne touche **jamais** le JS client. **Le navigateur n'appelle plus jamais l'API directement.** Deux chemins, tous deux côté serveur, avec `Authorization: Bearer <jwt>` :
- **Lectures** → Server Components qui appellent des fonctions serveur (`lib/api.ts`).
- **Écritures** → Server Actions (`lib/actions.ts`, directive `'use server'`) que les composants client invoquent (Next transforme l'appel en RPC serveur). C'est le pattern App Router le plus solide : le token reste côté serveur, chaque opération est explicite et typée.

- **Cookie `okko_session`** : `httpOnly`, `SameSite=Lax`, `Secure` en prod (piloté par `SESSION_COOKIE_SECURE`), `path=/`, `maxAge` = 7j.
- **`lib/session.ts`** : `getSession()` (lit le cookie → décode le payload base64 du JWT en lecture seule, **sans revérifier la signature** — l'API la revérifie à chaque appel) → `{ sub, email, role, organizationId } | null`. Un token **expiré** (`exp` dépassé) ou **malformé** est traité comme absence de session (`null`). Expose aussi `getToken()`, `setSession(token)`, `clearSession()`.
- **`lib/http.ts`** *(server-only)* : `ApiError` (porte le `status`), `authFetch(path, init?)` (lit le token via `getToken()`, ajoute le Bearer ; **401 → `redirect('/login?expired=1')`** ; autre `!ok` → `throw ApiError`), `publicFetch(path, init?)` (sans token, mappe le status en `ApiError` — pour login/register/accept). Marqué `import 'server-only'` pour interdire tout import côté client.
- **Migration des écritures** : les 25 fonctions de mutation aujourd'hui dans `lib/api.ts` et appelées par ~21 composants client sont **déplacées** dans `lib/actions.ts` (`'use server'`, chaque export est une async function utilisant `authFetch`). Les composants client changent seulement leur **import** (`@/lib/actions` pour les fonctions ; `@/lib/api` reste la source des **types**) — les sites d'appel (`updateCrop(id, payload)`, etc.) sont inchangés.
- **Nouveaux appels API auth** (dans `lib/api.ts`, server-only) : `apiLogin`, `apiRegister`, `apiAcceptInvite` (publics, `publicFetch`) ; `apiListInvitations`, `apiCreateInvitation`, `apiRevokeInvitation` (`authFetch`).

**Écarté :** proxy BFF générique rejouant chaque endpoint (`/api/…`) — passthrough peu contrôlé, hop réseau superflu, moins idiomatique que des Server Actions explicites.

## Section 2 — Routing, rôles & gating

- **Routes publiques** (sans session) : `/login`, `/register`, `/invite/[token]`.
- **Routes protégées** : tout le reste.
- **Middleware** (`src/middleware.ts`), confort de navigation basé sur la présence + le rôle du cookie (la **vraie** autorisation reste l'API/guards Plan A) :
  - Pas de cookie sur route protégée → `redirect('/login')`.
  - Cookie présent sur `/login` ou `/register` → `redirect('/')`.
  - Contrôle de rôle par zone : `/crops`,`/zones`,`/pests`,`/history` → `superadmin` ; `/membres` → `admin`. Rôle non autorisé → `redirect('/')` (jamais de 403 brut côté UI).
  - Le middleware décode le rôle depuis le payload du cookie (même logique que `getSession` : token expiré/malformé = non authentifié → `redirect('/login')`).
- **Page racine `/`** (server component) — redirige selon le rôle : `superadmin` → `/crops` ; `admin` → `/membres` ; `editor` → `/bientot`.
- **Layout** : barre de navigation adaptée au rôle (superadmin : Base + history ; admin : Membres ; tous : email + bouton Déconnexion). Les liens dépendent du rôle lu dans la session.

## Section 3 — Pages & flux

- **`/login`** — email + mot de passe → Server Action `login` → cookie posé → `redirect('/')` (route selon rôle). Erreurs : 401 → message « identifiants invalides » ; bandeau « session expirée » si `?expired=1`. Lien vers `/register`.
- **`/register`** — nom d'organisation, nom, email, mot de passe → Server Action `register` → API crée org + `admin` + JWT → cookie posé → `redirect('/membres')`. Erreur 409 (email pris) → message. Lien vers `/login`.
- **`/invite/[token]`** *(public)* — nom + mot de passe → Server Action `acceptInvite(token, …)` → API crée le user `editor` + JWT → cookie posé → `redirect('/bientot')`. Erreurs : 410 → « lien invalide ou expiré » ; 409 → « email déjà utilisé ».
- **`/membres`** *(admin)* — surface « membres » = **gestion des invitations** (seule surface exposée par l'API ; pas d'endpoint « lister les users de l'org ») :
  - Tableau des invitations (`GET /auth/invitations`) : email, statut (pending/accepted/expired/revoked), date d'expiration.
  - Formulaire « Inviter » (email) → `POST /auth/invitations` ; retour `emailSent` → toast « invitation envoyée » / « créée mais email non parti ».
  - Action « Révoquer » sur une invitation pending → `POST /auth/invitations/:id/revoke`.
- **`/bientot`** — écran statique « Votre espace carnet arrive bientôt » pour l'`editor`.
- **Déconnexion** — bouton dans le layout → Server Action `logout` → efface le cookie → `redirect('/login')`.

## Section 4 — Structure des modules, env & détails techniques

- **`lib/jwt.ts`** *(pur, edge-safe)* : `type Role`, `interface SessionUser`, `decodeToken(token) → SessionUser | null` (null si absent/malformé/expiré). Aucune dépendance Next → importable par le middleware (edge) comme par le serveur.
- **`lib/session.ts`** *(server)* : `getToken`/`getSession`/`setSession`/`clearSession` (cookie via `next/headers`). `set`/`clear` ne s'appellent que depuis des Server Actions.
- **`lib/http.ts`** *(server-only)* : `ApiError`, `authFetch` (Bearer + `no-store` ; 401 → `redirect('/login?expired=1')` ; autre `!ok` → `throw ApiError`), `publicFetch`.
- **`lib/api.ts`** *(server-only)* : les 9 **lectures** Base (refactorées via `authFetch`) + les fonctions **auth** (`apiLogin`, `apiRegister`, `apiAcceptInvite`, `apiListInvitations`, `apiCreateInvitation`, `apiRevokeInvitation`) + les **types/DTO** partagés (`ApiError` réexporté depuis `http.ts`, `AuthResult`, `Invitation`, `CropDocument`, etc.). Importé uniquement par des Server Components / Server Actions.
- **`lib/actions.ts`** *(`'use server'`)* : les 25 **mutations** (async, via `authFetch`), importées par les composants client. Seuls des exports de fonctions async (contrainte `'use server'`).
- **`lib/auth-actions.ts`** *(`'use server'`)* : `loginAction`, `registerAction`, `acceptInviteAction`, `logoutAction` (posent/effacent le cookie, redirigent).
- **Env** (`apps/admin`) : `NEXT_PUBLIC_API_URL` (existe déjà, `http://localhost:3001`) ; nouveau `SESSION_COOKIE_SECURE` (false en dev). Le secret JWT reste côté API.
- **Types** : `Role` / `SessionUser` définis dans `lib/jwt.ts`, **alignés manuellement** sur le contrat Plan A (pas d'import cross-app).

## Section 5 — Tests

L'admin n'a pas de suite aujourd'hui. On pose une suite **légère et ciblée** (logique à risque : session, gating, mapping d'erreurs — pas le pixel).

- **Vitest + Testing Library** ajoutés à `apps/admin`.
- **`lib/jwt.ts`** : décodage d'un token valide, expiré → `null`, malformé → `null`, champs manquants → `null`, `organizationId: null` (superadmin).
- **`lib/http.ts` (`authFetch`/`publicFetch`)**, `fetch` mocké : attache le Bearer ; **401 → `redirect('/login?expired=1')`** ; `publicFetch` lève `ApiError` avec le status. Aucun vrai réseau.
- **Server Actions** (`login`/`register`/`acceptInvite`), API mockée : pose la session ; mappe 401/409/410 → messages ; redirige.
- **Middleware** : route protégée sans cookie → `/login` ; mauvais rôle sur une zone → `/` ; route publique avec cookie → `/` ; bon rôle → passe.
- **Migration des écritures** : validée par `tsc --noEmit` + `next build` verts (aucun composant client n'importe plus un module server-only) plutôt que par des tests unitaires par éditeur.
- **Pas d'e2e navigateur** dans cette brique ; validation manuelle du parcours complet (register → inviter → accepter → login, + une édition Base par le superadmin) sur l'API réelle.

---

## Critères de succès

- [ ] L'app admin refonctionne : le `superadmin` se connecte et **édite** la Base (lectures serveur + écritures via Server Actions, plus de 401).
- [ ] Les 25 écritures migrées en Server Actions ; aucun composant client n'importe un module server-only ; `next build` vert.
- [ ] Cookie httpOnly ; le token n'est jamais exposé au JS client ; 401 API → redirect login propre.
- [ ] Middleware de gating : routes publiques vs protégées, redirections par rôle, racine route selon le rôle.
- [ ] `/register` self-service crée une org + admin et connecte ; `/invite/[token]` crée un editor et connecte ; erreurs 409/410 affichées clairement.
- [ ] `/membres` (admin) : liste / crée / révoque des invitations, avec retour `emailSent`.
- [ ] `/bientot` pour l'editor ; déconnexion efface le cookie.
- [ ] Suite de tests admin (session, authFetch, server actions, middleware) verte ; aucun vrai réseau en test.
- [ ] Périmètre respecté : pas de refresh token, pas de `/suivi`/carnet, pas de changement côté API.

## Suite

Brique **Carnet** (parcelles/cycles) : domaine org-scopé pour `editor`/`admin`, page `/suivi`, remplaçant l'écran `/bientot`. Aura sa propre spec → plan → implémentation.
