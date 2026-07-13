# Auth, organisations & rôles — API (Carnet 1a, Plan A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter l'API d'une authentification JWT avec organisations (multi-tenant), rôles (superadmin/admin/editor), invitations par email (Brevo, hexagonal), et garder les endpoints éditoriaux Base derrière `superadmin`.

**Architecture:** Modèles Prisma simples (Organization/User/AuthIdentity/Invitation), schéma d'auth agnostique du provider (User séparé d'AuthIdentity, social-ready). Auth API-owned : use-cases + ports (repos, PasswordHasher, AuthTokenService, NotificationPort) avec adaptateurs (Prisma, bcryptjs, @nestjs/jwt, Brevo). Garde `AuthGuard`+`RolesGuard` honorant `@Public()`. Le carnet (parcelles/cycles) et l'admin BFF sont hors de ce plan (Plan B).

**Tech Stack:** NestJS 10, Prisma 5/Postgres, `@nestjs/jwt`, `bcryptjs`, `fetch` natif (Brevo), Jest + supertest.

## Global Constraints

- **Contrats partagés (types exacts, réutilisés tels quels dans toutes les tâches) :**
  - `type Role = 'superadmin' | 'admin' | 'editor'`
  - `interface User { id: string; email: string; name: string; role: Role; organizationId: string | null; createdAt: Date }`
  - `interface Organization { id: string; name: string; createdAt: Date }`
  - `interface AuthIdentity { id: string; userId: string; provider: string; identifier: string; secret: string; createdAt: Date }`
  - `type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'`
  - `interface Invitation { id: string; organizationId: string; email: string; role: 'editor'; token: string; status: InvitationStatus; expiresAt: Date; invitedByUserId: string; createdAt: Date; acceptedAt: Date | null }`
  - `interface AuthTokenPayload { sub: string; email: string; role: Role; organizationId: string | null }` (l'`email` est dans le JWT → l'audit n'a pas besoin de requête DB)
  - `interface PasswordHasher { hash(plain: string): Promise<string>; verify(plain: string, hash: string): Promise<boolean> }` — token DI `PASSWORD_HASHER`
  - `interface AuthTokenService { sign(payload: AuthTokenPayload): string; verify(token: string): AuthTokenPayload }` — token DI `AUTH_TOKEN_SERVICE`
  - `type Notification = { kind: 'invitation'; to: string; organizationName: string; inviteUrl: string; expiresAt: Date }`
  - `interface NotificationPort { send(n: Notification): Promise<void> }` — token DI `NOTIFICATION_PORT`
  - Repos (tokens DI) : `USER_REPOSITORY`, `ORGANIZATION_REPOSITORY`, `AUTH_IDENTITY_REPOSITORY`, `INVITATION_REPOSITORY`.
- **Env** : `JWT_SECRET`, `JWT_EXPIRES_IN` (défaut `7d`), `BREVO_API_KEY`, `BREVO_SENDER`, `INVITE_BASE_URL` (défaut `http://localhost:3000`), `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`.
- **Sécurité** : cloisonnement inter-org — un `admin`/`editor` n'agit que dans le `organizationId` de son JWT ; jamais un id d'org fourni par le client.
- **Tests** : jamais d'appel Brevo réel (stub `FakeNotificationSender`) ni de vrai réseau. ⚠️ La suite API **efface la DB** — prévenir avant de lancer `pnpm --filter @okko/api test`.
- **Commits** : terminer le message par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Ids via `randomUUID` (crypto) / `UuidIdGenerator` existant (injecté **par classe**, il n'y a pas de token `ID_GENERATOR`). Horloge via le port `Clock` existant (`application/shared/clock`, **`nowIso(): string`** ; obtenir un `Date` avec `new Date(clock.nowIso())`). Provider d'horloge : `{ provide: CLOCK, useClass: SystemClock }` (token `CLOCK`).

---

### Task 1: Dépendances + modèles Prisma + migration

**Files:**
- Modify: `apps/api/package.json` (deps)
- Modify: `apps/api/prisma/schema.prisma`
- Create (généré): `apps/api/prisma/migrations/*/migration.sql`

**Interfaces:**
- Consumes: rien.
- Produces: tables `Organization`, `User`, `AuthIdentity`, `Invitation` + client Prisma typé (modèles `organization`, `user`, `authIdentity`, `invitation`).

- [ ] **Step 1: Ajouter les dépendances**

Dans `apps/api/package.json`, ajouter à `dependencies` : `"@nestjs/jwt": "^10.2.0"`, `"bcryptjs": "^2.4.3"`. À `devDependencies` : `"@types/bcryptjs": "^2.4.6"`, `"ts-node": "^10.9.2"`. Puis :

Run: `cd apps/api && pnpm install`
Expected: installe sans erreur.

- [ ] **Step 2: Ajouter les modèles au schéma Prisma**

Ajouter à la fin de `apps/api/prisma/schema.prisma` :

```prisma
model Organization {
  id          String       @id
  name        String
  createdAt   DateTime     @default(now())
  users       User[]
  invitations Invitation[]
}

model User {
  id             String        @id
  email          String        @unique
  name           String
  role           String
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id])
  identities     AuthIdentity[]
  createdAt      DateTime      @default(now())
}

model AuthIdentity {
  id         String   @id
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  provider   String
  identifier String
  secret     String
  createdAt  DateTime @default(now())

  @@unique([provider, identifier])
}

model Invitation {
  id              String       @id
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  email           String
  role            String
  token           String       @unique
  status          String
  expiresAt       DateTime
  invitedByUserId String
  createdAt       DateTime     @default(now())
  acceptedAt      DateTime?
}
```

- [ ] **Step 3: Générer la migration + le client**

Run: `cd apps/api && npx prisma migrate dev --name auth_organizations_roles`
Expected: crée la migration, l'applique, régénère le client, sans erreur.

- [ ] **Step 4: Vérifier la compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): modèles Prisma auth (Organization/User/AuthIdentity/Invitation) + déps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Contrats de domaine + hachage + JWT

**Files:**
- Create: `apps/api/src/application/auth/types.ts` (Role + entités + AuthTokenPayload)
- Create: `apps/api/src/application/auth/repositories.ts` (ports repos + tokens DI)
- Create: `apps/api/src/application/auth/errors.ts`
- Create: `apps/api/src/application/auth/password-hasher.ts` (port + token DI)
- Create: `apps/api/src/application/auth/auth-token.service.ts` (port + token DI)
- Create: `apps/api/src/infrastructure/auth/bcrypt-password-hasher.ts` + `.spec.ts`
- Create: `apps/api/src/infrastructure/auth/jwt-auth-token.service.ts` + `.spec.ts`

**Interfaces:**
- Consumes: rien (fondation).
- Produces: tous les types/ports des Contrats partagés ; `BcryptPasswordHasher implements PasswordHasher` ; `JwtAuthTokenService implements AuthTokenService` (constructeur `(private readonly jwt: JwtService)`).

- [ ] **Step 1: Écrire les contrats (types, repos, erreurs, ports)**

`apps/api/src/application/auth/types.ts` :

```ts
export type Role = 'superadmin' | 'admin' | 'editor';
export interface User { id: string; email: string; name: string; role: Role; organizationId: string | null; createdAt: Date; }
export interface Organization { id: string; name: string; createdAt: Date; }
export interface AuthIdentity { id: string; userId: string; provider: string; identifier: string; secret: string; createdAt: Date; }
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export interface Invitation {
  id: string; organizationId: string; email: string; role: 'editor'; token: string;
  status: InvitationStatus; expiresAt: Date; invitedByUserId: string; createdAt: Date; acceptedAt: Date | null;
}
export interface AuthTokenPayload { sub: string; email: string; role: Role; organizationId: string | null; }
```

`apps/api/src/application/auth/repositories.ts` :

```ts
import { User, Organization, AuthIdentity, Invitation } from './types';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export interface UserRepository {
  save(u: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listByOrganization(organizationId: string): Promise<User[]>;
}

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');
export interface OrganizationRepository {
  save(o: Organization): Promise<void>;
  findById(id: string): Promise<Organization | null>;
}

export const AUTH_IDENTITY_REPOSITORY = Symbol('AUTH_IDENTITY_REPOSITORY');
export interface AuthIdentityRepository {
  save(i: AuthIdentity): Promise<void>;
  findByProviderIdentifier(provider: string, identifier: string): Promise<AuthIdentity | null>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
export interface InvitationRepository {
  save(inv: Invitation): Promise<void>;
  findById(id: string): Promise<Invitation | null>;
  findByToken(token: string): Promise<Invitation | null>;
  findPendingByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null>;
  listByOrganization(organizationId: string): Promise<Invitation[]>;
}
```

`apps/api/src/application/auth/errors.ts` :

```ts
export class EmailAlreadyUsedError extends Error {}
export class InvalidCredentialsError extends Error {}
export class InvitationNotFoundError extends Error {}
export class InvitationInvalidError extends Error {}  // expirée / consommée / révoquée
export class ForbiddenOrgError extends Error {}       // action inter-organisation
```

`apps/api/src/application/auth/password-hasher.ts` :

```ts
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
```

`apps/api/src/application/auth/auth-token.service.ts` :

```ts
import { AuthTokenPayload } from './types';
export const AUTH_TOKEN_SERVICE = Symbol('AUTH_TOKEN_SERVICE');
export interface AuthTokenService {
  sign(payload: AuthTokenPayload): string;
  verify(token: string): AuthTokenPayload;
}
```

- [ ] **Step 2: Écrire le test du hacher (échoue)**

`apps/api/src/infrastructure/auth/bcrypt-password-hasher.spec.ts` :

```ts
import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();
  it('hache puis vérifie correctement', async () => {
    const h = await hasher.hash('s3cret');
    expect(h).not.toBe('s3cret');
    expect(await hasher.verify('s3cret', h)).toBe(true);
    expect(await hasher.verify('mauvais', h)).toBe(false);
  });
});
```

Run: `cd apps/api && npx jest bcrypt-password-hasher --silent`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le hacher**

`apps/api/src/infrastructure/auth/bcrypt-password-hasher.ts` :

```ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../application/auth/password-hasher';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> { return bcrypt.hash(plain, 10); }
  async verify(plain: string, hash: string): Promise<boolean> { return bcrypt.compare(plain, hash); }
}
```

Run: `cd apps/api && npx jest bcrypt-password-hasher --silent`
Expected: PASS.

- [ ] **Step 4: Écrire le test du service JWT (échoue)**

`apps/api/src/infrastructure/auth/jwt-auth-token.service.spec.ts` :

```ts
import { JwtService } from '@nestjs/jwt';
import { JwtAuthTokenService } from './jwt-auth-token.service';

describe('JwtAuthTokenService', () => {
  const svc = new JwtAuthTokenService(new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }));
  it('signe puis vérifie le payload', () => {
    const token = svc.sign({ sub: 'u1', email: 'a@b.c', role: 'admin', organizationId: 'o1' });
    const payload = svc.verify(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('admin');
    expect(payload.organizationId).toBe('o1');
  });
  it('rejette un token trafiqué', () => {
    expect(() => svc.verify('pas.un.jwt')).toThrow();
  });
});
```

Run: `cd apps/api && npx jest jwt-auth-token --silent`
Expected: FAIL — module introuvable.

- [ ] **Step 5: Implémenter le service JWT**

`apps/api/src/infrastructure/auth/jwt-auth-token.service.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenService } from '../../application/auth/auth-token.service';
import { AuthTokenPayload } from '../../application/auth/types';

@Injectable()
export class JwtAuthTokenService implements AuthTokenService {
  constructor(private readonly jwt: JwtService) {}
  sign(payload: AuthTokenPayload): string { return this.jwt.sign(payload); }
  verify(token: string): AuthTokenPayload {
    const p = this.jwt.verify<AuthTokenPayload & { iat: number; exp: number }>(token);
    return { sub: p.sub, email: p.email, role: p.role, organizationId: p.organizationId };
  }
}
```

Run: `cd apps/api && npx jest jwt-auth-token --silent`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/auth apps/api/src/infrastructure/auth
git commit -m "feat(api): contrats auth + hachage bcrypt + service JWT

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Repositories Prisma + doubles de test en mémoire

**Files:**
- Create: `apps/api/src/infrastructure/auth/prisma-user.repository.ts`
- Create: `apps/api/src/infrastructure/auth/prisma-organization.repository.ts`
- Create: `apps/api/src/infrastructure/auth/prisma-auth-identity.repository.ts`
- Create: `apps/api/src/infrastructure/auth/prisma-invitation.repository.ts`
- Create: `apps/api/src/application/auth/in-memory-repositories.ts` (doubles de test réutilisés par les tâches 4 et 6)
- Create: `apps/api/src/application/auth/in-memory-repositories.spec.ts`

**Interfaces:**
- Consumes: ports de la Task 2, `PrismaService`.
- Produces: adaptateurs Prisma (`@Injectable`, constructeur `(private readonly prisma: PrismaService)`) ; doubles `InMemoryUserRepository`, `InMemoryOrganizationRepository`, `InMemoryAuthIdentityRepository`, `InMemoryInvitationRepository` (classes exportées, constructeur vide).

- [ ] **Step 1: Écrire les doubles en mémoire + leur test (échoue)**

`apps/api/src/application/auth/in-memory-repositories.ts` :

```ts
import { User, Organization, AuthIdentity, Invitation } from './types';
import { UserRepository, OrganizationRepository, AuthIdentityRepository, InvitationRepository } from './repositories';

export class InMemoryUserRepository implements UserRepository {
  private readonly rows: User[] = [];
  async save(u: User): Promise<void> { const i = this.rows.findIndex((r) => r.id === u.id); if (i >= 0) this.rows[i] = u; else this.rows.push(u); }
  async findById(id: string): Promise<User | null> { return this.rows.find((r) => r.id === id) ?? null; }
  async findByEmail(email: string): Promise<User | null> { return this.rows.find((r) => r.email === email) ?? null; }
  async listByOrganization(organizationId: string): Promise<User[]> { return this.rows.filter((r) => r.organizationId === organizationId); }
}
export class InMemoryOrganizationRepository implements OrganizationRepository {
  private readonly rows: Organization[] = [];
  async save(o: Organization): Promise<void> { const i = this.rows.findIndex((r) => r.id === o.id); if (i >= 0) this.rows[i] = o; else this.rows.push(o); }
  async findById(id: string): Promise<Organization | null> { return this.rows.find((r) => r.id === id) ?? null; }
}
export class InMemoryAuthIdentityRepository implements AuthIdentityRepository {
  private readonly rows: AuthIdentity[] = [];
  async save(i: AuthIdentity): Promise<void> { const j = this.rows.findIndex((r) => r.id === i.id); if (j >= 0) this.rows[j] = i; else this.rows.push(i); }
  async findByProviderIdentifier(provider: string, identifier: string): Promise<AuthIdentity | null> {
    return this.rows.find((r) => r.provider === provider && r.identifier === identifier) ?? null;
  }
}
export class InMemoryInvitationRepository implements InvitationRepository {
  private readonly rows: Invitation[] = [];
  async save(inv: Invitation): Promise<void> { const i = this.rows.findIndex((r) => r.id === inv.id); if (i >= 0) this.rows[i] = inv; else this.rows.push(inv); }
  async findById(id: string): Promise<Invitation | null> { return this.rows.find((r) => r.id === id) ?? null; }
  async findByToken(token: string): Promise<Invitation | null> { return this.rows.find((r) => r.token === token) ?? null; }
  async findPendingByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null> {
    return this.rows.find((r) => r.email === email && r.organizationId === organizationId && r.status === 'pending') ?? null;
  }
  async listByOrganization(organizationId: string): Promise<Invitation[]> { return this.rows.filter((r) => r.organizationId === organizationId); }
}
```

`apps/api/src/application/auth/in-memory-repositories.spec.ts` :

```ts
import { InMemoryUserRepository, InMemoryInvitationRepository } from './in-memory-repositories';

describe('in-memory auth repositories', () => {
  it('User: save + findByEmail', async () => {
    const repo = new InMemoryUserRepository();
    await repo.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: new Date() });
    expect((await repo.findByEmail('a@b.c'))?.id).toBe('u1');
  });
  it('Invitation: findByToken + pending filter', async () => {
    const repo = new InMemoryInvitationRepository();
    await repo.save({ id: 'i1', organizationId: 'o1', email: 'x@y.z', role: 'editor', token: 'tok', status: 'pending', expiresAt: new Date(), invitedByUserId: 'u1', createdAt: new Date(), acceptedAt: null });
    expect((await repo.findByToken('tok'))?.id).toBe('i1');
    expect((await repo.findPendingByEmailAndOrg('x@y.z', 'o1'))?.id).toBe('i1');
  });
});
```

Run: `cd apps/api && npx jest in-memory-repositories --silent`
Expected: FAIL — module introuvable.

- [ ] **Step 2: Vérifier que le test passe (les doubles sont créés au Step 1)**

Run: `cd apps/api && npx jest in-memory-repositories --silent`
Expected: PASS.

- [ ] **Step 3: Implémenter les adaptateurs Prisma**

`apps/api/src/infrastructure/auth/prisma-user.repository.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from '../../application/auth/repositories';
import { User, Role } from '../../application/auth/types';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}
  async save(u: User): Promise<void> {
    await this.prisma.user.upsert({ where: { id: u.id }, create: this.toRow(u), update: this.toRow(u) });
  }
  async findById(id: string): Promise<User | null> {
    const r = await this.prisma.user.findUnique({ where: { id } }); return r ? this.toUser(r) : null;
  }
  async findByEmail(email: string): Promise<User | null> {
    const r = await this.prisma.user.findUnique({ where: { email } }); return r ? this.toUser(r) : null;
  }
  async listByOrganization(organizationId: string): Promise<User[]> {
    const rows = await this.prisma.user.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toUser(r));
  }
  private toRow(u: User) { return { id: u.id, email: u.email, name: u.name, role: u.role, organizationId: u.organizationId, createdAt: u.createdAt }; }
  private toUser(r: { id: string; email: string; name: string; role: string; organizationId: string | null; createdAt: Date }): User {
    return { id: r.id, email: r.email, name: r.name, role: r.role as Role, organizationId: r.organizationId, createdAt: r.createdAt };
  }
}
```

`apps/api/src/infrastructure/auth/prisma-organization.repository.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRepository } from '../../application/auth/repositories';
import { Organization } from '../../application/auth/types';

@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async save(o: Organization): Promise<void> {
    await this.prisma.organization.upsert({ where: { id: o.id }, create: o, update: o });
  }
  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }
}
```

`apps/api/src/infrastructure/auth/prisma-auth-identity.repository.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthIdentityRepository } from '../../application/auth/repositories';
import { AuthIdentity } from '../../application/auth/types';

@Injectable()
export class PrismaAuthIdentityRepository implements AuthIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}
  async save(i: AuthIdentity): Promise<void> {
    await this.prisma.authIdentity.upsert({ where: { id: i.id }, create: i, update: i });
  }
  async findByProviderIdentifier(provider: string, identifier: string): Promise<AuthIdentity | null> {
    return this.prisma.authIdentity.findUnique({ where: { provider_identifier: { provider, identifier } } });
  }
}
```

`apps/api/src/infrastructure/auth/prisma-invitation.repository.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationRepository } from '../../application/auth/repositories';
import { Invitation, InvitationStatus } from '../../application/auth/types';

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async save(inv: Invitation): Promise<void> {
    await this.prisma.invitation.upsert({ where: { id: inv.id }, create: this.toRow(inv), update: this.toRow(inv) });
  }
  async findById(id: string): Promise<Invitation | null> { return this.map(await this.prisma.invitation.findUnique({ where: { id } })); }
  async findByToken(token: string): Promise<Invitation | null> { return this.map(await this.prisma.invitation.findUnique({ where: { token } })); }
  async findPendingByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null> {
    return this.map(await this.prisma.invitation.findFirst({ where: { email, organizationId, status: 'pending' } }));
  }
  async listByOrganization(organizationId: string): Promise<Invitation[]> {
    const rows = await this.prisma.invitation.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.map(r)!);
  }
  private toRow(inv: Invitation) {
    return { id: inv.id, organizationId: inv.organizationId, email: inv.email, role: inv.role, token: inv.token, status: inv.status, expiresAt: inv.expiresAt, invitedByUserId: inv.invitedByUserId, createdAt: inv.createdAt, acceptedAt: inv.acceptedAt };
  }
  private map(r: { id: string; organizationId: string; email: string; role: string; token: string; status: string; expiresAt: Date; invitedByUserId: string; createdAt: Date; acceptedAt: Date | null } | null): Invitation | null {
    return r ? { ...r, role: 'editor', status: r.status as InvitationStatus } : null;
  }
}
```

- [ ] **Step 4: Compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur (le champ composite `provider_identifier` provient du `@@unique([provider, identifier])`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/auth apps/api/src/application/auth/in-memory-repositories.ts apps/api/src/application/auth/in-memory-repositories.spec.ts
git commit -m "feat(api): repos Prisma auth + doubles en mémoire

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Use-cases register / login / me

**Files:**
- Create: `apps/api/src/application/auth/register.use-case.ts` + `.spec.ts`
- Create: `apps/api/src/application/auth/login.use-case.ts` + `.spec.ts`
- Create: `apps/api/src/application/auth/get-me.use-case.ts`

**Interfaces:**
- Consumes: repos + `PasswordHasher` + `AuthTokenService` + `Clock` + `IdGenerator`, erreurs.
- Produces:
  - `RegisterUseCase.execute(input: { email: string; password: string; name: string; organizationName: string }): Promise<{ token: string; user: User }>`
  - `LoginUseCase.execute(input: { email: string; password: string }): Promise<{ token: string; user: User }>`
  - `GetMeUseCase.execute(input: { userId: string }): Promise<User>`

- [ ] **Step 1: Écrire les use-cases register/login/me**

`apps/api/src/application/auth/register.use-case.ts` :

```ts
import { UserRepository, OrganizationRepository, AuthIdentityRepository } from './repositories';
import { PasswordHasher } from './password-hasher';
import { AuthTokenService } from './auth-token.service';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { EmailAlreadyUsedError } from './errors';
import { User } from './types';

export interface RegisterInput { email: string; password: string; name: string; organizationName: string; }

export class RegisterUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly orgs: OrganizationRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AuthTokenService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterInput): Promise<{ token: string; user: User }> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw new EmailAlreadyUsedError(email);
    const now = new Date(this.clock.nowIso());
    const org = { id: this.ids.next(), name: input.organizationName, createdAt: now };
    await this.orgs.save(org);
    const user: User = { id: this.ids.next(), email, name: input.name, role: 'admin', organizationId: org.id, createdAt: now };
    await this.users.save(user);
    await this.identities.save({ id: this.ids.next(), userId: user.id, provider: 'password', identifier: email, secret: await this.hasher.hash(input.password), createdAt: now });
    const token = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId });
    return { token, user };
  }
}
```

`apps/api/src/application/auth/login.use-case.ts` :

```ts
import { UserRepository, AuthIdentityRepository } from './repositories';
import { PasswordHasher } from './password-hasher';
import { AuthTokenService } from './auth-token.service';
import { InvalidCredentialsError } from './errors';
import { User } from './types';

export interface LoginInput { email: string; password: string; }

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AuthTokenService,
  ) {}

  async execute(input: LoginInput): Promise<{ token: string; user: User }> {
    const email = input.email.trim().toLowerCase();
    const identity = await this.identities.findByProviderIdentifier('password', email);
    if (!identity) throw new InvalidCredentialsError();
    if (!(await this.hasher.verify(input.password, identity.secret))) throw new InvalidCredentialsError();
    const user = await this.users.findById(identity.userId);
    if (!user) throw new InvalidCredentialsError();
    const token = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId });
    return { token, user };
  }
}
```

`apps/api/src/application/auth/get-me.use-case.ts` :

```ts
import { UserRepository } from './repositories';
import { InvalidCredentialsError } from './errors';
import { User } from './types';

export class GetMeUseCase {
  constructor(private readonly users: UserRepository) {}
  async execute(input: { userId: string }): Promise<User> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new InvalidCredentialsError();
    return user;
  }
}
```

- [ ] **Step 2: Écrire les tests (échouent)**

`apps/api/src/application/auth/register.use-case.spec.ts` :

```ts
import { RegisterUseCase } from './register.use-case';
import { LoginUseCase } from './login.use-case';
import { InMemoryUserRepository, InMemoryOrganizationRepository, InMemoryAuthIdentityRepository } from './in-memory-repositories';
import { EmailAlreadyUsedError, InvalidCredentialsError } from './errors';

const hasher = { hash: async (p: string) => `h:${p}`, verify: async (p: string, h: string) => h === `h:${p}` };
const tokens = { sign: () => 'jwt', verify: () => ({ sub: 'x', email: 'x', role: 'admin' as const, organizationId: null }) };
const clock = { nowIso: () => '2026-07-13T00:00:00Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function makeRegister() {
  const users = new InMemoryUserRepository(); const orgs = new InMemoryOrganizationRepository(); const identities = new InMemoryAuthIdentityRepository();
  return { users, orgs, identities, uc: new RegisterUseCase(users, orgs, identities, hasher, tokens, clock, ids) };
}

describe('RegisterUseCase', () => {
  beforeEach(() => { n = 0; });
  it('crée org + user admin + identity password et renvoie un token', async () => {
    const { users, uc } = makeRegister();
    const { token, user } = await uc.execute({ email: 'A@B.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    expect(token).toBe('jwt');
    expect(user.role).toBe('admin');
    expect(user.email).toBe('a@b.c');
    expect(user.organizationId).not.toBeNull();
    expect((await users.findByEmail('a@b.c'))?.id).toBe(user.id);
  });
  it('email déjà pris → EmailAlreadyUsedError', async () => {
    const { uc } = makeRegister();
    await uc.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    await expect(uc.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop2' })).rejects.toBeInstanceOf(EmailAlreadyUsedError);
  });
});

describe('LoginUseCase', () => {
  beforeEach(() => { n = 0; });
  it('identifiants valides → token ; invalides → InvalidCredentialsError', async () => {
    const { users, identities, uc: reg } = makeRegister();
    await reg.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    const login = new LoginUseCase(users, identities, hasher, tokens);
    expect((await login.execute({ email: 'a@b.c', password: 'pw' })).token).toBe('jwt');
    await expect(login.execute({ email: 'a@b.c', password: 'bad' })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
```

Run: `cd apps/api && npx jest register.use-case --silent`
Expected: FAIL puis, une fois le Step 1 en place, PASS. (Le Step 1 précède : relancer.)

- [ ] **Step 3: Lancer les tests**

Run: `cd apps/api && npx jest register.use-case --silent`
Expected: PASS (4 assertions réparties sur 3 tests).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/application/auth/register.use-case.ts apps/api/src/application/auth/login.use-case.ts apps/api/src/application/auth/get-me.use-case.ts apps/api/src/application/auth/register.use-case.spec.ts
git commit -m "feat(api): use-cases register/login/me

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Port notification + adaptateur Brevo + stub

**Files:**
- Create: `apps/api/src/application/notification/notification-port.ts`
- Create: `apps/api/src/infrastructure/notification/fake-notification-sender.ts`
- Create: `apps/api/src/infrastructure/notification/brevo-email-notification-sender.ts` + `.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `NotificationPort` + `NOTIFICATION_PORT` + type `Notification` ; `FakeNotificationSender` (classe avec `public readonly sent: Notification[]`) ; `BrevoEmailNotificationSender implements NotificationPort`.

- [ ] **Step 1: Écrire le port + le stub**

`apps/api/src/application/notification/notification-port.ts` :

```ts
export type Notification = { kind: 'invitation'; to: string; organizationName: string; inviteUrl: string; expiresAt: Date };
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
export interface NotificationPort { send(n: Notification): Promise<void>; }
```

`apps/api/src/infrastructure/notification/fake-notification-sender.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { Notification, NotificationPort } from '../../application/notification/notification-port';

@Injectable()
export class FakeNotificationSender implements NotificationPort {
  public readonly sent: Notification[] = [];
  async send(n: Notification): Promise<void> { this.sent.push(n); }
}
```

- [ ] **Step 2: Écrire le test de l'adaptateur Brevo (échoue) — fetch mocké, aucun vrai réseau**

`apps/api/src/infrastructure/notification/brevo-email-notification-sender.spec.ts` :

```ts
import { BrevoEmailNotificationSender } from './brevo-email-notification-sender';

describe('BrevoEmailNotificationSender', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD, BREVO_API_KEY: 'k', BREVO_SENDER: 'no-reply@okko.dev' }; });
  afterEach(() => { process.env = OLD; jest.restoreAllMocks(); });

  it('POST Brevo avec api-key et inviteUrl dans le corps', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: true, status: 201 } as Response);
    const sender = new BrevoEmailNotificationSender();
    await sender.send({ kind: 'invitation', to: 'x@y.z', organizationName: 'Coop', inviteUrl: 'http://app/invite/tok', expiresAt: new Date('2026-07-20') });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('k');
    expect(init.body as string).toContain('http://app/invite/tok');
  });

  it('réponse non-ok → throw', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: false, status: 500 } as Response);
    const sender = new BrevoEmailNotificationSender();
    await expect(sender.send({ kind: 'invitation', to: 'x@y.z', organizationName: 'Coop', inviteUrl: 'u', expiresAt: new Date() })).rejects.toThrow();
  });
});
```

Run: `cd apps/api && npx jest brevo-email-notification --silent`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter l'adaptateur Brevo**

`apps/api/src/infrastructure/notification/brevo-email-notification-sender.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { Notification, NotificationPort } from '../../application/notification/notification-port';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class BrevoEmailNotificationSender implements NotificationPort {
  async send(n: Notification): Promise<void> {
    const apiKey = process.env.BREVO_API_KEY;
    const sender = process.env.BREVO_SENDER;
    if (!apiKey || !sender) throw new Error('BREVO_API_KEY / BREVO_SENDER manquant');
    const { subject, html } = this.render(n);
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { email: sender }, to: [{ email: n.to }], subject, htmlContent: html }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}`);
  }
  private render(n: Notification): { subject: string; html: string } {
    const subject = `Invitation à rejoindre ${n.organizationName} sur Okko`;
    const html = `<p>Vous êtes invité·e à rejoindre <strong>${n.organizationName}</strong> sur Okko.</p>`
      + `<p><a href="${n.inviteUrl}">Accepter l'invitation</a></p>`
      + `<p>Ce lien expire le ${n.expiresAt.toISOString().slice(0, 10)}.</p>`;
    return { subject, html };
  }
}
```

Run: `cd apps/api && npx jest brevo-email-notification --silent`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/application/notification apps/api/src/infrastructure/notification
git commit -m "feat(api): port notification + adaptateur Brevo + stub

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Use-cases invitations (créer / lister / révoquer / accepter)

**Files:**
- Create: `apps/api/src/application/auth/create-invitation.use-case.ts`
- Create: `apps/api/src/application/auth/list-invitations.use-case.ts`
- Create: `apps/api/src/application/auth/revoke-invitation.use-case.ts`
- Create: `apps/api/src/application/auth/accept-invitation.use-case.ts`
- Create: `apps/api/src/application/auth/invitations.spec.ts`

**Interfaces:**
- Consumes: repos, `PasswordHasher`, `AuthTokenService`, `NotificationPort`, `Clock`, `IdGenerator`, erreurs.
- Produces:
  - `CreateInvitationUseCase.execute(input: { organizationId: string; email: string; invitedByUserId: string }): Promise<{ invitation: Invitation; emailSent: boolean }>`
  - `ListInvitationsUseCase.execute(input: { organizationId: string }): Promise<Invitation[]>`
  - `RevokeInvitationUseCase.execute(input: { id: string; organizationId: string }): Promise<void>`
  - `AcceptInvitationUseCase.execute(input: { token: string; name: string; password: string }): Promise<{ token: string; user: User }>`
  - Constante `INVITATION_TTL_DAYS = 7`.

- [ ] **Step 1: Écrire les use-cases**

`apps/api/src/application/auth/create-invitation.use-case.ts` :

```ts
import { InvitationRepository, OrganizationRepository, UserRepository } from './repositories';
import { NotificationPort } from '../notification/notification-port';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { EmailAlreadyUsedError } from './errors';
import { Invitation } from './types';

