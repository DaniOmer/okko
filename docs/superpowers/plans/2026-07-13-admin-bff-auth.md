# Admin BFF — Auth, sessions & onboarding org (Plan B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter l'app admin (`apps/admin`, Next.js 14) de l'authentification manquante depuis le Plan A : connexion, session cookie httpOnly, gating par middleware, inscription d'org, acceptation d'invitation, gestion des invitations — le token restant côté serveur, **les lectures en Server Components et les écritures en Server Actions** (les éditeurs client existants sont migrés vers des actions).

**Architecture:** `lib/jwt.ts` décode le JWT (pur, edge-safe). `lib/session.ts` encapsule le cookie httpOnly. `lib/http.ts` (server-only) fournit `authFetch`/`publicFetch`/`ApiError`. `lib/api.ts` (server-only) = les 9 lectures Base + les appels auth. `lib/actions.ts` (`'use server'`) = les 25 mutations, appelées par les ~21 composants client (import migré). `lib/auth-actions.ts` = login/register/accept/logout. `middleware.ts` gère le gating. Pas de proxy générique. Le vrai contrôle d'accès reste l'API (guards Plan A).

**Tech Stack:** Next.js 14 App Router, React 18.3, Server Actions, `next/headers`, `server-only`, middleware edge, Vitest + Testing Library.

## Global Constraints

- **Contrat JWT (Plan A)** : payload `{ sub: string; email: string; role: Role; organizationId: string | null; iat: number; exp: number }`, `type Role = 'superadmin' | 'admin' | 'editor'`.
- **DTO API auth** :
  - `AuthResult = { token: string; user: { id: string; email: string; name: string; role: Role; organizationId: string | null; createdAt: string } }`
  - `Invitation = { id: string; organizationId: string; email: string; role: 'editor'; token: string; status: 'pending'|'accepted'|'expired'|'revoked'; expiresAt: string; invitedByUserId: string; createdAt: string; acceptedAt: string | null }`
  - `POST /auth/invitations` → `{ invitation: Invitation; emailSent: boolean }`.
- **Endpoints** (base `NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`) : `POST /auth/register`, `POST /auth/login`, `POST /auth/invitations/:token/accept` (publics) ; `GET /auth/invitations`, `POST /auth/invitations`, `POST /auth/invitations/:id/revoke` (Bearer). Erreurs : 401, 409, 410, 403.
- **Cookie** : nom `okko_session`, valeur = JWT brut, `httpOnly`, `SameSite=Lax`, `path=/`, `maxAge=604800`, `secure = process.env.SESSION_COOKIE_SECURE === 'true'`.
- **Rôles / routing** : `superadmin` → `/crops` ; `admin` → `/membres` ; `editor` → `/bientot`. Zones superadmin : `/crops`,`/zones`,`/pests`,`/history`. Zone admin : `/membres`.
- **Séparation client/serveur** : aucun composant client n'importe un module `server-only` (`lib/http.ts`, `lib/api.ts`) à l'exécution. Les composants client importent les **fonctions** depuis `@/lib/actions` (Server Actions) et les **types** depuis `@/lib/api` avec `import type` (effacé à la compilation → pas d'import runtime).
- **Alias** : `@/*` → `./src/*`. **Tests** : aucun vrai réseau ; `next/headers`/`next/navigation` mockés. **Commits** : terminer par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Outillage de test + décodage JWT pur (edge-safe)

**Files:**
- Modify: `apps/admin/package.json`
- Create: `apps/admin/vitest.config.ts`
- Create: `apps/admin/src/lib/jwt.ts`
- Create: `apps/admin/src/lib/jwt.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces : `type Role = 'superadmin' | 'admin' | 'editor'` ; `interface SessionUser { sub: string; email: string; role: Role; organizationId: string | null }` ; `decodeToken(token): SessionUser | null` (null si absent/malformé/expiré). Réutilisés par les tâches 2, 7.

- [ ] **Step 1: Ajouter l'outillage de test + `server-only`**

Dans `apps/admin/package.json`, ajouter à `scripts` : `"test": "vitest run"`. Ajouter à `dependencies` : `"server-only": "^0.0.1"`. Ajouter à `devDependencies` : `"vitest": "^2.1.0"`, `"@vitejs/plugin-react": "^4.3.0"`, `"jsdom": "^25.0.0"`, `"@testing-library/react": "^16.0.0"`, `"@testing-library/jest-dom": "^6.4.0"`, `"@testing-library/user-event": "^14.5.0"`.

Run: `cd apps/admin && pnpm install`
Expected: installe sans erreur.

- [ ] **Step 2: Config Vitest**

`apps/admin/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
```

- [ ] **Step 3: Écrire le test du décodeur (échoue)**

`apps/admin/src/lib/jwt.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { decodeToken } from './jwt';

function makeToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}
const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 3600;

describe('decodeToken', () => {
  it('décode un token valide', () => {
    const t = makeToken({ sub: 'u1', email: 'a@b.c', role: 'admin', organizationId: 'o1', iat: 1, exp: future });
    expect(decodeToken(t)).toEqual({ sub: 'u1', email: 'a@b.c', role: 'admin', organizationId: 'o1' });
  });
  it('accepte organizationId null (superadmin)', () => {
    const t = makeToken({ sub: 's1', email: 's@o.dev', role: 'superadmin', organizationId: null, iat: 1, exp: future });
    expect(decodeToken(t)?.role).toBe('superadmin');
    expect(decodeToken(t)?.organizationId).toBeNull();
  });
  it('renvoie null si expiré', () => {
    const t = makeToken({ sub: 'u1', email: 'a@b.c', role: 'admin', organizationId: 'o1', iat: 1, exp: past });
    expect(decodeToken(t)).toBeNull();
  });
  it('renvoie null si malformé', () => {
    expect(decodeToken('pas-un-jwt')).toBeNull();
    expect(decodeToken('')).toBeNull();
  });
  it('renvoie null si des champs manquent', () => {
    expect(decodeToken(makeToken({ sub: 'u1', exp: future }))).toBeNull();
  });
});
```

Run: `cd apps/admin && pnpm test jwt`
Expected: FAIL — module `./jwt` introuvable.

- [ ] **Step 4: Implémenter le décodeur**

`apps/admin/src/lib/jwt.ts` :

```ts
export type Role = 'superadmin' | 'admin' | 'editor';

