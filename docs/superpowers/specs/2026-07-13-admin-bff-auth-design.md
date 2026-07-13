# Admin BFF — Auth, sessions & onboarding org (Carnet 1b, Plan B) — Design

**Statut :** validé (brainstorming), prêt pour le plan d'implémentation.

## Objectif

Doter l'app admin (`apps/admin`, Next.js 14 App Router) de l'authentification qui manque depuis que le Plan A a placé la Base (crops/zones/pests/history) derrière le rôle `superadmin`. Sans cela, tous les appels actuels de l'admin renvoient 401. On ajoute : connexion, session par cookie httpOnly, gating de navigation, inscription d'organisation, acceptation d'invitation, et gestion des invitations (« membres »). Le tout en **BFF léger** : le JWT du Plan A vit dans un cookie httpOnly et les appels API se font côté serveur avec `Authorization: Bearer`.

## Contexte & état existant

- `apps/admin` : Next.js 14 (App Router, port 3000). Pages actuelles : `crops`, `zones`, `pests`, `history`, accueil.
- `apps/admin/src/lib/api.ts` : appelle l'API directement (`fetch` vers `NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`) **sans aucun token** → cassé depuis le Plan A.
- Aucune couche BFF / route handler aujourd'hui : les pages sont des Server Components qui fetchent l'API en direct.
- API Plan A (déjà livrée) : `POST /auth/register` (public → org + user `admin` + `{ token, user }`), `POST /auth/login` (public), `GET /auth/me`, `POST /auth/invitations` (`admin`), `GET /auth/invitations` (`admin`), `POST /auth/invitations/:id/revoke` (`admin`), `POST /auth/invitations/:token/accept` (public). JWT payload : `{ sub, email, role, organizationId }`, expiration `JWT_EXPIRES_IN` (défaut 7j). Erreurs mappées : 409 / 401 / 403 / 404 / 410.

## Périmètre

**Inclus :** login, session cookie httpOnly, middleware de gating, `/register` (self-service), `/invite/[token]`, `/membres` (gestion des invitations), écran `/bientot` (editor), déconnexion, injection du Bearer sur tous les appels Base existants, tests unitaires ciblés.

