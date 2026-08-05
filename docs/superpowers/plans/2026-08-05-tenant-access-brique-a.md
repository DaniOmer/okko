# Module 2 / Brique A « Organisations locataires & accès » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ouvrir Okko à des organisations clientes (entreprises, coopératives, ONG) avec des rôles tenant cloisonnés : elles utilisent la même app, consultent les fiches publiées en lecture seule, gèrent leurs membres, mais ne peuvent pas éditer la Base de connaissances.

**Architecture:** Extension additive de l'auth existant (JWT, `RolesGuard` à match exact, `@Roles()` method-level qui override le class-level). On introduit `Organization.kind` (PLATFORM/CUSTOMER) et 4 rôles tenant, on bascule `register` vers CUSTOMER+ORG_ADMIN, on paramètre l'invitation, et on ouvre les GET de fiches **publiées** aux rôles tenant. Front : navigation déjà gatée par rôle → on ajoute les rôles tenant, une liste de fiches publiées et un sélecteur de rôle à l'invitation.

**Tech Stack:** NestJS + Prisma + Jest (API) ; Next.js App Router + middleware (admin).

## Global Constraints

- **Rôles plateforme** (inchangés) : `superadmin` | `admin` | `editor`.
- **Rôles tenant** (nouveaux) : `ORG_ADMIN` | `AGRONOMIST` | `FIELD_AGENT` | `VIEWER`.
- **`Organization.kind`** : `PLATFORM` | `CUSTOMER`. Défaut colonne = `'CUSTOMER'` ; les orgs existantes → `'PLATFORM'` (data-step migration).
- **Frontière serveur (source de vérité)** : l'édition de la Base (crops/zones/pests write+publish, media) reste `superadmin` ; les tenants n'accèdent qu'aux **GET de fiches publiées**.
- `RolesGuard` = **match exact** (`roles.includes(user.role)`), `@Roles()` **method-level override le class-level** (`getAllAndOverride([handler, class])`).
- Le décodeur JWT admin (`jwt.ts`) **rejette** tout rôle absent de son tableau `ROLES` → il DOIT inclure les rôles tenant, sinon les utilisateurs tenant sont déconnectés.
- Gate de fin de tâche : `cd apps/api && npx tsc --noEmit` + tests Jest concernés verts ; `cd apps/admin && npx tsc --noEmit` vert.

---

### Task 1: API — Rôles (types + `roles.ts`)

**Files:**
- Modify: `apps/api/src/application/auth/types.ts`
- Create: `apps/api/src/application/auth/roles.ts`
- Create test: `apps/api/src/application/auth/roles.spec.ts`

**Interfaces:**
- Produces: `Role` élargi (7 valeurs) ; `OrgKind = 'PLATFORM'|'CUSTOMER'` (type seul — le champ `Organization.kind` arrive en Task 2) ; `Invitation.role: Role` ; `PLATFORM_ROLES`, `TENANT_ROLES`, `rolesFor(kind)`.

- [ ] **Step 1: Écrire le test qui échoue** — `apps/api/src/application/auth/roles.spec.ts` :

```ts
import { rolesFor, PLATFORM_ROLES, TENANT_ROLES } from './roles';

describe('rolesFor', () => {
  it('CUSTOMER → rôles tenant (ORG_ADMIN inclus, editor exclu)', () => {
    expect(rolesFor('CUSTOMER')).toBe(TENANT_ROLES);
    expect(rolesFor('CUSTOMER')).toContain('ORG_ADMIN');
    expect(rolesFor('CUSTOMER')).not.toContain('editor');
  });
  it('PLATFORM → rôles plateforme (editor inclus, ORG_ADMIN exclu)', () => {
    expect(rolesFor('PLATFORM')).toBe(PLATFORM_ROLES);
    expect(rolesFor('PLATFORM')).toContain('editor');
    expect(rolesFor('PLATFORM')).not.toContain('ORG_ADMIN');
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest roles.spec` → FAIL (module `./roles` absent).

- [ ] **Step 3: Élargir `types.ts`** — dans `apps/api/src/application/auth/types.ts` :