export interface SessionUser {
  sub: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

const ROLES: Role[] = ['superadmin', 'admin', 'editor'];

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Décode le payload d'un JWT (lecture seule, sans vérif de signature — l'API la revérifie).
 *  Renvoie null si le token est absent, malformé, incomplet ou expiré. */
export function decodeToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const p = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    if (typeof p.exp === 'number' && p.exp * 1000 <= Date.now()) return null;
    if (typeof p.sub !== 'string' || typeof p.email !== 'string') return null;
    if (typeof p.role !== 'string' || !ROLES.includes(p.role as Role)) return null;
    const org = p.organizationId;
    if (org !== null && typeof org !== 'string') return null;
    return { sub: p.sub, email: p.email, role: p.role as Role, organizationId: org };
  } catch {
    return null;
  }
}
```

Run: `cd apps/admin && pnpm test jwt`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/package.json apps/admin/pnpm-lock.yaml apps/admin/vitest.config.ts apps/admin/src/lib/jwt.ts apps/admin/src/lib/jwt.test.ts
git commit -m "feat(admin): outillage Vitest + décodage JWT pur (session)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Helpers de session (cookie httpOnly)

**Files:**
- Create: `apps/admin/src/lib/session.ts`

**Interfaces:**
- Consumes: `decodeToken`, `SessionUser` (Task 1).
- Produces : `SESSION_COOKIE = 'okko_session'` ; `getToken(): string | null` ; `getSession(): SessionUser | null` ; `setSession(token: string): void` ; `clearSession(): void`. Réutilisés par 3, 6, 8, 9, 10.

- [ ] **Step 1: Écrire les helpers**

> Note : `cookies().set/delete` ne fonctionnent que dans une Server Action / Route Handler (pas pendant le rendu d'un Server Component). `setSession`/`clearSession` ne seront appelés que depuis les Server Actions (Task 6). `getToken`/`getSession` sont utilisables partout côté serveur.

`apps/admin/src/lib/session.ts` :

```ts
import { cookies } from 'next/headers';
import { decodeToken, type SessionUser } from './jwt';

export const SESSION_COOKIE = 'okko_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

export function getToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}
export function getSession(): SessionUser | null {
  return decodeToken(getToken());
}
export function setSession(token: string): void {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    path: '/', maxAge: MAX_AGE,
  });
}
export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}
```

- [ ] **Step 2: Compilation**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/session.ts
git commit -m "feat(admin): helpers de session cookie httpOnly

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Couche HTTP serveur — ApiError, authFetch, publicFetch

**Files:**
- Create: `apps/admin/src/lib/http.ts`
- Create: `apps/admin/src/lib/http.test.ts`

**Interfaces:**
- Consumes: `getToken` (Task 2).
- Produces : `class ApiError extends Error { status: number }` ; `authFetch(path: string, init?: RequestInit): Promise<Response>` (Bearer ; 401 → `redirect('/login?expired=1')` ; autre `!ok` → throw `ApiError`) ; `publicFetch(path, init?): Promise<Response>` (sans token ; `!ok` → throw `ApiError`) ; `jsonInit(method, body): RequestInit`. Réutilisés par 4 (actions), 5 (api).

- [ ] **Step 1: Écrire le test (échoue)**

`apps/admin/src/lib/http.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({})); // le paquet server-only lève hors RSC — no-op en test
const redirectMock = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));
const getTokenMock = vi.fn<[], string | null>();
vi.mock('./session', () => ({ getToken: () => getTokenMock() }));

import { authFetch, publicFetch, ApiError } from './http';

describe('http', () => {
  beforeEach(() => { redirectMock.mockClear(); getTokenMock.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('authFetch attache le Bearer', async () => {
    getTokenMock.mockReturnValue('jwt-123');
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await authFetch('/x');
    const [, init] = fetchMock.mock.calls[0];
    expect((init!.headers as Headers).get('authorization')).toBe('Bearer jwt-123');
  });
  it('authFetch redirige vers /login sur 401', async () => {
    getTokenMock.mockReturnValue('jwt');
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(authFetch('/x')).rejects.toThrow('REDIRECT:/login?expired=1');
  });
  it('authFetch lève ApiError sur autre erreur', async () => {
    getTokenMock.mockReturnValue('jwt');
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 409 }));
    await expect(authFetch('/x')).rejects.toMatchObject({ status: 409 });
  });
  it('publicFetch lève ApiError avec le status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(publicFetch('/auth/login')).rejects.toBeInstanceOf(ApiError);
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(publicFetch('/auth/login')).rejects.toMatchObject({ status: 401 });
  });
});
```

Run: `cd apps/admin && pnpm test http`
Expected: FAIL — module `./http` introuvable.

- [ ] **Step 2: Implémenter la couche HTTP**

> Note : `import 'server-only'` fait échouer le build si un composant client importe ce module à l'exécution (garde-fou). En test (Vitest), `server-only` est un simple no-op importable.

`apps/admin/src/lib/http.ts` :

```ts
import 'server-only';
import { redirect } from 'next/navigation';
import { getToken } from './session';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public readonly status: number, message?: string) {
    super(message ?? `API ${status}`);
    this.name = 'ApiError';
  }
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/** Appel API authentifié (token du cookie → Bearer). 401 → redirect login. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: init.cache ?? 'no-store' });
  if (res.status === 401) redirect('/login?expired=1');
  if (!res.ok) throw new ApiError(res.status, `${init.method ?? 'GET'} ${path}`);
  return res;
}

/** Appel API public (login/register/accept) — sans token, mappe le status en ApiError. */
export async function publicFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: new Headers(init.headers), cache: 'no-store' });
  if (!res.ok) throw new ApiError(res.status, `${init.method ?? 'GET'} ${path}`);
  return res;
}
```

- [ ] **Step 3: Lancer les tests + compilation**

Run: `cd apps/admin && pnpm test http`
Expected: PASS (4 tests).

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/http.ts apps/admin/src/lib/http.test.ts
git commit -m "feat(admin): couche HTTP serveur (authFetch/publicFetch/ApiError)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Migrer les 25 écritures Base en Server Actions

**Files:**
- Create: `apps/admin/src/lib/actions.ts`
- Modify: les ~21 composants client qui importent des mutations depuis `../lib/api` (imports → `@/lib/actions` pour les fonctions ; types en `import type` depuis `@/lib/api`)

**Interfaces:**
- Consumes: `authFetch`, `jsonInit` (Task 3) ; types depuis `@/lib/api` (`Zone`, `Variety`, `Pest`, etc. — encore présents dans `api.ts` à ce stade).
- Produces : `lib/actions.ts` (`'use server'`) exportant les 25 mutations avec **signatures identiques** à celles actuellement dans `api.ts` : `createCrop`, `updateCrop`, `publishCrop`, `discardDraft`, `archiveCrop`, `unarchiveCrop`, `restoreVersion`, `addVariety`, `updateVariety`, `setRequirements`, `setPhenology`, `setNutrition`, `setYields`, `addWindow`, `updateWindow`, `addPrice`, `updatePrice`, `setZoneSuitability`, `setPestControl`, `createZone`, `updateZone`, `deleteZone`, `createPest`, `updatePest`, `deletePest`.

- [ ] **Step 1: Créer `lib/actions.ts` en déplaçant les 25 mutations**

Créer `apps/admin/src/lib/actions.ts` débutant par :

```ts
'use server';