export const INVITATION_TTL_DAYS = 7;

export interface CreateInvitationInput { organizationId: string; email: string; invitedByUserId: string; }

export class CreateInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly orgs: OrganizationRepository,
    private readonly users: UserRepository,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateInvitationInput): Promise<{ invitation: Invitation; emailSent: boolean }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing && existing.organizationId === input.organizationId) throw new EmailAlreadyUsedError(email);
    const now = new Date(this.clock.nowIso());
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const invitation: Invitation = {
      id: this.ids.next(), organizationId: input.organizationId, email, role: 'editor',
      token: this.ids.next(), status: 'pending', expiresAt, invitedByUserId: input.invitedByUserId, createdAt: now, acceptedAt: null,
    };
    await this.invitations.save(invitation);
    const org = await this.orgs.findById(input.organizationId);
    const inviteUrl = `${process.env.INVITE_BASE_URL ?? 'http://localhost:3000'}/invite/${invitation.token}`;
    let emailSent = true;
    try {
      await this.notifier.send({ kind: 'invitation', to: email, organizationName: org?.name ?? 'Okko', inviteUrl, expiresAt });
    } catch { emailSent = false; }
    return { invitation, emailSent };
  }
}
```

`apps/api/src/application/auth/list-invitations.use-case.ts` :

```ts
import { InvitationRepository } from './repositories';
import { Invitation } from './types';

