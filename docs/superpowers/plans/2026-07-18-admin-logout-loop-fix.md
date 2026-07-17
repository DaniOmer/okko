# Durcissement anti-boucle : `/logout` + 401 → logout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher qu'un cookie `okko_session` invalide enferme l'utilisateur dans une boucle de redirection, en ajoutant un endpoint `/logout` qui efface toujours le cookie et en y redirigeant le 401 d'`authFetch`.

**Architecture:** Route handler `app/logout/route.ts` (GET) qui supprime le cookie et redirige vers `/login?expired=1` ; le middleware laisse toujours passer `/logout` ; `authFetch` redirige un 401 vers `/logout` au lieu de `/login?expired=1`.

**Tech Stack:** Next.js 14 App Router (route handler + middleware edge), Vitest.

## Global Constraints

- Nom du cookie : constante `SESSION_COOKIE = 'okko_session'` exportée de `@/lib/session`.
- `/logout` doit s'exécuter **inconditionnellement** (jamais renvoyé par le middleware, quel que soit l'état du cookie).
- Le bouton de déconnexion du header (`logoutAction`, Server Action) reste **inchangé** (il fonctionne déjà).
- Tests : `useFormState`/mocks existants ; aucun réseau réel. Commits : terminer par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Endpoint `/logout` + pass-through middleware + 401 → `/logout`

**Files:**
- Create: `apps/admin/src/app/logout/route.ts`
- Create: `apps/admin/src/app/logout/route.test.ts`
- Modify: `apps/admin/src/middleware.ts`
- Modify: `apps/admin/src/middleware.test.ts`
- Modify: `apps/admin/src/lib/http.ts`
- Modify: `apps/admin/src/lib/http.test.ts`

**Interfaces:**
- Consumes: `SESSION_COOKIE` de `@/lib/session`.
- Produces: route `GET /logout`.

- [ ] **Step 1: Test middleware — `/logout` passe toujours (échoue)**

Dans `apps/admin/src/middleware.test.ts`, ajouter (après le test `/confirm`) :

```ts
  it('/logout sans session → passe (jamais renvoyé)', () => { expect(loc(middleware(req('/logout')))).toBeNull(); });
  it('/logout avec cookie → passe', () => { expect(loc(middleware(req('/logout', makeToken('admin', 'o1'))))).toBeNull(); });
```

Run: `cd apps/admin && pnpm test middleware`
Expected: FAIL — `/logout` sans session renvoie actuellement `/login` (pas `null`).

- [ ] **Step 2: Middleware — laisser passer `/logout`**

Dans `apps/admin/src/middleware.ts`, tout en haut de `middleware(req)`, juste après `const { pathname } = req.nextUrl;` (avant le décodage de session / le gating), ajouter :

```ts
  if (pathname === '/logout') return NextResponse.next();
```

Run: `cd apps/admin && pnpm test middleware`
Expected: PASS (les nouveaux tests + les anciens).

- [ ] **Step 3: Test http — 401 redirige vers `/logout` (échoue)**

Dans `apps/admin/src/lib/http.test.ts`, modifier le test 401 : remplacer `.rejects.toThrow('REDIRECT:/login?expired=1')` par :

```ts
    await expect(authFetch('/x')).rejects.toThrow('REDIRECT:/logout');
```

Run: `cd apps/admin && pnpm test http`
Expected: FAIL — `authFetch` redirige encore vers `/login?expired=1`.

- [ ] **Step 4: http — 401 → `/logout`**

Dans `apps/admin/src/lib/http.ts`, dans `authFetch`, remplacer :

```ts
  if (res.status === 401) redirect('/login?expired=1');
```

par :

```ts
  if (res.status === 401) redirect('/logout');
```

Run: `cd apps/admin && pnpm test http`
Expected: PASS.

- [ ] **Step 5: Route handler `/logout` + test (échoue puis passe)**

`apps/admin/src/app/logout/route.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /logout', () => {
  it('efface le cookie de session et redirige vers /login?expired=1', async () => {
    const res = await GET(new Request('http://localhost:3000/logout'));
    // redirection
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(new URL(res.headers.get('location')!).pathname + new URL(res.headers.get('location')!).search).toBe('/login?expired=1');
    // cookie effacé (valeur vide)
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('okko_session=;');
  });
});
```

Run: `cd apps/admin && pnpm test logout`
Expected: FAIL — module `./route` introuvable.

`apps/admin/src/app/logout/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/login?expired=1', req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
```

Run: `cd apps/admin && pnpm test logout`
Expected: PASS.

- [ ] **Step 6: Suite complète + compilation + build**

Run: `cd apps/admin && pnpm test`
Expected: PASS (jwt, http, api, auth-actions, middleware, logout).

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi ; la route `/logout` apparaît.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/app/logout apps/admin/src/middleware.ts apps/admin/src/middleware.test.ts apps/admin/src/lib/http.ts apps/admin/src/lib/http.test.ts
git commit -m "fix(admin): endpoint /logout + 401→logout (casse la boucle de cookie invalide)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Vérification finale (post-tâche)
- `cd apps/admin && pnpm test` vert ; `tsc --noEmit` + `pnpm build` OK.
- Smoke manuel : avec un cookie `okko_session` altéré (DevTools), visiter `/` → redirigé proprement vers `/login` (cookie effacé), **plus de boucle** ; le bouton Déconnexion du header fonctionne toujours.

## Critères de succès (rappel spec)
- [ ] `/logout` efface le cookie + redirige `/login?expired=1`, toujours atteignable (middleware inconditionnel).
- [ ] `authFetch` 401 → `/logout`.
- [ ] Header `logoutAction` inchangé et fonctionnel.
- [ ] Tests middleware + http + `/logout` verts ; build OK.