import { authFetch, jsonInit } from './http';
import type { CropDocument, Variety, Zone, Pest } from './api';
```

Puis, pour **chacune** des 25 fonctions de mutation listées ci-dessus, la **déplacer** de `apps/admin/src/lib/api.ts` vers `apps/admin/src/lib/actions.ts` en appliquant cette transformation (règle unique) :

1. Déclarer la fonction `export async function …` (certaines sont aujourd'hui `export function … : Promise<…>` sans `async` — les rendre `async`).
2. Remplacer le corps `const res = await fetch(\`${BASE}/…\`, {INIT}); if (!res.ok) throw new Error(...); return res.json();` par `const res = await authFetch('/…', {INIT}); return res.json();` (retirer `${BASE}`, utiliser `authFetch`, supprimer le `if (!res.ok) throw`). Les fonctions `Promise<void>` deviennent `await authFetch('/…', {INIT});` sans `return`.
3. Là où le corps construit `{ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x) }`, on peut le remplacer par `jsonInit(method, x)` (facultatif mais recommandé pour la lisibilité).

**Exemple concret** — transformation de `updateCrop` :

```ts
// AVANT (dans api.ts)
export function updateCrop(id: string, body: { commonNames?: Record<string, string>; scientificName?: string; family?: string; cycleType?: string }): Promise<unknown> {
  const res = await fetch(`${BASE}/crops/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
// APRÈS (dans actions.ts)
export async function updateCrop(id: string, body: { commonNames?: Record<string, string>; scientificName?: string; family?: string; cycleType?: string }): Promise<unknown> {
  const res = await authFetch(`/crops/${id}`, jsonInit('PATCH', body));
  return res.json();
}
```

**Exemple `Promise<void>`** — `deleteZone` :

```ts
// APRÈS (dans actions.ts)
export async function deleteZone(id: string): Promise<void> {
  await authFetch(`/zones/${id}`, { method: 'DELETE' });
}
```

Conserver les signatures d'arguments/retours **à l'identique** (mêmes noms, mêmes types) — les sites d'appel client ne doivent pas changer. Après déplacement, ces 25 fonctions ne doivent **plus** exister dans `api.ts` (elles y seront supprimées ; les lectures et types restent, traités en Task 5).

- [ ] **Step 2: Migrer les imports des composants client**

Dans **chaque** composant client (`'use client'`) qui importe une des 25 mutations depuis `api.ts`, changer l'import : les **fonctions** viennent désormais de `@/lib/actions`, les **types** restent dans `@/lib/api` mais en `import type`. Fichiers concernés (vérifier l'entête `'use client'` avant d'éditer) :

`src/app/crops/new/page.tsx`, `src/app/crops/UnarchiveButton.tsx`,
`src/app/crops/[id]/editors/IdentityEditor.tsx`, `.../RequirementsEditor.tsx`, `.../PhenologyEditor.tsx`, `.../NutritionEditor.tsx`, `.../YieldsEditor.tsx`, `.../WindowEditor.tsx`, `.../PriceEditor.tsx`, `.../VarietyEditor.tsx`, `.../ZoneSuitabilityEditor.tsx`, `.../PestControlEditor.tsx`, `.../PublishButton.tsx`, `.../PublishDialog.tsx`, `.../ArchiveButton.tsx`,
`src/app/crops/[id]/versions/RestoreButton.tsx`,
`src/app/zones/new/page.tsx`, `src/app/zones/ZoneRowActions.tsx`,
`src/app/pests/new/page.tsx`, `src/app/pests/PestRowActions.tsx`.

**Exemple (fonction seule)** — `IdentityEditor.tsx` :

```ts
// AVANT
import { updateCrop } from '../../../../lib/api';
// APRÈS
import { updateCrop } from '@/lib/actions';
```

**Exemple (fonction + type)** — `NutritionEditor.tsx` :

```ts
// AVANT
import { setNutrition } from '../../../../lib/api';
import type { NutrientRequirement } from '../../../../lib/api';
// APRÈS
import { setNutrition } from '@/lib/actions';
import type { NutrientRequirement } from '@/lib/api';
```

Si un fichier importe des **types** avec une syntaxe valeur (ex. `import { CropDiff, FieldChange, SectionDiff } from '.../lib/api'` alors qu'ils ne servent que de types), le convertir en `import type { … } from '@/lib/api'`.

- [ ] **Step 3: Vérifier la migration**

Run: `grep -rln "from '.*lib/api'" apps/admin/src/app | xargs grep -l "use client"` puis inspecter : aucun de ces fichiers client ne doit importer une **fonction** (valeur) depuis `@/lib/api` — uniquement des `import type`.
Expected: seules des lignes `import type … from '@/lib/api'` subsistent côté client ; toutes les mutations viennent de `@/lib/actions`.

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Build (vérifie la frontière client/serveur)**

Run: `cd apps/admin && pnpm build`
Expected: build réussi. (Si le build échoue avec « server-only … Client Component », c'est qu'un composant client importe encore une valeur depuis `api.ts`/`http.ts` — corriger l'import en `@/lib/actions` ou `import type`.)

> Note : `api.ts` n'est pas encore `server-only` (Task 5) ; ce build valide surtout que les composants client passent bien par les actions.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/actions.ts apps/admin/src/lib/api.ts apps/admin/src/app
git commit -m "feat(admin): migrer les écritures Base en Server Actions (lib/actions)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `api.ts` server-only — lectures via authFetch + appels auth

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `authFetch`, `publicFetch`, `jsonInit`, `ApiError` (Task 3).
- Produces : `api.ts` (`import 'server-only'`) = les 9 lectures refactorées + `apiLogin`, `apiRegister`, `apiAcceptInvite`, `apiListInvitations`, `apiCreateInvitation`, `apiRevokeInvitation` + réexport `ApiError` + types `AuthResult`, `Invitation` (et les types existants conservés). Réutilisés par 6, 8, 10 et les pages serveur.

- [ ] **Step 1: Réécrire l'entête d'`api.ts`**

Remplacer la 1re ligne actuelle :

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
```

par :

```ts
import 'server-only';
import { authFetch, publicFetch, jsonInit, ApiError } from './http';
import type { Role } from './jwt';

export { ApiError };
```

(La constante `BASE` locale n'est plus nécessaire dans `api.ts` : elle vit dans `http.ts`.)

- [ ] **Step 2: Refactorer les 9 lectures via `authFetch`**

Pour **chacune** des 9 fonctions de lecture restantes (`listCrops`, `listZones`, `getCrop`, `getCropPublished`, `getCropVersions`, `getCropVersion`, `getCropDiff`, `listPests`, `getCropHistory`), remplacer :

```ts
  const res = await fetch(`${BASE}/…`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
```

par :

```ts
  const res = await authFetch('/…', { cache: 'no-store' });
  return res.json();
```

Vérifier : `grep -n "\${BASE}" apps/admin/src/lib/api.ts` → **vide** ; `grep -n "res.statusText" apps/admin/src/lib/api.ts` → **vide**. (Les 25 mutations ont déjà été retirées en Task 4 ; il ne doit rester que lectures + types.)

- [ ] **Step 3: Ajouter les fonctions API auth en fin d'`api.ts`**

Ajouter à la fin de `apps/admin/src/lib/api.ts` :

```ts
// ————————————————— Auth & invitations —————————————————

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string; role: Role; organizationId: string | null; createdAt: string };
}
export interface Invitation {
  id: string; organizationId: string; email: string; role: 'editor'; token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string; invitedByUserId: string; createdAt: string; acceptedAt: string | null;
}

export async function apiLogin(email: string, password: string): Promise<AuthResult> {
  const res = await publicFetch('/auth/login', jsonInit('POST', { email, password }));
  return res.json();
}
export async function apiRegister(input: { organizationName: string; name: string; email: string; password: string }): Promise<AuthResult> {
  const res = await publicFetch('/auth/register', jsonInit('POST', input));
  return res.json();
}
export async function apiAcceptInvite(token: string, input: { name: string; password: string }): Promise<AuthResult> {
  const res = await publicFetch(`/auth/invitations/${token}/accept`, jsonInit('POST', input));
  return res.json();
}
export async function apiListInvitations(): Promise<Invitation[]> {
  const res = await authFetch('/auth/invitations', { cache: 'no-store' });
  return res.json();
}
export async function apiCreateInvitation(email: string): Promise<{ invitation: Invitation; emailSent: boolean }> {
  const res = await authFetch('/auth/invitations', jsonInit('POST', { email }));
  return res.json();
}
export async function apiRevokeInvitation(id: string): Promise<void> {
  await authFetch(`/auth/invitations/${id}/revoke`, { method: 'POST' });
}
```

- [ ] **Step 4: Test des appels auth (échoue puis passe)**

`apps/admin/src/lib/api.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
vi.mock('./session', () => ({ getToken: () => 'jwt-xyz' }));

import { apiListInvitations, apiLogin, ApiError } from './api';

describe('api auth', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('apiListInvitations attache le Bearer', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));
    await apiListInvitations();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/auth/invitations');
    expect((init!.headers as Headers).get('authorization')).toBe('Bearer jwt-xyz');
  });
  it('apiLogin lève ApiError(401) sur mauvais identifiants', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(apiLogin('a@b.c', 'bad')).rejects.toBeInstanceOf(ApiError);
  });
});
```

Run: `cd apps/admin && pnpm test api`
Expected: PASS (2 tests).

- [ ] **Step 5: Compilation + build**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/admin && pnpm build`
Expected: build réussi (aucun composant client n'importe `api.ts` à l'exécution).

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/api.test.ts
git commit -m "feat(admin): api.ts server-only (lectures via authFetch + appels auth)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Server Actions d'authentification

**Files:**
- Create: `apps/admin/src/lib/auth-actions.ts`
- Create: `apps/admin/src/lib/auth-actions.test.ts`

**Interfaces:**
- Consumes: `apiLogin`/`apiRegister`/`apiAcceptInvite`/`ApiError` (Task 5), `setSession`/`clearSession` (Task 2), `redirect`.
- Produces : `type ActionState = { error?: string }` ; `loginAction(prev, form)` ; `registerAction(prev, form)` ; `acceptInviteAction(token, prev, form)` ; `logoutAction()`. Réutilisés par 8 (logout) et 9 (pages auth).

- [ ] **Step 1: Écrire le test (échoue)**

`apps/admin/src/lib/auth-actions.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));
const setSession = vi.fn();
const clearSession = vi.fn();
vi.mock('./session', () => ({ setSession: (t: string) => setSession(t), clearSession: () => clearSession() }));
const apiLogin = vi.fn();
class ApiError extends Error { constructor(public status: number) { super(String(status)); } }
vi.mock('./api', () => ({ apiLogin: (...a: unknown[]) => apiLogin(...a), apiRegister: vi.fn(), apiAcceptInvite: vi.fn(), ApiError }));