export class ListInvitationsUseCase {
  constructor(private readonly invitations: InvitationRepository) {}
  async execute(input: { organizationId: string }): Promise<Invitation[]> {
    return this.invitations.listByOrganization(input.organizationId);
  }
}
```

`apps/api/src/application/auth/revoke-invitation.use-case.ts` :

```ts
import { InvitationRepository } from './repositories';
import { InvitationNotFoundError, ForbiddenOrgError } from './errors';

export class RevokeInvitationUseCase {
  constructor(private readonly invitations: InvitationRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const inv = await this.invitations.findById(input.id);
    if (!inv) throw new InvitationNotFoundError(input.id);
    if (inv.organizationId !== input.organizationId) throw new ForbiddenOrgError();
    await this.invitations.save({ ...inv, status: 'revoked' });
  }
}
```

`apps/api/src/application/auth/accept-invitation.use-case.ts` :

```ts
import { InvitationRepository, UserRepository, AuthIdentityRepository } from './repositories';
import { PasswordHasher } from './password-hasher';
import { AuthTokenService } from './auth-token.service';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { InvitationNotFoundError, InvitationInvalidError, EmailAlreadyUsedError } from './errors';
import { User } from './types';

export interface AcceptInvitationInput { token: string; name: string; password: string; }

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AuthTokenService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AcceptInvitationInput): Promise<{ token: string; user: User }> {
    const inv = await this.invitations.findByToken(input.token);
    if (!inv) throw new InvitationNotFoundError(input.token);
    const now = new Date(this.clock.nowIso());
    if (inv.status !== 'pending' || inv.expiresAt.getTime() < now.getTime()) throw new InvitationInvalidError();
    if (await this.users.findByEmail(inv.email)) throw new EmailAlreadyUsedError(inv.email);
    const user: User = { id: this.ids.next(), email: inv.email, name: input.name, role: 'editor', organizationId: inv.organizationId, createdAt: now };
    await this.users.save(user);
    await this.identities.save({ id: this.ids.next(), userId: user.id, provider: 'password', identifier: inv.email, secret: await this.hasher.hash(input.password), createdAt: now });
    await this.invitations.save({ ...inv, status: 'accepted', acceptedAt: now });
    const token = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId });
    return { token, user };
  }
}
```

- [ ] **Step 2: Écrire les tests (échouent)**

`apps/api/src/application/auth/invitations.spec.ts` :

```ts
import { CreateInvitationUseCase } from './create-invitation.use-case';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { RevokeInvitationUseCase } from './revoke-invitation.use-case';
import { InMemoryUserRepository, InMemoryOrganizationRepository, InMemoryAuthIdentityRepository, InMemoryInvitationRepository } from './in-memory-repositories';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';
import { ForbiddenOrgError, InvitationInvalidError } from './errors';