Remplacer la ligne `export type Role = ...` par :
```ts
export type Role = 'superadmin' | 'admin' | 'editor' | 'ORG_ADMIN' | 'AGRONOMIST' | 'FIELD_AGENT' | 'VIEWER';
export type OrgKind = 'PLATFORM' | 'CUSTOMER';
```
Dans `interface Invitation`, remplacer `role: 'editor'` par `role: Role`.
(Ne pas encore toucher `interface Organization` — le champ `kind` est ajouté en Task 2, en même temps que son unique call-site `register`, pour que `tsc` reste vert.)

- [ ] **Step 4: Créer `roles.ts`** — `apps/api/src/application/auth/roles.ts` :

```ts
import { Role, OrgKind } from './types';

export const PLATFORM_ROLES: Role[] = ['superadmin', 'admin', 'editor'];
export const TENANT_ROLES: Role[] = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];

export function rolesFor(kind: OrgKind): Role[] {
  return kind === 'PLATFORM' ? PLATFORM_ROLES : TENANT_ROLES;
}
```

- [ ] **Step 5: Vérifier le succès** — Run: `cd apps/api && npx jest roles.spec` → PASS.

- [ ] **Step 6: Type-check + commit** — les élargissements de types sont non cassants (aucun call-site ne construit d'`Organization`, et `'editor'` reste assignable à `Role`). Run: `cd apps/api && npx tsc --noEmit` → OK.
```bash
git add apps/api/src/application/auth/types.ts apps/api/src/application/auth/roles.ts apps/api/src/application/auth/roles.spec.ts
git commit -m "feat(auth): rôles tenant + rolesFor (types + roles.ts)"
```

---

### Task 2: API — `Organization.kind` + `register` → org CUSTOMER + ORG_ADMIN

**Files:**
- Modify: `apps/api/src/application/auth/types.ts` (champ `Organization.kind`)
- Modify: `apps/api/prisma/schema.prisma` (model `Organization`)
- Create: `apps/api/prisma/migrations/20260805100000_org_kind/migration.sql`
- Modify: `apps/api/src/infrastructure/auth/prisma-organization.repository.ts` (vérif mapping `kind`)
- Modify: `apps/api/src/application/auth/register.use-case.ts`
- Modify test: `apps/api/src/application/auth/register.use-case.spec.ts`

**Interfaces:**
- Consumes: `OrgKind`, rôle `ORG_ADMIN` (Task 1).
- Produces: `Organization.kind` (type + colonne persistée). Unique constructeur d'`Organization` = `register` (corrigé ici) → `tsc` reste vert en fin de tâche.

- [ ] **Step 1: Mettre à jour le test** — dans `register.use-case.spec.ts`, remplacer le corps du 1er test par (titre + assertions) :

```ts
  it('crée org CUSTOMER + user ORG_ADMIN NON confirmé, sans token, et envoie une confirmation', async () => {
    const { users, orgs, notifier, uc } = makeRegister();
    const res = await uc.execute({ email: 'A@B.c', password: 'pw', firstName: 'A', lastName: 'A', organizationName: 'Coop' });
    expect(res).toEqual({ email: 'a@b.c' });
    expect((res as Record<string, unknown>).token).toBeUndefined();
    const user = await users.findByEmail('a@b.c');
    expect(user?.role).toBe('ORG_ADMIN');
    expect(user?.emailVerifiedAt).toBeNull();
    const org = await orgs.findById(user!.organizationId!);
    expect(org?.kind).toBe('CUSTOMER');
    expect(notifier.sent).toHaveLength(1);
    const sent = notifier.sent[0];
    expect(sent.kind).toBe('email_confirmation');
    expect(sent.kind === 'email_confirmation' ? sent.confirmUrl : '').toContain('/confirm/');
  });
```
(Le `makeRegister()` renvoie déjà `orgs` — voir le harness existant en tête de fichier.)

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest register.use-case` → FAIL (role `admin`, org sans kind).

- [ ] **Step 3: Type `Organization.kind`** — dans `apps/api/src/application/auth/types.ts`, remplacer l'interface `Organization` par :
```ts
export interface Organization { id: string; name: string; kind: OrgKind; createdAt: Date; }
```

- [ ] **Step 4: Schéma Prisma** — dans `apps/api/prisma/schema.prisma`, model `Organization`, ajouter après la ligne `name String` :
```prisma
  kind        String       @default("CUSTOMER")
```

- [ ] **Step 5: Migration** — `apps/api/prisma/migrations/20260805100000_org_kind/migration.sql` :
```sql
-- AlterTable : nouveau type d'organisation ; les orgs existantes sont celles d'Okko → PLATFORM
ALTER TABLE "Organization" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'CUSTOMER';
UPDATE "Organization" SET "kind" = 'PLATFORM';
```

- [ ] **Step 6: Générer le client Prisma** — Run: `cd apps/api && npx prisma generate` → OK.

- [ ] **Step 7: Repo Organization** — ouvrir `apps/api/src/infrastructure/auth/prisma-organization.repository.ts`. `save` fait `upsert({ create: o, update: o })` : `o` porte désormais `kind` → aucune modif. Vérifier que `findById` renvoie bien `kind` : s'il mappe les champs explicitement, ajouter `kind: row.kind as OrgKind` (et importer `OrgKind`) ; s'il renvoie la row telle quelle, rien à faire.

- [ ] **Step 8: Implémenter `register`** — dans `register.use-case.ts`, remplacer les deux lignes de création org/user par :
```ts
    const org = { id: this.ids.next(), name: input.organizationName, kind: 'CUSTOMER' as const, createdAt: now };
    await this.orgs.save(org);
    const user: User = { id: this.ids.next(), email, firstName: input.firstName, lastName: input.lastName, role: 'ORG_ADMIN', organizationId: org.id, createdAt: now, emailVerifiedAt: null };
```

- [ ] **Step 9: Vérifier** — Run: `cd apps/api && npx jest register.use-case && npx tsc --noEmit` → PASS + OK (`register` étant le seul constructeur d'`Organization`).

- [ ] **Step 10: Commit**
```bash
git add apps/api/src/application/auth/types.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260805100000_org_kind apps/api/src/infrastructure/auth/prisma-organization.repository.ts apps/api/src/application/auth/register.use-case.ts apps/api/src/application/auth/register.use-case.spec.ts
git commit -m "feat(auth): Organization.kind + register crée une org CUSTOMER + créateur ORG_ADMIN"
```

---

### Task 3: API — Invitation : rôle paramétré, validé, appliqué

**Files:**
- Modify: `apps/api/src/application/auth/create-invitation.use-case.ts`
- Modify: `apps/api/src/application/auth/accept-invitation.use-case.ts`
- Modify: `apps/api/src/application/auth/errors.ts` (nouvelle erreur)
- Modify: `apps/api/src/presentation/auth/auth.controller.ts`
- Create test: `apps/api/src/application/auth/create-invitation-role.spec.ts`

**Interfaces:**
- Consumes: `rolesFor(kind)` (Task 1).
- Produces: `CreateInvitationInput.role: Role` ; `InvalidRoleForOrgError`.

- [ ] **Step 1: Écrire le test qui échoue** — `apps/api/src/application/auth/create-invitation-role.spec.ts` :

```ts
import { CreateInvitationUseCase } from './create-invitation.use-case';
import { InvalidRoleForOrgError } from './errors';
import { InMemoryInvitationRepository, InMemoryOrganizationRepository, InMemoryUserRepository } from './in-memory-repositories';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';

const clock = { nowIso: () => '2026-08-05T00:00:00Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function make() {
  const invitations = new InMemoryInvitationRepository();
  const orgs = new InMemoryOrganizationRepository();
  const users = new InMemoryUserRepository();
  const notifier = new FakeNotificationSender();
  return { invitations, orgs, users, uc: new CreateInvitationUseCase(invitations, orgs, users, notifier, clock, ids) };
}

describe('CreateInvitationUseCase — rôle scopé par org.kind', () => {
  beforeEach(() => { n = 0; });

  it('org CUSTOMER : accepte un rôle tenant et le persiste', async () => {
    const { orgs, invitations, uc } = make();
    await orgs.save({ id: 'o1', name: 'Coop', kind: 'CUSTOMER', createdAt: new Date(clock.nowIso()) });
    const { invitation } = await uc.execute({ organizationId: 'o1', email: 'x@y.z', invitedByUserId: 'u1', role: 'AGRONOMIST' });
    expect(invitation.role).toBe('AGRONOMIST');
    expect((await invitations.findById(invitation.id))?.role).toBe('AGRONOMIST');
  });

  it('org CUSTOMER : rejette un rôle plateforme', async () => {
    const { orgs, uc } = make();
    await orgs.save({ id: 'o1', name: 'Coop', kind: 'CUSTOMER', createdAt: new Date(clock.nowIso()) });
    await expect(uc.execute({ organizationId: 'o1', email: 'x@y.z', invitedByUserId: 'u1', role: 'editor' }))
      .rejects.toBeInstanceOf(InvalidRoleForOrgError);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest create-invitation-role` → FAIL (input sans `role`, erreur absente).

- [ ] **Step 3: Erreur** — dans `apps/api/src/application/auth/errors.ts`, ajouter :
```ts
export class InvalidRoleForOrgError extends Error {
  constructor(public readonly role: string) { super(`Role ${role} not allowed for this organization`); this.name = 'InvalidRoleForOrgError'; }
}
```

- [ ] **Step 4: `create-invitation.use-case.ts`** — ajouter `role` à l'input et valider :

Remplacer l'interface d'input :
```ts
export interface CreateInvitationInput { organizationId: string; email: string; invitedByUserId: string; role: Role; }
```
Ajouter les imports en tête : `import { Role } from './types';` et `import { rolesFor } from './roles';` et `import { InvalidRoleForOrgError } from './errors';` (l'`EmailAlreadyUsedError` est déjà importé).

Dans `execute`, juste après `if (existing) throw new EmailAlreadyUsedError(email);` ajouter :
```ts
    const org = await this.orgs.findById(input.organizationId);
    if (!org) throw new InvalidRoleForOrgError(input.role);
    if (!rolesFor(org.kind).includes(input.role)) throw new InvalidRoleForOrgError(input.role);
```
Dans la construction de `invitation`, remplacer `role: 'editor'` par `role: input.role`.
Plus bas, la ligne `const org = await this.orgs.findById(input.organizationId);` déjà présente pour le nom devient **redondante** — supprimer cette 2e lecture et réutiliser le `org` chargé ci-dessus (garder `org?.name ?? 'Okko'`).

- [ ] **Step 5: `accept-invitation.use-case.ts`** — le rôle appliqué doit venir de l'invitation. Remplacer `role: 'editor'` (dans la construction du `user`) par `role: inv.role`.

- [ ] **Step 6: Contrôleur** — dans `apps/api/src/presentation/auth/auth.controller.ts` :

Remplacer les 3 décorateurs `@Roles('admin')` des endpoints invitations par `@Roles('admin', 'ORG_ADMIN')` (invite, list, revoke).

Sur `invite`, ajouter `role` au body et le passer :
```ts
  @Roles('admin', 'ORG_ADMIN') @Post('invitations')
  async invite(@CurrentUser() user: AuthUser, @Body() body: { email: string; role: Role }) {
    if (!user.organizationId) throw new ForbiddenException();
    try { return await this.createInvitationUC.execute({ organizationId: user.organizationId, email: body.email, invitedByUserId: user.sub, role: body.role }); }
    catch (e) {
      if (e instanceof EmailAlreadyUsedError) throw new ConflictException('déjà membre');
      if (e instanceof InvalidRoleForOrgError) throw new BadRequestException('rôle invalide pour cette organisation');
      throw e;
    }
  }
```
Ajouter les imports manquants en tête : `Role` depuis `../../application/auth/types`, `InvalidRoleForOrgError` depuis `../../application/auth/errors`, et `BadRequestException` depuis `@nestjs/common`.

- [ ] **Step 7: Vérifier** — Run:
```bash
cd apps/api && npx jest create-invitation-role register.use-case && npx tsc --noEmit
```
Expected: tests verts, `tsc` OK (les erreurs T1 restantes sont résolues).

- [ ] **Step 8: Commit**
```bash
git add apps/api/src/application/auth apps/api/src/presentation/auth/auth.controller.ts
git commit -m "feat(auth): invitation à rôle paramétré + validé par org.kind + appliqué à l'acceptation"
```

---

### Task 4: API — Fiches publiées lisibles par les tenants

**Files:**
- Modify: `apps/api/src/presentation/crop/crop.controller.ts`
- Create test: `apps/api/src/presentation/crop/crop-tenant-read.spec.ts`

**Interfaces:**
- Consumes: rôles tenant (Task 1), `RolesGuard`.
- Produces: `GET /crops/published` (liste publiée) + `GET /crops/:id/published` ouverts à plateforme + tenant.

**Contexte** : le contrôleur est `@Roles('superadmin')` au niveau **classe** ; un `@Roles(...)` **method-level** override. Le handler liste `@Get()` fait `this.crops.list()` → `composeCropDocument` ; le document porte `hasPublishedVersion`.

- [ ] **Step 1: Écrire le test qui échoue** — `apps/api/src/presentation/crop/crop-tenant-read.spec.ts` (teste la garde par réflexion des métadonnées `@Roles`) :

```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { CropController } from './crop.controller';

const reflector = new Reflector();

describe('CropController — frontière lecture/écriture', () => {
  it('GET /crops/published est ouvert aux rôles tenant', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CropController.prototype.listPublished);
    expect(roles).toContain('ORG_ADMIN');
    expect(roles).toContain('VIEWER');
    expect(roles).toContain('superadmin');
  });
  it('GET /crops/:id/published est ouvert aux rôles tenant', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CropController.prototype.published);
    expect(roles).toContain('AGRONOMIST');
    expect(roles).toContain('superadmin');
  });
  it("l'écriture (create) reste réservée : pas de @Roles method-level (hérite superadmin de la classe)", () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CropController.prototype.create);
    expect(roles).toBeUndefined();
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd apps/api && npx jest crop-tenant-read` → FAIL (`listPublished` inexistant).

- [ ] **Step 3: Endpoint liste publiée** — dans `crop.controller.ts`, **juste après** le handler `@Get() list()` et **avant** `@Get(':id')` (l'ordre compte : `published` doit précéder `:id`), ajouter :
```ts
  @Get('published')
  @Roles('superadmin', 'admin', 'editor', 'ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async listPublished() {
    const snaps = await this.crops.list();
    const docs = await Promise.all(snaps.map((s) => this.composeCropDocument(s.id, s)));
    return docs.filter((d) => d.hasPublishedVersion);
  }
```

- [ ] **Step 4: Ouvrir le détail publié** — sur le handler `@Get(':id/published')` (méthode `published`), ajouter au-dessus :
```ts
  @Roles('superadmin', 'admin', 'editor', 'ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
```

- [ ] **Step 5: Vérifier** — Run: `cd apps/api && npx jest crop-tenant-read && npx tsc --noEmit` → PASS + OK.

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/presentation/crop/crop.controller.ts apps/api/src/presentation/crop/crop-tenant-read.spec.ts
git commit -m "feat(crop): GET fiches publiées (liste + détail) ouverts aux rôles tenant"
```

---

### Task 5: Admin — Type de rôle, décodage JWT, routage

**Files:**
- Modify: `apps/admin/src/lib/jwt.ts`
- Modify: `apps/admin/src/app/page.tsx`
- Modify: `apps/admin/src/middleware.ts`

**Interfaces:**
- Produces: `Role` (7 valeurs) + `TENANT_ROLES` exportés depuis `jwt.ts` ; redirection home tenant → `/fiches` ; middleware gatant `/fiches`, `/membres`, zones plateforme.

- [ ] **Step 1: `jwt.ts`** — élargir le type et le tableau de validation. Remplacer la 1re ligne et la ligne `const ROLES` :
```ts
export type Role = 'superadmin' | 'admin' | 'editor' | 'ORG_ADMIN' | 'AGRONOMIST' | 'FIELD_AGENT' | 'VIEWER';
export const TENANT_ROLES: Role[] = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
```
et
```ts
const ROLES: Role[] = ['superadmin', 'admin', 'editor', 'ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
```

- [ ] **Step 2: Home redirect** — dans `apps/admin/src/app/page.tsx`, remplacer le corps après `if (!session) redirect('/login');` par :
```ts
  if (session.role === 'superadmin') redirect('/crops');
  if (session.role === 'admin') redirect('/membres');
  if (TENANT_ROLES.includes(session.role)) redirect('/fiches');
  redirect('/bientot'); // editor
```
et ajouter en tête `import { TENANT_ROLES } from '@/lib/jwt';`.

- [ ] **Step 3: Middleware** — remplacer le corps de gating de `apps/admin/src/middleware.ts` (les deux `const *_ZONES`, et le bloc de vérification des rôles) par une table zone→rôles :

Remplacer :
```ts
const SUPERADMIN_ZONES = ['/crops', '/zones', '/pests', '/history'];
const ADMIN_ZONES = ['/membres'];
```
par :
```ts
import { TENANT_ROLES } from '@/lib/jwt';
const ZONES: { prefixes: string[]; allow: Role[] }[] = [
  { prefixes: ['/crops', '/zones', '/pests', '/history'], allow: ['superadmin'] },
  { prefixes: ['/fiches'], allow: TENANT_ROLES },
  { prefixes: ['/membres'], allow: ['admin', ...TENANT_ROLES] },
];
```
Et remplacer les deux lignes de vérification (`if (inZone(... SUPERADMIN_ZONES ...))` et `if (inZone(... ADMIN_ZONES ...))`) par :
```ts
  const role: Role = session.role;
  for (const z of ZONES) {
    if (inZone(pathname, z.prefixes) && !z.allow.includes(role)) return NextResponse.redirect(new URL('/', req.url));
  }
```

- [ ] **Step 4: Type-check** — Run: `cd apps/admin && npx tsc --noEmit` → OK.

- [ ] **Step 5: Commit**
```bash
git add "apps/admin/src/lib/jwt.ts" "apps/admin/src/app/page.tsx" "apps/admin/src/middleware.ts"
git commit -m "feat(admin): rôles tenant dans le décodage JWT + routage (home /fiches, middleware par zones)"
```

---

### Task 6: Admin — Navigation tenant + liste & détail des fiches publiées

**Files:**
- Modify: `apps/admin/src/components/sidebar.tsx`
- Modify: `apps/admin/src/lib/api.ts` (ajout `listPublishedCrops`)
- Create: `apps/admin/src/app/fiches/page.tsx`
- Create: `apps/admin/src/app/fiches/[id]/page.tsx`

**Interfaces:**
- Consumes: `TENANT_ROLES` (Task 5), `GET /crops/published` (Task 4), `getCropPublished`, `FicheClientView`, `CropDocument`.

- [ ] **Step 1: API client** — dans `apps/admin/src/lib/api.ts`, juste après `listCrops`, ajouter :
```ts
export async function listPublishedCrops(): Promise<CropDocument[]> {
  const res = await authFetch('/crops/published', { cache: 'no-store' });
  return res.json();
}
```

- [ ] **Step 2: Sidebar** — dans `apps/admin/src/components/sidebar.tsx` :

Ajouter à l'import lucide `FileText` : `import { Sprout, Map, Bug, History, Users, FileText } from 'lucide-react';`
et importer les rôles : `import { TENANT_ROLES } from '@/lib/jwt';`

Ajouter dans `GROUPS` (après le groupe `Organisation`), deux groupes tenant, et **élargir** le groupe Organisation aux rôles tenant :
```ts
  { title: 'Fiches', roles: TENANT_ROLES, items: [
    { href: '/fiches', label: 'Fiches culture', icon: FileText },
  ] },
  { title: 'Suivi', roles: TENANT_ROLES, items: [
    { href: '/bientot', label: 'Suivi (bientôt)', icon: Sprout },
  ] },
```
et remplacer la ligne du groupe Organisation par :
```ts
  { title: 'Organisation', roles: ['admin', ...TENANT_ROLES], items: [
    { href: '/membres', label: 'Membres', icon: Users },
  ] },
```

- [ ] **Step 3: Liste des fiches** — `apps/admin/src/app/fiches/page.tsx` :
```tsx
import Link from 'next/link';
import { listPublishedCrops } from '@/lib/api';

export default async function FichesPage() {
  const crops = await listPublishedCrops().catch(() => []);
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fiches culture</h1>
        <p className="text-sm text-muted-foreground">Consultez les cultures publiées de la base de connaissances.</p>
      </div>
      {crops.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune fiche publiée pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {crops.map((c) => (
            <li key={c.id}>
              <Link href={`/fiches/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-accent">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs italic text-muted-foreground">{c.scientificName}{c.family ? ` · ${c.family}` : ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Détail publié (tenant)** — `apps/admin/src/app/fiches/[id]/page.tsx` (calque de `crops/[id]/published/page.tsx`, sans lien admin) :
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCropPublished, listPests, listZones } from '@/lib/api';
import { FicheClientView } from '../../crops/[id]/FicheClientView';

export default async function TenantFichePage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) notFound();
  const [pests, zones] = await Promise.all([listPests().catch(() => []), listZones().catch(() => [])]);
  const pestNames = Object.fromEntries(pests.map((p) => [p.id, p.name]));
  const zoneNames = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <FicheClientView
        crop={crop}
        pestNames={pestNames}
        zoneNames={zoneNames}
        hideEmpty
        stamp={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf3ea] px-2.5 py-0.5 text-xs font-medium text-[#245c27]">
            🔒 Publié · v{crop.publishedVersion}
          </span>
        }
      />
      <Link href="/fiches" className="mt-6 inline-block text-xs text-muted-foreground hover:underline">← Retour aux fiches</Link>
    </main>
  );
}
```
Note : `listPests`/`listZones` sont `@Roles('superadmin')` côté API — pour un tenant elles renverront 403, mais l'appel est déjà en `.catch(() => [])`, donc la fiche s'affiche avec des noms d'ID à défaut de libellés. Acceptable pour la brique A (les libellés ravageurs/zones dans la fiche sont un raffinement ultérieur).

- [ ] **Step 5: Type-check** — Run: `cd apps/admin && npx tsc --noEmit` → OK.

- [ ] **Step 6: Commit**
```bash
git add "apps/admin/src/components/sidebar.tsx" "apps/admin/src/lib/api.ts" "apps/admin/src/app/fiches"
git commit -m "feat(admin): navigation tenant + liste et détail des fiches publiées (/fiches)"
```

---

### Task 7: Admin — Invitation avec sélecteur de rôle + gating

**Files:**
- Modify: `apps/admin/src/lib/api.ts` (`apiCreateInvitation` + type `Invitation`)
- Modify: `apps/admin/src/app/membres/actions.ts`
- Modify: `apps/admin/src/app/membres/InviteForm.tsx`
- Modify: `apps/admin/src/app/membres/page.tsx`

**Interfaces:**
- Consumes: `apiCreateInvitation(email, role)`, `TENANT_ROLES`, session.
- Produces: formulaire d'invitation avec choix de rôle, gaté à `admin` (plateforme) + `ORG_ADMIN`.

- [ ] **Step 1: API client** — dans `apps/admin/src/lib/api.ts` :

Élargir le type `Invitation.role` : remplacer `role: 'editor';` par `role: string;`.
Remplacer `apiCreateInvitation` par :
```ts
export async function apiCreateInvitation(email: string, role: string): Promise<{ invitation: Invitation; emailSent: boolean }> {
  const res = await authFetch('/auth/invitations', jsonInit('POST', { email, role }));
  return res.json();
}
```

- [ ] **Step 2: Action** — dans `apps/admin/src/app/membres/actions.ts`, lire `role` du formulaire et le passer :
```ts
export async function inviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const email = String(form.get('email') ?? '').trim();
  const role = String(form.get('role') ?? '').trim();
  if (!email) return { error: 'Email requis.' };
  if (!role) return { error: 'Rôle requis.' };
  try {
    const { emailSent } = await apiCreateInvitation(email, role);
    revalidatePath('/membres');
    return { ok: true, emailSent };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { error: 'Cette personne est déjà membre ou déjà invitée.' };
    if (e instanceof ApiError && e.status === 400) return { error: 'Rôle invalide pour cette organisation.' };
    return { error: 'Une erreur est survenue. Réessayez.' };
  }
}
```

- [ ] **Step 3: Formulaire** — `apps/admin/src/app/membres/InviteForm.tsx` reçoit les options de rôle et affiche un `<select>` natif (léger, pas de dépendance) :
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

export function InviteForm({ roleOptions }: { roleOptions: { value: string; label: string }[] }) {
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
      <select name="role" required aria-label="Rôle" defaultValue={roleOptions[0]?.value} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 4: Page membres** — `apps/admin/src/app/membres/page.tsx` : calculer les options de rôle selon la session et ne montrer le formulaire qu'aux inviteurs autorisés. Ajouter en tête :
```ts
import { getSession } from '@/lib/session';
```
Remplacer le début de `MembresPage` (jusqu'au bloc `<div className="rounded-lg border ...">`) par :
```tsx
const ROLE_LABELS: Record<string, string> = {
  editor: 'Éditeur', ORG_ADMIN: 'Admin', AGRONOMIST: 'Agronome', FIELD_AGENT: 'Agent de terrain', VIEWER: 'Observateur',
};
const ROLE_OPTIONS_BY_INVITER: Record<string, string[]> = {
  admin: ['editor'],
  ORG_ADMIN: ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'],
};