import { loginAction } from './auth-actions';

function form(data: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.append(k, v);
  return f;
}

describe('loginAction', () => {
  beforeEach(() => { redirectMock.mockClear(); setSession.mockClear(); apiLogin.mockReset(); });
  it('succès → pose la session puis redirige vers /', async () => {
    apiLogin.mockResolvedValue({ token: 'jwt', user: {} });
    await expect(loginAction({}, form({ email: 'a@b.c', password: 'pw' }))).rejects.toThrow('REDIRECT:/');
    expect(setSession).toHaveBeenCalledWith('jwt');
  });
  it('401 → renvoie une erreur, pas de redirect', async () => {
    apiLogin.mockRejectedValue(new ApiError(401));
    const res = await loginAction({}, form({ email: 'a@b.c', password: 'bad' }));
    expect(res.error).toMatch(/identifiants/i);
    expect(setSession).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
```

Run: `cd apps/admin && pnpm test auth-actions`
Expected: FAIL — module `./auth-actions` introuvable.

- [ ] **Step 2: Implémenter les actions**

> Note : `redirect()` lève `NEXT_REDIRECT` ; il doit être **hors** du `try/catch`. Toutes les actions redirigent vers `/` ; la racine (Task 8) route selon le rôle.

`apps/admin/src/lib/auth-actions.ts` :

```ts
'use server';

import { redirect } from 'next/navigation';
import { setSession, clearSession } from './session';
import { apiLogin, apiRegister, apiAcceptInvite, ApiError } from './api';

export type ActionState = { error?: string };

function messageFor(e: unknown, map: Record<number, string>): string {
  if (e instanceof ApiError && map[e.status]) return map[e.status];
  return 'Une erreur est survenue. Réessayez.';
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  try {
    const { token } = await apiLogin(email, password);
    setSession(token);
  } catch (e) {
    return { error: messageFor(e, { 401: 'Identifiants invalides.' }) };
  }
  redirect('/');
}

export async function registerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const input = {
    organizationName: String(form.get('organizationName') ?? ''),
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  };
  try {
    const { token } = await apiRegister(input);
    setSession(token);
  } catch (e) {
    return { error: messageFor(e, { 409: 'Cet email est déjà utilisé.' }) };
  }
  redirect('/');
}

export async function acceptInviteAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const input = { name: String(form.get('name') ?? ''), password: String(form.get('password') ?? '') };
  try {
    const { token: jwt } = await apiAcceptInvite(token, input);
    setSession(jwt);
  } catch (e) {
    return { error: messageFor(e, { 410: 'Ce lien d’invitation est invalide ou expiré.', 409: 'Cet email est déjà utilisé.' }) };
  }
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  clearSession();
  redirect('/login');
}
```

- [ ] **Step 3: Tests + compilation**

Run: `cd apps/admin && pnpm test auth-actions`
Expected: PASS (2 tests).

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/auth-actions.ts apps/admin/src/lib/auth-actions.test.ts
git commit -m "feat(admin): server actions login/register/accept/logout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Middleware de gating

**Files:**
- Create: `apps/admin/src/middleware.ts`
- Create: `apps/admin/src/middleware.test.ts`

**Interfaces:**
- Consumes: `decodeToken`, `Role` (Task 1).
- Produces : `middleware(req)` + `config.matcher`.

- [ ] **Step 1: Écrire le test (échoue)**

`apps/admin/src/middleware.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function makeToken(role: string, orgId: string | null): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'u', email: 'a@b.c', role, organizationId: orgId, iat: 1, exp })}.sig`;
}
function req(path: string, token?: string): NextRequest {
  const r = new NextRequest(new URL(`http://localhost:3000${path}`));
  if (token) r.cookies.set('okko_session', token);
  return r;
}
function loc(res: { headers: Headers; status: number }): string | null {
  return res.status >= 300 && res.status < 400 ? new URL(res.headers.get('location')!).pathname : null;
}

