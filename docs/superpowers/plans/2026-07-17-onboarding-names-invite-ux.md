# Onboarding : prénom/nom + UX d'invitation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Séparer `name` en `firstName`/`lastName` partout (register + acceptation d'invitation), pré-remplir l'email (verrouillé) + afficher l'org sur la page d'invitation, et vider le champ d'invitation après envoi.

**Architecture:** API NestJS/Prisma — renommage atomique `name → firstName/lastName` (migration backfill + type domaine + mappers + use-cases + contrôleur + seed + specs), plus un use-case/endpoint public `GET /auth/invitations/:token`. Admin Next.js — formulaires prénom/nom, page d'invitation qui résout le token (org + email verrouillé + lien invalide), reset du champ d'invitation.

**Tech Stack:** NestJS 10, Prisma 5/Postgres, Jest + supertest ; Next.js 14 App Router, Server Actions, Vitest.

## Global Constraints

- **Type domaine `User`** : `name: string` devient `firstName: string; lastName: string` (les deux requis). Rien n'affiche `name` aujourd'hui.
- **Backfill** des lignes existantes : `firstName` = avant le 1er espace, `lastName` = le reste (`''` si pas d'espace). Seed superadmin → `firstName: 'Super', lastName: 'Admin'`.
- **Contrats d'entrée** : `RegisterInput = { email, password, firstName, lastName, organizationName }` ; `AcceptInvitationInput = { token, firstName, lastName, password }`. L'email de l'invité vient TOUJOURS du token (`inv.email`), jamais du client.
- **Nouvel endpoint** : `GET /auth/invitations/:token` (`@Public()`) → `{ email, organizationName, acceptable }` où `acceptable = status === 'pending' && expiresAt > now` ; `InvitationNotFoundError` → **410**.
- **Tests** : jamais d'appel Brevo réel (stub `FakeNotificationSender`). ⚠️ la suite e2e API **efface la DB** — prévenir avant `pnpm --filter @okko/api test`. Admin : `fetch`/actions mockés, aucun réseau réel.
- **Commits** : terminer par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: API — renommage `name` → `firstName`/`lastName` (migration + domaine + use-cases + contrôleur + seed + specs)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260717120000_split_user_name/migration.sql`
- Modify: `apps/api/src/application/auth/types.ts`
- Modify: `apps/api/src/infrastructure/auth/prisma-user.repository.ts`
- Modify: `apps/api/src/application/auth/register.use-case.ts`
- Modify: `apps/api/src/application/auth/accept-invitation.use-case.ts`
- Modify: `apps/api/src/presentation/auth/auth.controller.ts` (bodies register + accept)
- Modify: `apps/api/prisma/seed.ts`
- Modify (specs — littéraux User) : `apps/api/src/application/auth/in-memory-repositories.spec.ts`, `login.use-case.spec.ts`, `confirm-email.use-case.spec.ts`, `resend-confirmation.use-case.spec.ts`, `register.use-case.spec.ts`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: `User.firstName`/`User.lastName` ; `RegisterInput`/`AcceptInvitationInput` avec `firstName`/`lastName`. Réutilisés par les tâches 2, 3, 4.

- [ ] **Step 1: Schéma Prisma**

Dans `apps/api/prisma/schema.prisma`, `model User`, remplacer la ligne `name String` par :

```prisma
  firstName      String
  lastName       String
```

- [ ] **Step 2: Migration manuelle (backfill)**

> Note : `prisma migrate dev` est interactif (échoue en shell non-interactif) et ne génèrerait pas le backfill. On crée la migration à la main puis on l'applique, comme la migration `email_confirmation`.

Créer `apps/api/prisma/migrations/20260717120000_split_user_name/migration.sql` :

```sql
-- Ajout des colonnes (nullable d'abord pour permettre le backfill)
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Backfill depuis "name" : firstName = avant le 1er espace, lastName = le reste
UPDATE "User" SET
  "firstName" = split_part("name", ' ', 1),
  "lastName"  = CASE WHEN position(' ' in "name") > 0
                     THEN trim(substring("name" from position(' ' in "name") + 1))
                     ELSE '' END;

-- Contraintes NOT NULL + suppression de l'ancienne colonne
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "name";
```

Appliquer + enregistrer la migration + régénérer le client :

Run:
```bash
cd apps/api
npx prisma db execute --file prisma/migrations/20260717120000_split_user_name/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260717120000_split_user_name
npx prisma generate
```
Expected: migration appliquée, marquée « applied », client régénéré. `npx prisma migrate status` → « Database schema is up to date! ».

- [ ] **Step 3: Type domaine User**

`apps/api/src/application/auth/types.ts` — remplacer l'interface `User` par :

```ts
export interface User { id: string; email: string; firstName: string; lastName: string; role: Role; organizationId: string | null; createdAt: Date; emailVerifiedAt: Date | null; }
```

- [ ] **Step 4: Mapper Prisma**

`apps/api/src/infrastructure/auth/prisma-user.repository.ts` — remplacer `toRow` et `toUser` :

```ts
  private toRow(u: User) { return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, organizationId: u.organizationId, createdAt: u.createdAt, emailVerifiedAt: u.emailVerifiedAt }; }
  private toUser(r: { id: string; email: string; firstName: string; lastName: string; role: string; organizationId: string | null; createdAt: Date; emailVerifiedAt: Date | null }): User {
    return { id: r.id, email: r.email, firstName: r.firstName, lastName: r.lastName, role: r.role as Role, organizationId: r.organizationId, createdAt: r.createdAt, emailVerifiedAt: r.emailVerifiedAt };
  }
```

- [ ] **Step 5: RegisterUseCase (input + littéral)**

`apps/api/src/application/auth/register.use-case.ts` :
- `RegisterInput` :
  ```ts
  export interface RegisterInput { email: string; password: string; firstName: string; lastName: string; organizationName: string; }
  ```
- Le littéral `const user: User = {...}` :
  ```ts
    const user: User = { id: this.ids.next(), email, firstName: input.firstName, lastName: input.lastName, role: 'admin', organizationId: org.id, createdAt: now, emailVerifiedAt: null };
  ```

- [ ] **Step 6: AcceptInvitationUseCase (input + littéral)**

`apps/api/src/application/auth/accept-invitation.use-case.ts` :
- `AcceptInvitationInput` :
  ```ts
  export interface AcceptInvitationInput { token: string; firstName: string; lastName: string; password: string; }
  ```
- Le littéral `const user: User = {...}` :
  ```ts
    const user: User = { id: this.ids.next(), email: inv.email, firstName: input.firstName, lastName: input.lastName, role: 'editor', organizationId: inv.organizationId, createdAt: now, emailVerifiedAt: now };
  ```

- [ ] **Step 7: Contrôleur (bodies register + accept)**

`apps/api/src/presentation/auth/auth.controller.ts` :
- Handler `register` — le type du body :
  ```ts
  async register(@Body() body: { email: string; password: string; firstName: string; lastName: string; organizationName: string }) {
    try { const { email } = await this.registerUC.execute(body); return { status: 'confirmation_sent', email }; }
    catch (e) { if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e; }
  }
  ```
- Handler `accept` :
  ```ts
  async accept(@Param('token') token: string, @Body() body: { firstName: string; lastName: string; password: string }) {
    try { return await this.acceptInvitationUC.execute({ token, firstName: body.firstName, lastName: body.lastName, password: body.password }); }
    catch (e) {
      if (e instanceof InvitationNotFoundError || e instanceof InvitationInvalidError) throw new GoneException('invitation invalide ou expirée');
      if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e;
    }
  }
  ```

- [ ] **Step 8: Seed superadmin**

`apps/api/prisma/seed.ts` — dans `prisma.user.create({ data: {...} })`, remplacer `name: 'Super Admin'` par :

```ts
      firstName: 'Super', lastName: 'Admin',
```

- [ ] **Step 9: Corriger tous les littéraux User des specs**

Le changement de type `User` casse la compilation de chaque spec qui construit un `User` ou appelle register/accept avec `name`. `npx tsc --noEmit` les liste. Corriger chacun en remplaçant `name: 'X'` par `firstName: 'X', lastName: 'X'` (valeurs de test) :

- `src/application/auth/in-memory-repositories.spec.ts` (2 littéraux, lignes ~6 et ~12) : `name: 'A'` → `firstName: 'A', lastName: 'A'` ; `name: 'C'` → `firstName: 'C', lastName: 'C'`.
- `src/application/auth/login.use-case.spec.ts` (1) : `name: 'A'` → `firstName: 'A', lastName: 'A'`.
- `src/application/auth/confirm-email.use-case.spec.ts` (1) : `name: 'A'` → `firstName: 'A', lastName: 'A'`.
- `src/application/auth/resend-confirmation.use-case.spec.ts` (2) : `name: 'A'` → `firstName: 'A', lastName: 'A'`.
- `src/application/auth/register.use-case.spec.ts` : les appels `uc.execute({ email, password, name: 'A', organizationName })` → remplacer `name: 'A'` par `firstName: 'A', lastName: 'A'`.
- `src/application/auth/invitations.spec.ts` : l'appel `accept.execute({ token: ..., name: 'E', password: 'pw' })` (test d'acceptation) → remplacer `name: 'E'` par `firstName: 'E', lastName: 'E'`. (Ce fichier n'a pas de littéral `User` mais appelle `AcceptInvitationUseCase.execute` avec l'ancien champ `name`.)

- [ ] **Step 10: Compilation + tests unitaires**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/api && npx jest in-memory-repositories register.use-case login.use-case confirm-email resend-confirmation invitations --silent`
Expected: PASS (specs adaptés).

> Note : l'e2e (`test/auth.e2e-spec.ts`) envoie encore `name` dans ses payloads — il n'est PAS lancé ici (il échouerait au runtime) ; il est mis à jour et exécuté en Task 2. `tsc` reste vert car les payloads supertest ne sont pas typés contre le contrôleur.

- [ ] **Step 11: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/prisma/seed.ts apps/api/src/application/auth apps/api/src/infrastructure/auth/prisma-user.repository.ts apps/api/src/presentation/auth/auth.controller.ts
git commit -m "feat(api): séparer name en firstName/lastName (migration backfill + domaine)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: API — use-case + endpoint `GET /auth/invitations/:token` + e2e

**Files:**
- Create: `apps/api/src/application/auth/get-invitation-by-token.use-case.ts` + `.spec.ts`
- Modify: `apps/api/src/presentation/auth/auth.controller.ts`
- Modify: `apps/api/src/auth.module.ts`
- Modify: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `InvitationRepository` (`findByToken`), `OrganizationRepository` (`findById`), `Clock`, `InvitationNotFoundError`.
- Produces: `GetInvitationByTokenUseCase.execute({ token }): Promise<{ email: string; organizationName: string; acceptable: boolean }>` ; endpoint `GET /auth/invitations/:token`. Réutilisés par la Task 3 (admin).

- [ ] **Step 1: Écrire le use-case**

`apps/api/src/application/auth/get-invitation-by-token.use-case.ts` :

```ts
import { InvitationRepository, OrganizationRepository } from './repositories';
import { Clock } from '../shared/clock';
import { InvitationNotFoundError } from './errors';

export class GetInvitationByTokenUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly orgs: OrganizationRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: { token: string }): Promise<{ email: string; organizationName: string; acceptable: boolean }> {
    const inv = await this.invitations.findByToken(input.token);
    if (!inv) throw new InvitationNotFoundError(input.token);
    const org = await this.orgs.findById(inv.organizationId);
    const now = new Date(this.clock.nowIso());
    const acceptable = inv.status === 'pending' && inv.expiresAt.getTime() > now.getTime();
    return { email: inv.email, organizationName: org?.name ?? 'Okko', acceptable };
  }
}
```

- [ ] **Step 2: Écrire le spec (échoue)**

`apps/api/src/application/auth/get-invitation-by-token.use-case.spec.ts` :

```ts
import { GetInvitationByTokenUseCase } from './get-invitation-by-token.use-case';
import { InMemoryInvitationRepository, InMemoryOrganizationRepository } from './in-memory-repositories';
import { InvitationNotFoundError } from './errors';
import { Invitation } from './types';

const clock = { nowIso: () => '2026-07-17T00:00:00Z' };
const now = new Date(clock.nowIso());

function inv(partial: Partial<Invitation>): Invitation {
  return { id: 'i1', organizationId: 'o1', email: 'x@y.z', role: 'editor', token: 'tok', status: 'pending', expiresAt: new Date(now.getTime() + 3600_000), invitedByUserId: 'u1', createdAt: now, acceptedAt: null, ...partial };
}

async function make(partial: Partial<Invitation>) {
  const invitations = new InMemoryInvitationRepository();
  const orgs = new InMemoryOrganizationRepository();
  await orgs.save({ id: 'o1', name: 'Coop', createdAt: now });
  await invitations.save(inv(partial));
  return new GetInvitationByTokenUseCase(invitations, orgs, clock);
}

describe('GetInvitationByTokenUseCase', () => {
  it('pending non expiré → email + org + acceptable:true', async () => {
    const uc = await make({});
    expect(await uc.execute({ token: 'tok' })).toEqual({ email: 'x@y.z', organizationName: 'Coop', acceptable: true });
  });
  it('expiré → acceptable:false', async () => {
    const uc = await make({ expiresAt: new Date(now.getTime() - 1000) });
    expect((await uc.execute({ token: 'tok' })).acceptable).toBe(false);
  });
  it('déjà accepté → acceptable:false', async () => {
    const uc = await make({ status: 'accepted' });
    expect((await uc.execute({ token: 'tok' })).acceptable).toBe(false);
  });
  it('token introuvable → InvitationNotFoundError', async () => {
    const uc = await make({});
    await expect(uc.execute({ token: 'nope' })).rejects.toBeInstanceOf(InvitationNotFoundError);
  });
});
```

Run: `cd apps/api && npx jest get-invitation-by-token --silent`
Expected: FAIL puis PASS une fois le Step 1 en place.

- [ ] **Step 3: Contrôleur — endpoint public**

`apps/api/src/presentation/auth/auth.controller.ts` :
- Import : `import { GetInvitationByTokenUseCase } from '../../application/auth/get-invitation-by-token.use-case';`
- Constructeur : ajouter `private readonly getInvitationByTokenUC: GetInvitationByTokenUseCase,` (après `acceptInvitationUC`).
- Ajouter le handler (près des autres routes invitations ; `@Public()` bypasse les guards de classe) :
  ```ts
  @Public() @Get('invitations/:token')
  async getInvitation(@Param('token') token: string) {
    try { return await this.getInvitationByTokenUC.execute({ token }); }
    catch (e) { if (e instanceof InvitationNotFoundError) throw new GoneException('invitation invalide ou expirée'); throw e; }
  }
  ```
  (`InvitationNotFoundError` et `GoneException` sont déjà importés dans ce fichier.)

- [ ] **Step 4: Module DI**

`apps/api/src/auth.module.ts` :
- Import : `import { GetInvitationByTokenUseCase } from './application/auth/get-invitation-by-token.use-case';`
- Factory (à côté des autres use-cases invitations) :
  ```ts
    { provide: GetInvitationByTokenUseCase, useFactory: (inv, o, c) => new GetInvitationByTokenUseCase(inv, o, c), inject: [INVITATION_REPOSITORY, ORGANIZATION_REPOSITORY, CLOCK] },
  ```

- [ ] **Step 5: Mettre à jour l'e2e (payloads name→firstName/lastName + nouvel endpoint)**

`apps/api/test/auth.e2e-spec.ts` :
- Register payload : `.send({ email, password: 'pw', name: 'Chef', organizationName: 'Coop' })` → `.send({ email, password: 'pw', firstName: 'Chef', lastName: 'Test', organizationName: 'Coop' })`.
- Accept payload : `.send({ name: 'Agent', password: 'pw2' })` → `.send({ firstName: 'Agent', lastName: 'Test', password: 'pw2' })`.
- L'accept à usage unique (410) : `.send({ name: 'X', password: 'p' })` → `.send({ firstName: 'X', lastName: 'Y', password: 'p' })`.
- Ajouter, juste après l'obtention du `token` d'invitation (variable `token` du POST `/auth/invitations`) et AVANT l'acceptation, une vérification de l'endpoint :
  ```ts
  const info = await request(app.getHttpServer()).get(`/auth/invitations/${token}`).expect(200);
  expect(info.body).toMatchObject({ email: 'agent@coop.bj', organizationName: 'Coop', acceptable: true });
  await request(app.getHttpServer()).get('/auth/invitations/mauvais-token').expect(410);
  ```

- [ ] **Step 6: Compilation + suite complète (⚠️ efface la DB — prévenir)**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

Run: `pnpm --filter @okko/api test` (⚠️ efface la DB)
Expected: PASS — toute la suite verte (rename + nouvel endpoint + non-régression).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/application/auth/get-invitation-by-token.use-case.ts apps/api/src/application/auth/get-invitation-by-token.use-case.spec.ts apps/api/src/presentation/auth/auth.controller.ts apps/api/src/auth.module.ts apps/api/test/auth.e2e-spec.ts
git commit -m "feat(api): GET /auth/invitations/:token (email + org + acceptable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Admin — client API + Server Actions (firstName/lastName + lookup token)

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/auth-actions.ts`
- Modify: `apps/admin/src/lib/auth-actions.test.ts`

**Interfaces:**
- Consumes: `publicFetch`, endpoints API (Tasks 1-2).
- Produces: `apiRegister({…, firstName, lastName})`, `apiAcceptInvite(token, { firstName, lastName, password })`, `apiInvitationByToken(token): Promise<{ email; organizationName; acceptable }>` ; `registerAction`/`acceptInviteAction` lisant `firstName`/`lastName`. Réutilisés par la Task 4.

- [ ] **Step 1: api.ts**

`apps/admin/src/lib/api.ts` :
- `apiRegister` — nouvelle signature d'input :
  ```ts
  export async function apiRegister(input: { organizationName: string; firstName: string; lastName: string; email: string; password: string }): Promise<RegisterResult> {
    const res = await publicFetch('/auth/register', jsonInit('POST', input));
    return res.json();
  }
  ```
- `apiAcceptInvite` :
  ```ts
  export async function apiAcceptInvite(token: string, input: { firstName: string; lastName: string; password: string }): Promise<AuthResult> {
    const res = await publicFetch(`/auth/invitations/${token}/accept`, jsonInit('POST', input));
    return res.json();
  }
  ```
- Ajouter :
  ```ts
  export interface InvitationInfo { email: string; organizationName: string; acceptable: boolean; }
  export async function apiInvitationByToken(token: string): Promise<InvitationInfo> {
    const res = await publicFetch(`/auth/invitations/${token}`, { method: 'GET' });
    return res.json();
  }
  ```

- [ ] **Step 2: auth-actions.ts**

`apps/admin/src/lib/auth-actions.ts` :
- `registerAction` — lire firstName/lastName :
  ```ts
    const input = {
      organizationName: String(form.get('organizationName') ?? ''),
      firstName: String(form.get('firstName') ?? ''),
      lastName: String(form.get('lastName') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    };
  ```
- `acceptInviteAction` — lire firstName/lastName :
  ```ts
    const input = { firstName: String(form.get('firstName') ?? ''), lastName: String(form.get('lastName') ?? ''), password: String(form.get('password') ?? '') };
  ```

- [ ] **Step 3: Adapter le test des actions**

`apps/admin/src/lib/auth-actions.test.ts` — le test `registerAction success` construit un FormData ; y ajouter `firstName`/`lastName` (au lieu de `name`) :

```ts
// dans le test registerAction success, remplacer la construction du FormData par :
const f = new FormData(); f.append('email', 'a@b.c'); f.append('password', 'pw'); f.append('firstName', 'A'); f.append('lastName', 'B'); f.append('organizationName', 'Coop');
const res = await registerAction({}, f);
expect(res).toEqual({ ok: true, email: 'a@b.c' });
```

(si le test utilisait le helper `form({...})`, y passer `firstName`/`lastName` au lieu de `name`.)

Run: `cd apps/admin && pnpm test auth-actions`
Expected: PASS.

- [ ] **Step 4: Compilation**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/auth-actions.ts apps/admin/src/lib/auth-actions.test.ts
git commit -m "feat(admin): client firstName/lastName + apiInvitationByToken

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Admin — formulaires (register prénom/nom, invite pré-rempli, reset invitation)

**Files:**
- Modify: `apps/admin/src/app/register/RegisterForm.tsx`
- Modify: `apps/admin/src/app/invite/[token]/page.tsx`
- Modify: `apps/admin/src/app/invite/[token]/AcceptForm.tsx`
- Modify: `apps/admin/src/app/membres/InviteForm.tsx`

**Interfaces:**
- Consumes: `registerAction`/`acceptInviteAction` (firstName/lastName), `apiInvitationByToken` (Task 3), `inviteAction`.

- [ ] **Step 1: RegisterForm — prénom + nom**

`apps/admin/src/app/register/RegisterForm.tsx` — dans le `<form>` (branche formulaire, PAS le panneau `state.ok`), remplacer le bloc du champ « Votre nom » par deux champs :

```tsx
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label htmlFor="firstName">Prénom</Label><Input id="firstName" name="firstName" required autoComplete="given-name" /></div>
        <div className="space-y-1.5"><Label htmlFor="lastName">Nom</Label><Input id="lastName" name="lastName" required autoComplete="family-name" /></div>
      </div>
```

(le reste du fichier — panneau « email envoyé », champs organisation/email/mot de passe — inchangé.)

- [ ] **Step 2: Page /invite/[token] — résoudre le token**

Remplacer tout `apps/admin/src/app/invite/[token]/page.tsx` par :

```tsx
import { apiInvitationByToken, type InvitationInfo } from '@/lib/api';
import { AcceptForm } from './AcceptForm';

export default async function InvitePage({ params }: { params: { token: string } }) {
  let info: InvitationInfo | null = null;
  try { info = await apiInvitationByToken(params.token); } catch { info = null; }

  if (!info || !info.acceptable) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
        <div className="text-3xl">⚠️</div>
        <h1 className="text-lg font-semibold">Invitation invalide</h1>
        <p className="text-sm text-muted-foreground">Ce lien d'invitation est invalide, expiré ou déjà utilisé.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center text-2xl font-extrabold text-primary">🌱 Okko</div>
      <h1 className="text-center text-lg font-semibold">Rejoindre {info.organizationName}</h1>
      <AcceptForm token={params.token} email={info.email} />
    </main>
  );
}
```

- [ ] **Step 3: AcceptForm — email verrouillé + prénom/nom**

Remplacer tout `apps/admin/src/app/invite/[token]/AcceptForm.tsx` par :

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

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = useFormState<ActionState, FormData>(acceptInviteAction.bind(null, token), {});
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" defaultValue={email} disabled /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label htmlFor="firstName">Prénom</Label><Input id="firstName" name="firstName" required autoComplete="given-name" /></div>
        <div className="space-y-1.5"><Label htmlFor="lastName">Nom</Label><Input id="lastName" name="lastName" required autoComplete="family-name" /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required autoComplete="new-password" /></div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

> Note : l'input email est `disabled` → **non soumis** ; l'email côté serveur vient du token (`inv.email`). `defaultValue` évite l'avertissement React « controlled without onChange ».

- [ ] **Step 4: InviteForm — vider le champ après envoi**

Remplacer tout `apps/admin/src/app/membres/InviteForm.tsx` par :

```tsx
'use client';
import { useEffect, useRef } from 'react';
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
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) formRef.current?.reset(); }, [state.ok]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
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

