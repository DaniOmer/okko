# Durcissement anti-boucle : endpoint `/logout` + 401 → logout — Design

**Statut :** validé (brainstorming), prêt pour le plan.

## Objectif

Empêcher qu'un cookie `okko_session` invalide **enferme l'utilisateur dans une boucle de redirection** où `/login` est inatteignable. Introduire un endpoint `/logout` qui efface toujours le cookie et rediriger le 401 d'`authFetch` vers lui.

## Contexte & cause

- `apps/admin/src/lib/http.ts` : `authFetch` fait `redirect('/login?expired=1')` sur un **401** de l'API — **sans effacer le cookie** (impossible pendant le rendu d'un Server Component : `cookies().delete` n'est autorisé que dans une Server Action / Route Handler).
- `apps/admin/src/middleware.ts` : sur une route publique (`/login`…), un utilisateur « connecté » (cookie décodable) est renvoyé vers `/`. Le middleware ne vérifie pas la signature — il décode juste le payload.
- **Boucle** : cookie invalide (expiré côté API, signature rejetée après rotation de `JWT_SECRET`, user supprimé) → page protégée → `authFetch` 401 → `/login` → middleware voit « connecté » → `/` → page protégée → 401 → … `/login` jamais servi, cookie jamais effacé. Documenté dans la mémoire `okko-admin-stale-cookie-loop`.

## Périmètre

**Inclus :** route handler `/logout` (efface le cookie + redirige `/login?expired=1`) ; middleware laisse toujours passer `/logout` ; `authFetch` 401 → `/logout` ; tests ciblés.

**Hors périmètre :** le bouton de déconnexion du header (utilise déjà `logoutAction`, une Server Action qui efface le cookie — fonctionne, inchangé) ; toute vérification de signature côté middleware (l'API reste l'autorité).

## Design (approche A)

**`apps/admin/src/app/logout/route.ts`** *(nouveau route handler)* :
- `export async function GET(req: Request)` : construit `res = NextResponse.redirect(new URL('/login?expired=1', req.url))`, appelle `res.cookies.delete(SESSION_COOKIE)`, retourne `res`.
- Un route handler peut supprimer un cookie (contrairement au rendu d'un Server Component). `SESSION_COOKIE` importé de `@/lib/session`.

**`apps/admin/src/middleware.ts`** :
- Tout en haut de `middleware(req)`, avant le décodage/gating : `if (req.nextUrl.pathname === '/logout') return NextResponse.next();`.
- Garantit que le route handler `/logout` s'exécute **toujours**, quel que soit l'état du cookie (jamais renvoyé vers `/` ou `/login`).

**`apps/admin/src/lib/http.ts`** :
- `authFetch` : `if (res.status === 401) redirect('/logout');` (au lieu de `/login?expired=1`).

**Flux corrigé** : cookie invalide → page protégée → `authFetch` 401 → `/logout` (toujours servi) → cookie effacé + redirection `/login?expired=1` → `/login` sans cookie → page de connexion servie (bannière « session expirée »). Boucle cassée.

## Tests

- **Middleware** (`middleware.test.ts`) : `/logout` avec un cookie de session présent → **passe** (`next()`, pas de redirection). (Aujourd'hui, sans le cas spécial, il serait traité comme route protégée.)
- **http** (`http.test.ts`) : `authFetch` sur 401 → `redirect('/logout')` (mettre à jour l'assertion existante `/login?expired=1` → `/logout`).
- **Route `/logout`** : importer `GET`, l'appeler avec une `Request` (`new Request('http://localhost:3000/logout')`), vérifier que la réponse redirige vers `/login?expired=1` et pose un `Set-Cookie` qui efface `okko_session` (`maxAge`/`expires` à 0).
- Validation manuelle : avec un cookie invalide (ex. supprimer/altérer la valeur), visiter `/` → on est redirigé proprement vers `/login` (session effacée), plus de boucle.

## Critères de succès

- [ ] `/logout` efface le cookie et redirige vers `/login?expired=1`, toujours atteignable (middleware le laisse passer inconditionnellement).
- [ ] `authFetch` redirige un 401 vers `/logout` (le cookie est effacé, plus de boucle).
- [ ] Le header (`logoutAction`) reste fonctionnel, inchangé.
- [ ] Tests middleware + http + route `/logout` verts ; build OK.