export default async function MembresPage() {
  const session = getSession();
  const invitations = await apiListInvitations();
  const canInvite = session ? session.role in ROLE_OPTIONS_BY_INVITER : false;
  const roleOptions = session ? (ROLE_OPTIONS_BY_INVITER[session.role] ?? []).map((v) => ({ value: v, label: ROLE_LABELS[v] })) : [];
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membres</h1>
        <p className="text-sm text-muted-foreground">Invitez des collaborateurs et gérez leurs invitations.</p>
      </div>

      {canInvite && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Inviter un collaborateur</h2>
          <InviteForm roleOptions={roleOptions} />
        </div>
      )}
```
(Le reste de la page — la `<Table>` des invitations — est inchangé ; garder la balise de fermeture `</main>` existante.)

- [ ] **Step 5: Type-check** — Run: `cd apps/admin && npx tsc --noEmit` → OK.

- [ ] **Step 6: Commit**
```bash
git add "apps/admin/src/lib/api.ts" "apps/admin/src/app/membres"
git commit -m "feat(admin): invitation avec sélecteur de rôle (scopé par inviteur) + gating du formulaire"
```

---

## Vérification finale (après toutes les tâches)

- [ ] `cd apps/api && npx tsc --noEmit` → OK
- [ ] `cd apps/api && npx jest roles register.use-case create-invitation-role crop-tenant-read` → tout vert
- [ ] `cd apps/admin && npx tsc --noEmit` → OK
- [ ] **Migration** : `cd apps/api && npx prisma migrate deploy` (quand la DB tourne) → colonne `kind` ajoutée, orgs existantes en `PLATFORM`.
- [ ] Manuel (DB up + API :3001 + admin) :
  1. S'inscrire (register) → confirmer l'email → se connecter : l'utilisateur atterrit sur `/fiches` (rôle `ORG_ADMIN`), voit les fiches publiées en lecture, **pas** les menus Base de connaissances.
  2. Tenter d'accéder à `/crops` en tant que tenant → redirigé vers `/`.
  3. Depuis `/membres`, inviter un membre en rôle « Agronome » → l'invitation porte `AGRONOMIST`.
  4. Un compte plateforme `superadmin` conserve l'accès complet (édition Base).

## Notes hors périmètre (rappel)

- Parcelle (brique B), Journal (C), Recommandations (D), agriculteur self-service, mobile, facturation.
- Libellés ravageurs/zones dans la fiche tenant (les endpoints `listPests`/`listZones` restent plateforme-only ; raffinement ultérieur si besoin d'exposer ces libellés aux tenants).
- Slimming du document renvoyé par `GET /crops/published` (il réutilise le document complet ; acceptable — pas de contenu brouillon, filtré sur `hasPublishedVersion`).