- [ ] **Step 5: Compilation + build**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/admin && pnpm build`
Expected: build réussi ; aucune erreur server-only.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/register/RegisterForm.tsx apps/admin/src/app/invite apps/admin/src/app/membres/InviteForm.tsx
git commit -m "feat(admin): register prénom/nom + invite pré-rempli (org, email verrouillé) + reset invitation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Vérification finale + documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Suite API (⚠️ efface la DB — prévenir)**

Run: `pnpm --filter @okko/api test`
Expected: PASS.

- [ ] **Step 2: Suite admin + build**

Run: `cd apps/admin && pnpm test`
Expected: PASS.

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 3: Re-seed superadmin**

Run: `cd apps/api && SUPERADMIN_EMAIL=superadmin@okko.dev SUPERADMIN_PASSWORD=okko-dev npx prisma db seed`
Expected: superadmin créé (`firstName`/`lastName` posés).

- [ ] **Step 4: README**

Dans la section « Admin (dev) » du `README.md`, préciser que l'inscription et l'acceptation d'invitation demandent désormais **prénom + nom** (séparés), et que la page d'invitation affiche l'organisation + l'email pré-rempli (verrouillé).

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: onboarding prénom/nom + page d'invitation pré-remplie

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Vérification finale (post-tâches)
- `pnpm --filter @okko/api test` vert (⚠️ efface la DB) ; `cd apps/admin && pnpm test` vert ; `tsc --noEmit` + `pnpm build` OK.
- Smoke manuel : `/register` (prénom + nom) → email envoyé ; `/membres` inviter → **le champ se vide** ; ouvrir `/invite/<token>` → « Rejoindre <Org> » + **email verrouillé** + prénom/nom → accepter → login ; lien invalide → écran d'erreur.

## Critères de succès (rappel spec)
- [ ] `User.firstName`/`lastName` (migration + backfill) ; plus de `name` ; seed adapté.
- [ ] Register + acceptation utilisent prénom + nom.
- [ ] `GET /auth/invitations/:token` → `{ email, organizationName, acceptable }` ; 410 si introuvable.
- [ ] Page d'invitation : org affichée, email verrouillé, lien invalide détecté au chargement.
- [ ] Champ d'invitation vidé après envoi.
- [ ] Suites API + admin vertes ; aucun réseau réel.

## Suite
Brique **Carnet** (parcelles/cycles) inchangée dans son planning.