const hasher = { hash: async (p: string) => `h:${p}`, verify: async (p: string, h: string) => h === `h:${p}` };
const tokens = { sign: () => 'jwt', verify: () => ({ sub: 'x', email: 'x', role: 'editor' as const, organizationId: null }) };
const clock = { nowIso: () => '2026-07-13T00:00:00Z' };
const orgDate = new Date(clock.nowIso());
let n = 0; const ids = { next: () => `id${++n}` };

function setup() {
  const users = new InMemoryUserRepository(); const orgs = new InMemoryOrganizationRepository();
  const identities = new InMemoryAuthIdentityRepository(); const invitations = new InMemoryInvitationRepository();
  const notifier = new FakeNotificationSender();
  return { users, orgs, identities, invitations, notifier };
}

describe('invitations', () => {
  beforeEach(() => { n = 0; });

  it('create: crée une invitation pending dans l\'org et notifie', async () => {
    const s = setup();
    await s.orgs.save({ id: 'o1', name: 'Coop', createdAt: orgDate });
    const create = new CreateInvitationUseCase(s.invitations, s.orgs, s.users, s.notifier, clock, ids);
    const { invitation, emailSent } = await create.execute({ organizationId: 'o1', email: 'X@Y.z', invitedByUserId: 'admin1' });
    expect(invitation.status).toBe('pending');
    expect(invitation.email).toBe('x@y.z');
    expect(emailSent).toBe(true);
    expect(s.notifier.sent[0].inviteUrl).toContain(invitation.token);
  });

  it('accept: crée un editor dans la bonne org ; token à usage unique', async () => {
    const s = setup();
    await s.orgs.save({ id: 'o1', name: 'Coop', createdAt: orgDate });
    const create = new CreateInvitationUseCase(s.invitations, s.orgs, s.users, s.notifier, clock, ids);
    const { invitation } = await create.execute({ organizationId: 'o1', email: 'e@x.z', invitedByUserId: 'admin1' });
    const accept = new AcceptInvitationUseCase(s.invitations, s.users, s.identities, hasher, tokens, clock, ids);
    const { user } = await accept.execute({ token: invitation.token, name: 'E', password: 'pw' });
    expect(user.role).toBe('editor');
    expect(user.organizationId).toBe('o1');
    await expect(accept.execute({ token: invitation.token, name: 'E', password: 'pw' })).rejects.toBeInstanceOf(InvitationInvalidError);
  });

  it('revoke: refuse une invitation d\'une autre org (ForbiddenOrgError)', async () => {
    const s = setup();
    await s.orgs.save({ id: 'o1', name: 'Coop', createdAt: orgDate });
    const create = new CreateInvitationUseCase(s.invitations, s.orgs, s.users, s.notifier, clock, ids);
    const { invitation } = await create.execute({ organizationId: 'o1', email: 'e@x.z', invitedByUserId: 'admin1' });
    const revoke = new RevokeInvitationUseCase(s.invitations);
    await expect(revoke.execute({ id: invitation.id, organizationId: 'AUTRE' })).rejects.toBeInstanceOf(ForbiddenOrgError);
  });
});
```

Run: `cd apps/api && npx jest invitations --silent`
Expected: PASS (une fois le Step 1 en place).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/application/auth/create-invitation.use-case.ts apps/api/src/application/auth/list-invitations.use-case.ts apps/api/src/application/auth/revoke-invitation.use-case.ts apps/api/src/application/auth/accept-invitation.use-case.ts apps/api/src/application/auth/invitations.spec.ts
git commit -m "feat(api): use-cases invitations (créer/lister/révoquer/accepter)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Guards, décorateurs, contrôleur & module Auth

**Files:**
- Create: `apps/api/src/presentation/auth/decorators.ts` (`@Public`, `@Roles`, `@CurrentUser`, type `AuthUser`)
- Create: `apps/api/src/presentation/auth/auth.guard.ts`
- Create: `apps/api/src/presentation/auth/roles.guard.ts`
- Create: `apps/api/src/presentation/auth/auth.controller.ts`
- Create: `apps/api/src/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: use-cases (T4, T6), token service (T2), repos (T3), notification (T5).
- Produces: `AuthModule` (exporte `AUTH_TOKEN_SERVICE`, `AuthGuard`, `RolesGuard`) ; décorateurs ; `AuthUser = AuthTokenPayload` ; endpoints `/auth/*`.