**Hors périmètre (dette explicite, briques futures) :** refresh tokens (on s'appuie sur l'expiration 7j + redirect login), verrouillage de l'inscription côté API (`register` reste public), liste des utilisateurs d'une org au-delà des invitations (pas d'endpoint API), page `/suivi` et le domaine « carnet » (parcelles/cycles), tests e2e navigateur (Playwright).

## Décisions produit (validées)

- **Tout le Plan B en une brique** (pas de découpage débloquage-d'abord).
- **Session** : cookie httpOnly contenant le JWT ; appels API côté serveur avec Bearer (pas de proxy route-handlers, pas de token côté client).
- **Rôles / navigation** : `superadmin` → Base ; `admin` → `/membres` ; `editor` → `/bientot`. Pas de `/suivi` dans cette brique.
- **Inscription** : `/register` **ouverte en self-service** (lien depuis `/login`). L'endpoint API reste public (pas de changement côté API).

---

## Section 1 — Architecture & session (BFF léger)

**Principe :** le JWT vit dans un cookie httpOnly `okko_session` ; le token ne touche jamais le JS client ; toute lecture/écriture API se fait côté serveur avec `Authorization: Bearer <jwt>`.

- **Server Actions** (`src/app/(auth)/actions.ts`) : `login`, `register`, `acceptInvite`, `logout`. Chacune appelle l'API, puis pose/efface le cookie.
- **Cookie `okko_session`** : `httpOnly`, `SameSite=Lax`, `Secure` en prod (piloté par `SESSION_COOKIE_SECURE`), `path=/`, `maxAge` aligné sur 7j.
- **`lib/session.ts`** : `getSession()` (lit le cookie → décode le payload base64 du JWT en lecture seule, **sans revérifier la signature** — l'API la revérifie à chaque appel) → `{ sub, email, role, organizationId } | null`. Un token **expiré** (`exp` dépassé) ou **malformé** est traité comme absence de session (`null`), pour que le gating redirige vers `/login` sans attendre un 401 API. Expose aussi `getToken()`, `setSession(token)`, `clearSession()`.
- **`lib/api.ts` mis à jour** : fonction interne `authFetch(path, init?)` qui lit le token via `cookies()` et ajoute le header `Bearer` + `Content-Type`, `cache: 'no-store'`. Toutes les fonctions Base existantes (`getCrops`, `createZone`, …) passent par elle.
- **Gestion 401** : si `authFetch` reçoit 401 → efface le cookie et `redirect('/login?expired=1')`. Autres erreurs → throw (gérées par les Server Actions / error boundaries).
- **Nouveaux appels API auth** : `apiLogin`, `apiRegister`, `apiAcceptInvite` (publics, sans token) ; `apiListInvitations`, `apiCreateInvitation`, `apiRevokeInvitation` (avec Bearer).

**Écarté :** proxy BFF rejouant chaque endpoint (`/api/crops`…) — duplication inutile puisque les pages sont déjà server-side.

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

## Section 4 — Client API, env & détails techniques

- **`lib/api.ts`** : `authFetch` (Bearer + `no-store` ; 401 → clear cookie + `redirect('/login?expired=1')` ; autres erreurs → throw). Les fonctions Base existantes passent par `authFetch`. Fonctions auth publiques sans token ; invitations avec Bearer.
- **`lib/session.ts`** : décode le payload base64 du JWT (lecture seule, pas de vérif signature) ; `setSession` / `clearSession` encapsulent le cookie.
- **Env** (`apps/admin`) : `NEXT_PUBLIC_API_URL` (existe déjà, `http://localhost:3001`) ; nouveau `SESSION_COOKIE_SECURE` (false en dev). Le secret JWT reste côté API.
- **Types** : type local `Role` / `SessionUser` côté admin, **aligné manuellement** sur le contrat Plan A (pas d'import cross-app ; type documenté).

## Section 5 — Tests

L'admin n'a pas de suite aujourd'hui. On pose une suite **légère et ciblée** (logique à risque : session, gating, mapping d'erreurs — pas le pixel).

- **Vitest + Testing Library** ajoutés à `apps/admin`.
- **`lib/session.ts`** : décodage du payload, cookie absent → `null`, extraction du rôle.
- **`lib/api.ts` (`authFetch`)**, `fetch` mocké : attache le Bearer ; **401 → clear cookie + redirect** ; propage les autres erreurs. Aucun vrai réseau.
- **Server Actions** (`login`/`register`/`acceptInvite`/`logout`), API mockée : pose/efface le cookie ; mappe 401/409/410 → messages ; redirige selon le rôle.
- **Middleware** : route protégée sans cookie → `/login` ; mauvais rôle sur une zone → `/` ; route publique avec cookie → `/`.
- **Pas d'e2e navigateur** dans cette brique ; validation manuelle du parcours complet (register → inviter → accepter → login) sur l'API réelle.

---

## Critères de succès

- [ ] L'app admin refonctionne : le `superadmin` se connecte et édite la Base (Bearer injecté, plus de 401).
- [ ] Cookie httpOnly ; le token n'est jamais exposé au JS client ; 401 API → redirect login propre.
- [ ] Middleware de gating : routes publiques vs protégées, redirections par rôle, racine route selon le rôle.
- [ ] `/register` self-service crée une org + admin et connecte ; `/invite/[token]` crée un editor et connecte ; erreurs 409/410 affichées clairement.
- [ ] `/membres` (admin) : liste / crée / révoque des invitations, avec retour `emailSent`.
- [ ] `/bientot` pour l'editor ; déconnexion efface le cookie.
- [ ] Suite de tests admin (session, authFetch, server actions, middleware) verte ; aucun vrai réseau en test.
- [ ] Périmètre respecté : pas de refresh token, pas de `/suivi`/carnet, pas de changement côté API.

## Suite

Brique **Carnet** (parcelles/cycles) : domaine org-scopé pour `editor`/`admin`, page `/suivi`, remplaçant l'écran `/bientot`. Aura sa propre spec → plan → implémentation.