describe('middleware', () => {
  it('route protégée sans session → /login', () => { expect(loc(middleware(req('/crops')))).toBe('/login'); });
  it('route publique avec session → /', () => { expect(loc(middleware(req('/login', makeToken('admin', 'o1'))))).toBe('/'); });
  it('mauvais rôle sur zone superadmin → /', () => { expect(loc(middleware(req('/crops', makeToken('admin', 'o1'))))).toBe('/'); });
  it('bon rôle sur sa zone → passe', () => {
    expect(loc(middleware(req('/crops', makeToken('superadmin', null))))).toBeNull();
    expect(loc(middleware(req('/membres', makeToken('admin', 'o1'))))).toBeNull();
  });
  it('editor sur /bientot → passe', () => { expect(loc(middleware(req('/bientot', makeToken('editor', 'o1'))))).toBeNull(); });
  it('invitation publique sans session → passe', () => { expect(loc(middleware(req('/invite/tok123')))).toBeNull(); });
});
```

Run: `cd apps/admin && pnpm test middleware`
Expected: FAIL — module `./middleware` introuvable.

- [ ] **Step 2: Implémenter le middleware**

`apps/admin/src/middleware.ts` :

```ts
import { NextRequest, NextResponse } from 'next/server';
import { decodeToken, type Role } from '@/lib/jwt';