- [ ] **Step 1: Décorateurs + guards**

`apps/api/src/presentation/auth/decorators.ts` :

```ts
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, AuthTokenPayload } from '../../application/auth/types';

export type AuthUser = AuthTokenPayload;
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
```

`apps/api/src/presentation/auth/auth.guard.ts` :

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from './decorators';
import { AUTH_TOKEN_SERVICE, AuthTokenService } from '../../application/auth/auth-token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_TOKEN_SERVICE) private readonly tokens: AuthTokenService,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try { req.user = this.tokens.verify(header.slice(7)); return true; }
    catch { throw new UnauthorizedException(); }
  }
}
```

`apps/api/src/presentation/auth/roles.guard.ts` :

```ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC, ROLES_KEY } from './decorators';
import { Role } from '../../application/auth/types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    if (!req.user || !roles.includes(req.user.role)) throw new ForbiddenException();
    return true;
  }
}
```

- [ ] **Step 2: Contrôleur Auth**

`apps/api/src/presentation/auth/auth.controller.ts` :

```ts
import { Body, Controller, Get, Param, Post, UseGuards, ConflictException, UnauthorizedException, NotFoundException, GoneException } from '@nestjs/common';
import { RegisterUseCase } from '../../application/auth/register.use-case';
import { LoginUseCase } from '../../application/auth/login.use-case';
import { GetMeUseCase } from '../../application/auth/get-me.use-case';
import { CreateInvitationUseCase } from '../../application/auth/create-invitation.use-case';
import { ListInvitationsUseCase } from '../../application/auth/list-invitations.use-case';
import { RevokeInvitationUseCase } from '../../application/auth/revoke-invitation.use-case';
import { AcceptInvitationUseCase } from '../../application/auth/accept-invitation.use-case';
import { EmailAlreadyUsedError, InvalidCredentialsError, InvitationNotFoundError, InvitationInvalidError, ForbiddenOrgError } from '../../application/auth/errors';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { Public, Roles, CurrentUser, AuthUser } from './decorators';

@Controller('auth')
@UseGuards(AuthGuard, RolesGuard)
export class AuthController {
  constructor(
    private readonly registerUC: RegisterUseCase,
    private readonly loginUC: LoginUseCase,
    private readonly meUC: GetMeUseCase,
    private readonly createInvitationUC: CreateInvitationUseCase,
    private readonly listInvitationsUC: ListInvitationsUseCase,
    private readonly revokeInvitationUC: RevokeInvitationUseCase,
    private readonly acceptInvitationUC: AcceptInvitationUseCase,
  ) {}

  @Public() @Post('register')
  async register(@Body() body: { email: string; password: string; name: string; organizationName: string }) {
    try { return await this.registerUC.execute(body); }
    catch (e) { if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e; }
  }

  @Public() @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try { return await this.loginUC.execute(body); }
    catch (e) { if (e instanceof InvalidCredentialsError) throw new UnauthorizedException('identifiants invalides'); throw e; }
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) { return this.meUC.execute({ userId: user.sub }); }

  @Roles('admin') @Post('invitations')
  async invite(@CurrentUser() user: AuthUser, @Body() body: { email: string }) {
    try { return await this.createInvitationUC.execute({ organizationId: user.organizationId!, email: body.email, invitedByUserId: user.sub }); }
    catch (e) { if (e instanceof EmailAlreadyUsedError) throw new ConflictException('déjà membre'); throw e; }
  }

  @Roles('admin') @Get('invitations')
  async listInvitations(@CurrentUser() user: AuthUser) { return this.listInvitationsUC.execute({ organizationId: user.organizationId! }); }

  @Roles('admin') @Post('invitations/:id/revoke')
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.revokeInvitationUC.execute({ id, organizationId: user.organizationId! }); return { ok: true }; }
    catch (e) { if (e instanceof InvitationNotFoundError) throw new NotFoundException(); if (e instanceof ForbiddenOrgError) throw new NotFoundException(); throw e; }
  }

  @Public() @Post('invitations/:token/accept')
  async accept(@Param('token') token: string, @Body() body: { name: string; password: string }) {
    try { return await this.acceptInvitationUC.execute({ token, name: body.name, password: body.password }); }
    catch (e) {
      if (e instanceof InvitationNotFoundError || e instanceof InvitationInvalidError) throw new GoneException('invitation invalide ou expirée');
      if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e;
    }
  }
}
```

- [ ] **Step 3: Module Auth**

`apps/api/src/auth.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { UuidIdGenerator } from './infrastructure/uuid-id-generator';
import { SystemClock } from './infrastructure/system-clock';
import { CLOCK } from './application/shared/clock';
import { USER_REPOSITORY, ORGANIZATION_REPOSITORY, AUTH_IDENTITY_REPOSITORY, INVITATION_REPOSITORY } from './application/auth/repositories';
import { PASSWORD_HASHER } from './application/auth/password-hasher';
import { AUTH_TOKEN_SERVICE } from './application/auth/auth-token.service';
import { NOTIFICATION_PORT } from './application/notification/notification-port';
import { PrismaUserRepository } from './infrastructure/auth/prisma-user.repository';
import { PrismaOrganizationRepository } from './infrastructure/auth/prisma-organization.repository';
import { PrismaAuthIdentityRepository } from './infrastructure/auth/prisma-auth-identity.repository';
import { PrismaInvitationRepository } from './infrastructure/auth/prisma-invitation.repository';
import { BcryptPasswordHasher } from './infrastructure/auth/bcrypt-password-hasher';
import { JwtAuthTokenService } from './infrastructure/auth/jwt-auth-token.service';
import { BrevoEmailNotificationSender } from './infrastructure/notification/brevo-email-notification-sender';
import { RegisterUseCase } from './application/auth/register.use-case';
import { LoginUseCase } from './application/auth/login.use-case';
import { GetMeUseCase } from './application/auth/get-me.use-case';
import { CreateInvitationUseCase } from './application/auth/create-invitation.use-case';
import { ListInvitationsUseCase } from './application/auth/list-invitations.use-case';
import { RevokeInvitationUseCase } from './application/auth/revoke-invitation.use-case';
import { AcceptInvitationUseCase } from './application/auth/accept-invitation.use-case';
import { AuthController } from './presentation/auth/auth.controller';
import { AuthGuard } from './presentation/auth/auth.guard';
import { RolesGuard } from './presentation/auth/roles.guard';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret', signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } })],
  controllers: [AuthController],
  providers: [
    PrismaService, UuidIdGenerator,
    { provide: CLOCK, useClass: SystemClock },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
    { provide: AUTH_IDENTITY_REPOSITORY, useClass: PrismaAuthIdentityRepository },
    { provide: INVITATION_REPOSITORY, useClass: PrismaInvitationRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: AUTH_TOKEN_SERVICE, useClass: JwtAuthTokenService },
    { provide: NOTIFICATION_PORT, useClass: BrevoEmailNotificationSender },
    AuthGuard, RolesGuard,
    { provide: RegisterUseCase, useFactory: (u, o, i, h, t, c, g) => new RegisterUseCase(u, o, i, h, t, c, g), inject: [USER_REPOSITORY, ORGANIZATION_REPOSITORY, AUTH_IDENTITY_REPOSITORY, PASSWORD_HASHER, AUTH_TOKEN_SERVICE, CLOCK, UuidIdGenerator] },
    { provide: LoginUseCase, useFactory: (u, i, h, t) => new LoginUseCase(u, i, h, t), inject: [USER_REPOSITORY, AUTH_IDENTITY_REPOSITORY, PASSWORD_HASHER, AUTH_TOKEN_SERVICE] },
    { provide: GetMeUseCase, useFactory: (u) => new GetMeUseCase(u), inject: [USER_REPOSITORY] },
    { provide: CreateInvitationUseCase, useFactory: (inv, o, u, n, c, g) => new CreateInvitationUseCase(inv, o, u, n, c, g), inject: [INVITATION_REPOSITORY, ORGANIZATION_REPOSITORY, USER_REPOSITORY, NOTIFICATION_PORT, CLOCK, UuidIdGenerator] },
    { provide: ListInvitationsUseCase, useFactory: (inv) => new ListInvitationsUseCase(inv), inject: [INVITATION_REPOSITORY] },
    { provide: RevokeInvitationUseCase, useFactory: (inv) => new RevokeInvitationUseCase(inv), inject: [INVITATION_REPOSITORY] },
    { provide: AcceptInvitationUseCase, useFactory: (inv, u, i, h, t, c, g) => new AcceptInvitationUseCase(inv, u, i, h, t, c, g), inject: [INVITATION_REPOSITORY, USER_REPOSITORY, AUTH_IDENTITY_REPOSITORY, PASSWORD_HASHER, AUTH_TOKEN_SERVICE, CLOCK, UuidIdGenerator] },
  ],
  exports: [AUTH_TOKEN_SERVICE, AuthGuard, RolesGuard],
})
export class AuthModule {}
```

> Note d'implémentation : `SystemClock` (`infrastructure/system-clock.ts`) implémente `Clock.nowIso()` ; token `CLOCK` (`application/shared/clock.ts`). `UuidIdGenerator` (`infrastructure/uuid-id-generator.ts`) est injecté **par classe** (pas de token `ID_GENERATOR`), exactement comme dans `crop.module.ts`.

`apps/api/src/app.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { CropModule } from './crop.module';
import { AuthModule } from './auth.module';