const SUPERADMIN_ZONES = ['/crops', '/zones', '/pests', '/history'];
const ADMIN_ZONES = ['/membres'];

function isPublic(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register' || pathname.startsWith('/invite/');
}
function inZone(pathname: string, zones: string[]): boolean {
  return zones.some((z) => pathname === z || pathname.startsWith(z + '/'));
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const session = decodeToken(req.cookies.get('okko_session')?.value);

  if (isPublic(pathname)) {
    return session ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const role: Role = session.role;
  if (inZone(pathname, SUPERADMIN_ZONES) && role !== 'superadmin') return NextResponse.redirect(new URL('/', req.url));
  if (inZone(pathname, ADMIN_ZONES) && role !== 'admin') return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|css|js)$).*)'],
};
```

- [ ] **Step 3: Tests + compilation**

Run: `cd apps/admin && pnpm test middleware`
Expected: PASS (6 tests).

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/middleware.ts apps/admin/src/middleware.test.ts
git commit -m "feat(admin): middleware de gating auth + rôles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Racine routée par rôle + shell conditionnel + nav par rôle + déconnexion

**Files:**
- Modify: `apps/admin/src/app/page.tsx`
- Modify: `apps/admin/src/app/layout.tsx`
- Modify: `apps/admin/src/components/app-shell.tsx`
- Modify: `apps/admin/src/components/sidebar.tsx`
- Modify: `apps/admin/src/components/header.tsx`

**Interfaces:**
- Consumes: `getSession` (Task 2), `SessionUser`/`Role` (Task 1), `logoutAction` (Task 6).
- Produces : `AppShell`/`Sidebar`/`Header` reçoivent `session`.

> Note : l'actuel `page.tsx` (dashboard cultures) est de fait superadmin. La racine **redirige** selon le rôle plutôt que d'afficher le dashboard (le contenu superadmin reste sur `/crops`).

- [ ] **Step 1: Racine — redirection serveur par rôle**

Remplacer **tout** le contenu de `apps/admin/src/app/page.tsx` par :

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default function Home() {
  const session = getSession();
  if (!session) redirect('/login');
  if (session.role === 'superadmin') redirect('/crops');
  if (session.role === 'admin') redirect('/membres');
  redirect('/bientot'); // editor
}
```

- [ ] **Step 2: Layout — fournir la session au shell**

Remplacer `apps/admin/src/app/layout.tsx` par :

```tsx
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { getSession } from '@/lib/session';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AppShell session={session}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: AppShell — chrome conditionnel (client)**

Remplacer `apps/admin/src/components/app-shell.tsx` par :

```tsx
'use client';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import type { SessionUser } from '@/lib/jwt';

function isBare(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register' || pathname.startsWith('/invite/') || pathname === '/bientot';
}