@Module({ imports: [AuthModule, CropModule] })
export class AppModule {}
```

- [ ] **Step 4: Écrire l'e2e auth (échoue)**

`apps/api/test/auth.e2e-spec.ts` :

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { NOTIFICATION_PORT } from '../src/application/notification/notification-port';
import { FakeNotificationSender } from '../src/infrastructure/notification/fake-notification-sender';

describe('Auth e2e', () => {
  let app: INestApplication; let prisma: PrismaService;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NOTIFICATION_PORT).useClass(FakeNotificationSender).compile();
    app = mod.createNestApplication(); prisma = app.get(PrismaService); await app.init();
    await prisma.invitation.deleteMany(); await prisma.authIdentity.deleteMany(); await prisma.user.deleteMany(); await prisma.organization.deleteMany();
  });
  afterAll(async () => {
    await prisma.invitation.deleteMany(); await prisma.authIdentity.deleteMany(); await prisma.user.deleteMany(); await prisma.organization.deleteMany(); await app.close();
  });

  it('register → login → me ; invite → accept → login editor', async () => {
    const reg = await request(app.getHttpServer()).post('/auth/register')
      .send({ email: 'admin@coop.bj', password: 'pw', name: 'Chef', organizationName: 'Coop' }).expect(201);
    const adminToken = reg.body.token;
    expect(reg.body.user.role).toBe('admin');

    await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const inv = await request(app.getHttpServer()).post('/auth/invitations')
      .set('Authorization', `Bearer ${adminToken}`).send({ email: 'agent@coop.bj' }).expect(201);
    const token = inv.body.invitation.token;

    const acc = await request(app.getHttpServer()).post(`/auth/invitations/${token}/accept`)
      .send({ name: 'Agent', password: 'pw2' }).expect(201);
    expect(acc.body.user.role).toBe('editor');
    expect(acc.body.user.organizationId).toBe(reg.body.user.organizationId);

    // editor ne peut pas inviter (403)
    await request(app.getHttpServer()).post('/auth/invitations')
      .set('Authorization', `Bearer ${acc.body.token}`).send({ email: 'x@y.z' }).expect(403);

    // token d'invitation à usage unique
    await request(app.getHttpServer()).post(`/auth/invitations/${token}/accept`).send({ name: 'X', password: 'p' }).expect(410);
  });
});
```

Run: `cd apps/api && npx jest --config ./jest.config.js auth.e2e --silent` (⚠️ efface les tables auth)
Expected: PASS.

> Note : si `jest.config.js` restreint `roots`/`testMatch` au dossier `src`, exécuter les e2e comme le fait la suite existante (les fichiers `test/*.e2e-spec.ts` sont déjà pris par la config). Vérifier avec `npx jest auth.e2e`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/presentation/auth apps/api/src/auth.module.ts apps/api/src/app.module.ts apps/api/test/auth.e2e-spec.ts
git commit -m "feat(api): guards + décorateurs + AuthController + AuthModule + e2e

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Protéger les endpoints Base (superadmin) + audit → utilisateur

**Files:**
- Modify: `apps/api/src/crop.module.ts` (importer `AuthModule`)
- Modify: `apps/api/src/presentation/crop/crop.controller.ts` (guards + `@Public` sur `/published` + `ACTOR`→`user.email`)
- Modify: `apps/api/src/presentation/zone/zone.controller.ts` (guards + `ACTOR`→`user.email`)
- Modify: `apps/api/src/presentation/pest/pest.controller.ts` (guards + `ACTOR`→`user.email`)
- Modify: tous les `apps/api/test/*.e2e-spec.ts` touchant crops/zones/pests (bypass auth superadmin)
- Create: `apps/api/test/helpers/auth.ts`

**Interfaces:**
- Consumes: `AuthModule` (exporte guards + `AUTH_TOKEN_SERVICE`), décorateurs.
- Produces: endpoints Base `superadmin`-only ; `/published` public ; `actor` = email de l'utilisateur authentifié.

- [ ] **Step 1: Importer `AuthModule` dans `CropModule`**

Dans `apps/api/src/crop.module.ts`, ajouter l'import et l'`imports` :

```ts
import { AuthModule } from './auth.module';
// dans le décorateur @Module({ ... }) :
  imports: [AuthModule],
```

(si un `imports:` existe déjà, y ajouter `AuthModule`).

- [ ] **Step 2: Garder `CropController` + rendre `/published` public + brancher l'acteur**

Dans `apps/api/src/presentation/crop/crop.controller.ts` :
- Ajouter les imports : `UseGuards` (depuis `@nestjs/common`), et
  ```ts
  import { AuthGuard } from '../auth/auth.guard';
  import { RolesGuard } from '../auth/roles.guard';
  import { Public, Roles, CurrentUser, AuthUser } from '../auth/decorators';
  ```
- Décorer la classe : `@Controller('crops')` inchangé, ajouter au-dessus/à côté :
  ```ts
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('superadmin')
  ```