export function AppShell({ session, children }: { session: SessionUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  if (isBare(pathname) || !session) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r bg-card md:flex md:flex-col">
        <Sidebar session={session} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header session={session} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Sidebar — liens par rôle**

Remplacer `apps/admin/src/components/sidebar.tsx` par :

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sprout, Map, Bug, History, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role, SessionUser } from '@/lib/jwt';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = { title: string; items: Item[]; roles: Role[] };

const GROUPS: Group[] = [
  { title: 'Base de connaissances', roles: ['superadmin'], items: [
    { href: '/crops', label: 'Cultures', icon: Sprout },
    { href: '/zones', label: 'Zones', icon: Map },
    { href: '/pests', label: 'Ravageurs', icon: Bug },
  ] },
  { title: 'Suivi', roles: ['superadmin'], items: [
    { href: '/history', label: 'Historique', icon: History },
  ] },
  { title: 'Organisation', roles: ['admin'], items: [
    { href: '/membres', label: 'Membres', icon: Users },
  ] },
];

export function Sidebar({ session }: { session: SessionUser }) {
  const pathname = usePathname();
  const groups = GROUPS.filter((g) => g.roles.includes(session.role));
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 px-2 text-lg font-extrabold text-primary">🌱 Okko</div>
      {groups.map((g) => (
        <div key={g.title} className="mb-2">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
          {g.items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + '/');
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Header — email + déconnexion (recherche superadmin uniquement)**

Remplacer `apps/admin/src/components/header.tsx` par :

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Menu, Search, Sun, Moon, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from '@/components/sidebar';
import { logoutAction } from '@/lib/auth-actions';
import type { SessionUser } from '@/lib/jwt';

export function Header({ session }: { session: SessionUser }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [q, setQ] = useState('');

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar session={session} />
        </SheetContent>
      </Sheet>

      {session.role === 'superadmin' && (
        <form
          onSubmit={(e) => { e.preventDefault(); router.push(`/crops?q=${encodeURIComponent(q)}`); }}
          className="relative flex-1 max-w-md"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une culture…" className="pl-8" />
        </form>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Basculer le thème">
          <Sun className="h-5 w-5 dark:hidden" />
          <Moon className="hidden h-5 w-5 dark:block" />
        </Button>
        <span className="hidden text-sm text-muted-foreground sm:inline">{session.email}</span>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Compilation**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur (le paramètre `session` de `Sidebar`/`Header` est requis ; leurs seuls appelants — `AppShell` et le `Sheet` du `Header` — le fournissent).

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/app/page.tsx apps/admin/src/app/layout.tsx apps/admin/src/components/app-shell.tsx apps/admin/src/components/sidebar.tsx apps/admin/src/components/header.tsx
git commit -m "feat(admin): racine routée par rôle + shell/nav par rôle + déconnexion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Pages publiques — /login, /register, /invite/[token], /bientot

**Files:**
- Create: `apps/admin/src/app/login/page.tsx`, `apps/admin/src/app/login/LoginForm.tsx`
- Create: `apps/admin/src/app/register/page.tsx`, `apps/admin/src/app/register/RegisterForm.tsx`
- Create: `apps/admin/src/app/invite/[token]/page.tsx`, `apps/admin/src/app/invite/[token]/AcceptForm.tsx`
- Create: `apps/admin/src/app/bientot/page.tsx`

**Interfaces:**
- Consumes: `loginAction`/`registerAction`/`acceptInviteAction`/`logoutAction` + `ActionState` (Task 6).

> Note : formulaires client avec `useFormState` (React 18.3 / Next 14 → import depuis `react-dom`) ; `useFormStatus` pour l'état de soumission.

- [ ] **Step 1: /login**

`apps/admin/src/app/login/page.tsx` :

```tsx
import Link from 'next/link';
import { LoginForm } from './LoginForm';

export default function LoginPage({ searchParams }: { searchParams: { expired?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center text-2xl font-extrabold text-primary">🌱 Okko</div>
      {searchParams.expired && (
        <p className="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
          Votre session a expiré. Reconnectez-vous.
        </p>
      )}
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ? <Link href="/register" className="text-primary hover:underline">Créer une organisation</Link>
      </p>
    </main>
  );
}
```

`apps/admin/src/app/login/LoginForm.tsx` :

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction, type ActionState } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Connexion…' : 'Se connecter'}</Button>;
}

export function LoginForm() {
  const [state, action] = useFormState<ActionState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 2: /register**

`apps/admin/src/app/register/page.tsx` :

```tsx
import Link from 'next/link';
import { RegisterForm } from './RegisterForm';

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center text-2xl font-extrabold text-primary">🌱 Okko</div>
      <h1 className="text-center text-lg font-semibold">Créer une organisation</h1>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ? <Link href="/login" className="text-primary hover:underline">Se connecter</Link>
      </p>
    </main>
  );
}
```

`apps/admin/src/app/register/RegisterForm.tsx` :

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { registerAction, type ActionState } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Création…' : 'Créer mon organisation'}</Button>;
}

export function RegisterForm() {
  const [state, action] = useFormState<ActionState, FormData>(registerAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="organizationName">Nom de l’organisation</Label><Input id="organizationName" name="organizationName" required /></div>
      <div className="space-y-1.5"><Label htmlFor="name">Votre nom</Label><Input id="name" name="name" required autoComplete="name" /></div>
      <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required autoComplete="new-password" /></div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: /invite/[token]**

`apps/admin/src/app/invite/[token]/page.tsx` :

```tsx
import { AcceptForm } from './AcceptForm';

export default function InvitePage({ params }: { params: { token: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center text-2xl font-extrabold text-primary">🌱 Okko</div>
      <h1 className="text-center text-lg font-semibold">Rejoindre l’organisation</h1>
      <p className="text-center text-sm text-muted-foreground">Choisissez votre nom et un mot de passe pour finaliser.</p>
      <AcceptForm token={params.token} />
    </main>
  );
}
```

`apps/admin/src/app/invite/[token]/AcceptForm.tsx` :

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { acceptInviteAction, type ActionState } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Validation…' : 'Rejoindre'}</Button>;
}

export function AcceptForm({ token }: { token: string }) {
  const action = acceptInviteAction.bind(null, token);
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="name">Votre nom</Label><Input id="name" name="name" required autoComplete="name" /></div>
      <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required autoComplete="new-password" /></div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 4: /bientot (editor)**

`apps/admin/src/app/bientot/page.tsx` :

```tsx
import { logoutAction } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';

export default function BientotPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-3xl">🌱</div>
      <h1 className="text-xl font-semibold">Votre espace arrive bientôt</h1>
      <p className="text-sm text-muted-foreground">
        Le carnet de suivi (parcelles &amp; cycles) sera disponible prochainement. Merci de votre patience.
      </p>
      <form action={logoutAction}>
        <Button type="submit" variant="outline">Se déconnecter</Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Compilation**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/login apps/admin/src/app/register apps/admin/src/app/invite apps/admin/src/app/bientot
git commit -m "feat(admin): pages login/register/invite/bientot

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Page /membres (admin) — lister / inviter / révoquer

**Files:**
- Create: `apps/admin/src/app/membres/page.tsx`, `apps/admin/src/app/membres/InviteForm.tsx`, `apps/admin/src/app/membres/RevokeButton.tsx`, `apps/admin/src/app/membres/actions.ts`

**Interfaces:**
- Consumes: `apiListInvitations`/`apiCreateInvitation`/`apiRevokeInvitation`/`Invitation`/`ApiError` (Task 5).

> Note : « membres » = gestion des invitations (seule surface exposée par l'API). Mutations via `revalidatePath('/membres')`.

- [ ] **Step 1: Actions de la page**

`apps/admin/src/app/membres/actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { apiCreateInvitation, apiRevokeInvitation, ApiError } from '@/lib/api';

export type InviteState = { error?: string; ok?: boolean; emailSent?: boolean };

export async function inviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const email = String(form.get('email') ?? '').trim();
  if (!email) return { error: 'Email requis.' };
  try {
    const { emailSent } = await apiCreateInvitation(email);
    revalidatePath('/membres');
    return { ok: true, emailSent };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { error: 'Cette personne est déjà membre ou déjà invitée.' };
    return { error: 'Une erreur est survenue. Réessayez.' };
  }
}

export async function revokeAction(id: string): Promise<void> {
  await apiRevokeInvitation(id);
  revalidatePath('/membres');
}
```

- [ ] **Step 2: Formulaire d'invitation**

`apps/admin/src/app/membres/InviteForm.tsx` :

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { inviteAction, type InviteState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Envoi…' : 'Inviter'}</Button>;
}

export function InviteForm() {
  const [state, action] = useFormState<InviteState, FormData>(inviteAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input name="email" type="email" placeholder="email@organisation.bj" required aria-label="Email à inviter" />
        {state.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
        {state.ok && (
          <p className="mt-1 text-sm text-muted-foreground">
            {state.emailSent ? 'Invitation envoyée par email.' : 'Invitation créée (email non envoyé — vérifiez la config Brevo).'}
          </p>
        )}
      </div>
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Bouton révoquer**

`apps/admin/src/app/membres/RevokeButton.tsx` :

```tsx
'use client';
import { useFormStatus } from 'react-dom';
import { revokeAction } from './actions';
import { Button } from '@/components/ui/button';

function Inner() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="ghost" size="sm" disabled={pending}>{pending ? '…' : 'Révoquer'}</Button>;
}

export function RevokeButton({ id }: { id: string }) {
  return (
    <form action={revokeAction.bind(null, id)}>
      <Inner />
    </form>
  );
}
```

- [ ] **Step 4: Page /membres**

`apps/admin/src/app/membres/page.tsx` :

```tsx
import { apiListInvitations, type Invitation } from '@/lib/api';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { InviteForm } from './InviteForm';
import { RevokeButton } from './RevokeButton';

const STATUS_LABELS: Record<Invitation['status'], string> = {
  pending: 'En attente', accepted: 'Acceptée', expired: 'Expirée', revoked: 'Révoquée',
};

export default async function MembresPage() {
  const invitations = await apiListInvitations();
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membres</h1>
        <p className="text-sm text-muted-foreground">Invitez des collaborateurs (éditeurs) et gérez leurs invitations.</p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Inviter un collaborateur</h2>
        <InviteForm />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Expire le</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Aucune invitation.</TableCell></TableRow>
          )}
          {invitations.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell>{inv.email}</TableCell>
              <TableCell><Badge variant={inv.status === 'pending' ? 'default' : 'secondary'}>{STATUS_LABELS[inv.status]}</Badge></TableCell>
              <TableCell>{new Date(inv.expiresAt).toLocaleDateString('fr-FR')}</TableCell>
              <TableCell className="text-right">{inv.status === 'pending' && <RevokeButton id={inv.id} />}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
```

- [ ] **Step 5: Compilation**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur (vérifier que `Badge` accepte les variants `default`/`secondary` ; sinon adapter aux variants réellement exposés par `@/components/ui/badge`).

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/membres
git commit -m "feat(admin): page membres (invitations lister/inviter/révoquer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Vérification finale + documentation env

**Files:**
- Modify: `README.md`
- Create: `apps/admin/.env.example`

- [ ] **Step 1: Suite de tests admin complète**

Run: `cd apps/admin && pnpm test`
Expected: PASS — jwt, http, api, auth-actions, middleware.

- [ ] **Step 2: Compilation + build**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/admin && pnpm build`
Expected: build Next réussi ; les pages `/login`, `/register`, `/invite/[token]`, `/bientot`, `/membres` et le middleware apparaissent ; **aucune erreur « server-only … Client Component »**.

- [ ] **Step 3: `.env.example` admin**

`apps/admin/.env.example` :

```bash
# URL de l'API Okko (NestJS)
NEXT_PUBLIC_API_URL=http://localhost:3001
# Cookie de session en HTTPS uniquement (mettre "true" en production)
SESSION_COOKIE_SECURE=false
```

- [ ] **Step 4: Documenter dans le README**

Ajouter au `README.md` une section « Admin (dev) » : l'admin exige désormais une connexion ; démarrage — (1) seed superadmin API (`cd apps/api && npx prisma db seed`), (2) `cd apps/admin && pnpm dev`, (3) se connecter sur `/login` (superadmin → Base ; admin → membres) ; création d'org via `/register` ; collaborateurs par `/invite/<token>`. Mentionner `NEXT_PUBLIC_API_URL` et `SESSION_COOKIE_SECURE`. Noter que les écritures Base passent par des Server Actions (le navigateur n'appelle jamais l'API directement).

- [ ] **Step 5: Commit**

```bash
git add README.md apps/admin/.env.example
git commit -m "docs(admin): section dev auth + .env.example

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Vérification finale (post-tâches)
- `cd apps/admin && pnpm test` vert (jwt, http, api, auth-actions, middleware).
- `pnpm exec tsc --noEmit` clean ; `pnpm build` réussi, sans erreur server-only.
- Smoke manuel (API + admin lancés, superadmin seedé) : `/login` superadmin → `/crops`, et **éditer** une culture fonctionne (Server Action, plus de 401) ; `/register` crée une org → `/membres` ; inviter un email → invitation `pending` ; ouvrir `/invite/<token>` → créer le compte → `/bientot` ; naviguer vers `/crops` en admin → redirigé ; `POST` Base sans session → `/login` ; déconnexion efface le cookie.

## Critères de succès (rappel spec)
- [ ] App admin authentifiée : superadmin **édite** la Base (lectures serveur + écritures Server Actions, plus de 401).
- [ ] 25 écritures migrées en Server Actions ; aucun composant client n'importe un module server-only ; `next build` vert.
- [ ] Cookie httpOnly ; token jamais exposé au client ; 401 API → redirect login.
- [ ] Middleware : routes publiques/protégées, redirections par rôle, racine routée par rôle.
- [ ] `/register` self-service ; `/invite/[token]` ; erreurs 409/410 affichées.
- [ ] `/membres` : lister / inviter / révoquer, retour `emailSent`.
- [ ] `/bientot` editor ; déconnexion.
- [ ] Suite de tests admin verte ; aucun vrai réseau.
- [ ] Périmètre respecté : pas de refresh token, pas de `/suivi`/carnet, pas de changement côté API.

## Suite
Brique **Carnet** (parcelles/cycles) : domaine org-scopé pour `editor`/`admin`, page `/suivi` remplaçant `/bientot`. Spec → plan → implémentation dédiés.