- Sur le handler `@Get(':id/published')` (ligne ~315), ajouter `@Public()`.
- Supprimer `const ACTOR = 'admin';`. Pour **chacun** des handlers qui passe `actor: ACTOR` (20 occurrences — méthodes : `create`, `update`, `publish`, `setRequirements`, `addVariety`, `updateVariety`, `setSuitability`, `setPhenology`, `addWindow`, `updateWindow`, `setPestControl`, `setNutrition`, `setYields`, `addPrice`, `updatePrice`, `discardDraft`, `restore`, `archive`, `unarchive`, et tout autre appel `actor: ACTOR`), ajouter le paramètre `@CurrentUser() user: AuthUser` à la signature et remplacer `actor: ACTOR` par `actor: user.email`.

  Exemple de transformation (un handler) :
  ```ts
  // avant
  async create(@Body() body: ...) {
    const snap = await this.createCrop.execute({ id: randomUUID(), actor: ACTOR, ...body });
  // après
  async create(@CurrentUser() user: AuthUser, @Body() body: ...) {
    const snap = await this.createCrop.execute({ id: randomUUID(), actor: user.email, ...body });
  ```

  Vérifier ensuite : `grep -n "ACTOR" apps/api/src/presentation/crop/crop.controller.ts` → **vide**.

- [ ] **Step 3: Garder Zone & Pest + brancher l'acteur**

Dans `apps/api/src/presentation/zone/zone.controller.ts` et `apps/api/src/presentation/pest/pest.controller.ts` :
- Mêmes imports (`UseGuards`, `AuthGuard`, `RolesGuard`, `Roles`, `CurrentUser`, `AuthUser` depuis `../auth/...`).
- Décorer chaque classe avec `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('superadmin')`.
- Supprimer `const ACTOR = 'admin';` ; pour chaque handler passant `actor: ACTOR` (create/update/delete), ajouter `@CurrentUser() user: AuthUser` et utiliser `actor: user.email`.
- `grep -rn "ACTOR" apps/api/src/presentation/zone apps/api/src/presentation/pest` → **vide**.

- [ ] **Step 4: Helper de bypass auth pour les e2e Base**

`apps/api/test/helpers/auth.ts` :

```ts
import { TestingModuleBuilder } from '@nestjs/testing';
import { AuthGuard } from '../../src/presentation/auth/auth.guard';

/** Bypass l'authentification en injectant un superadmin de test dans la requête. */
export function asSuperadmin(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder.overrideGuard(AuthGuard).useValue({
    canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
      ctx.switchToHttp().getRequest().user = { sub: 'test-super', email: 'super@okko.dev', role: 'superadmin', organizationId: null };
      return true;
    },
  });
}
```

- [ ] **Step 5: Appliquer le bypass à chaque e2e Base**

Dans **chaque** fichier `apps/api/test/*.e2e-spec.ts` qui appelle `/crops`, `/zones` ou `/pests` (tous sauf `auth.e2e-spec.ts` et `cors.e2e-spec.ts` s'il ne tape pas ces routes), transformer la construction du module de test :

```ts
// avant
const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
// après
import { asSuperadmin } from './helpers/auth';
const mod = await asSuperadmin(Test.createTestingModule({ imports: [AppModule] })).compile();
```

Fichiers concernés : `crop.e2e-spec.ts`, `crop-archive.e2e-spec.ts`, `crop-completeness-list.e2e-spec.ts`, `crop-diff.e2e-spec.ts`, `crop-event-sourcing.e2e-spec.ts`, `crop-publish-note.e2e-spec.ts`, `crop-restore.e2e-spec.ts`, `crop-sections-event-sourcing.e2e-spec.ts`, `crop-version-history.e2e-spec.ts`, `crop-versioning.e2e-spec.ts`, `history-completeness.e2e-spec.ts`, `nutrition-price.e2e-spec.ts`, `variety-requirements.e2e-spec.ts`, `window.e2e-spec.ts`, `zone-pest-crud.e2e-spec.ts`, `zone.e2e-spec.ts`, `pest.e2e-spec.ts`. (Vérifier par `grep -rl "'/crops'\|\`/crops\|/zones\|/pests" apps/api/test`.)

Si un e2e vérifie l'audit `actor`, il attendra désormais `super@okko.dev` (au lieu de `admin`) — mettre à jour ces assertions.

- [ ] **Step 6: Vérifier compilation + suite complète (⚠️ efface la DB — prévenir)**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

Run: `pnpm --filter @okko/api test`
Expected: PASS — toute la suite verte (auth + Base gardée + non-régression). `GET /:id/published` reste accessible sans token ; un `POST /crops` sans bypass/token → 401.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/crop.module.ts apps/api/src/presentation apps/api/test
git commit -m "feat(api): endpoints Base superadmin-only + audit sur l'utilisateur authentifié

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Seed superadmin

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json` (config `prisma.seed`)
- Modify: `README.md` (documenter le seed + variables d'env)

**Interfaces:**
- Consumes: modèles Prisma, `bcryptjs`.
- Produces: un `User(role='superadmin', organizationId=null)` + `AuthIdentity(password)` idempotent depuis l'env.

- [ ] **Step 1: Écrire le seed**

`apps/api/prisma/seed.ts` :

```ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? 'superadmin@okko.dev').toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD ?? 'change-me';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) { console.log(`superadmin déjà présent: ${email}`); return; }
  const userId = randomUUID();
  await prisma.user.create({ data: { id: userId, email, name: 'Super Admin', role: 'superadmin', organizationId: null } });
  await prisma.authIdentity.create({ data: { id: randomUUID(), userId, provider: 'password', identifier: email, secret: await bcrypt.hash(password, 10) } });
  console.log(`superadmin créé: ${email}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Déclarer la commande de seed**

Dans `apps/api/package.json`, ajouter au niveau racine :

```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

- [ ] **Step 3: Exécuter le seed (idempotent)**

Run: `cd apps/api && SUPERADMIN_EMAIL=superadmin@okko.dev SUPERADMIN_PASSWORD=okko-dev npx prisma db seed`
Expected: « superadmin créé: superadmin@okko.dev » ; un 2e run affiche « superadmin déjà présent ».

- [ ] **Step 4: Documenter dans le README**

Ajouter au `README.md` une section « Authentification (dev) » : variables `JWT_SECRET`, `JWT_EXPIRES_IN`, `BREVO_API_KEY`, `BREVO_SENDER`, `INVITE_BASE_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` ; commande `npx prisma db seed` pour créer le superadmin ; note « les endpoints Base sont superadmin-only ; `GET /crops/:id/published` reste public ».

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/seed.ts apps/api/package.json README.md
git commit -m "feat(api): seed superadmin idempotent + doc auth

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Vérification finale (post-tâches)
- `cd apps/api && npx tsc --noEmit` clean.
- `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir).
- Smoke manuel (optionnel, hors CI) : configurer `BREVO_API_KEY`/`BREVO_SENDER`, `POST /auth/register`, `POST /auth/invitations` → **email Brevo réel reçu** ; `POST /auth/invitations/:token/accept` ; `POST /crops` sans token → 401 ; `GET /crops/:id/published` sans token → 200.

## Critères de succès (rappel spec)
- [ ] Modèles + migration ; schéma provider-agnostique (User/AuthIdentity séparés).
- [ ] register/login/me + invitations (créer/lister/révoquer/accepter) ; JWT + `AuthGuard`/`RolesGuard` ; erreurs mappées (409/401/403/404/410).
- [ ] Port notification + adaptateur Brevo + **stub en test** (aucun appel Brevo en CI).
- [ ] Endpoints Base `superadmin`-only ; `/published` public ; audit `actor` = utilisateur authentifié.
- [ ] Seed superadmin (env, idempotent, documenté).
- [ ] Cloisonnement inter-org testé ; suite API verte.
- [ ] Périmètre : aucune UI admin (Plan B), aucun domaine carnet.

## Suite
Le **Plan B (Admin BFF)** — pages `/login`, `/register`, `/invite/[token]`, `/membres`, `/suivi`, cookie httpOnly, middleware de gating — sera écrit une fois ce Plan A exécuté et fusionné.
