# Confirmation d'email à l'inscription — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'auto-connexion à l'inscription par un flux de confirmation d'email : compte créé non confirmé, email de confirmation envoyé, login bloqué tant que non confirmé, avec renvoi de l'email.

**Architecture:** API NestJS/Prisma (hexagonal) : champs de confirmation sur `User`, token secret confiné à la couche persistance (méthodes repo dédiées), use-cases register (sans JWT) / confirm / resend / login gating, variante notification `email_confirmation`. Admin Next.js : page « email envoyé » + renvoi, page `/confirm/[token]`, message login non-confirmé + renvoi, middleware.

**Tech Stack:** NestJS 10, Prisma 5/Postgres, Jest + supertest ; Next.js 14 App Router, Server Actions, Vitest.

## Global Constraints

- **Secret confiné** : le `confirmationToken` n'apparaît **jamais** dans le type domaine `User` (sinon fuite via `login`/`/auth/me`). Il vit dans la persistance, via 3 méthodes `UserRepository` : `findByConfirmationToken(token): Promise<{ user: User; expiresAt: Date } | null>`, `setConfirmationToken(userId, token, expiresAt): Promise<void>`, `confirmEmail(userId, verifiedAt): Promise<void>`.
- **Type `User`** (application) gagne **`emailVerifiedAt: Date | null`** (requis). Tous les sites de construction d'un `User` doivent le fournir.
- **Constante partagée** `CONFIRM_TTL_HOURS = 24` dans `apps/api/src/application/auth/confirmation.ts`.
- **URL de confirmation** : `${process.env.INVITE_BASE_URL ?? 'http://localhost:3000'}/confirm/<token>`.
- **Anti-énumération** : `POST /auth/confirm/resend` retourne toujours 202, quel que soit l'état/l'existence du compte.
- **Codes HTTP** : register 201 `{ status: 'confirmation_sent', email }` ; confirm 200 `{ confirmed, alreadyConfirmed, email }` ; confirm invalide/expiré 410 ; resend 202 ; login non-confirmé 403.
- **Invités & superadmin sont confirmés d'office** : `accept-invitation` pose `emailVerifiedAt = now` (le lien d'invitation prouve la possession de l'email) ; le seed superadmin pose `emailVerifiedAt = new Date()`.
- **Tests** : jamais d'appel Brevo réel (stub `FakeNotificationSender`). ⚠️ la suite e2e API **efface la DB** — prévenir avant `pnpm --filter @okko/api test`. Admin : `fetch`/actions mockés, aucun réseau réel.
- **Commits** : terminer par `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Migration Prisma (champs de confirmation sur User)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create (généré): `apps/api/prisma/migrations/*/migration.sql`

**Interfaces:**
- Consumes: rien.
- Produces: colonnes `emailVerifiedAt`, `confirmationToken` (unique), `confirmationExpiresAt` sur la table `User`.

- [ ] **Step 1: Ajouter les champs au modèle User**

Dans `apps/api/prisma/schema.prisma`, dans `model User { ... }`, ajouter après `organizationId String?` (avant la ligne `organization`) :

```prisma
  emailVerifiedAt       DateTime?
  confirmationToken     String?   @unique
  confirmationExpiresAt DateTime?
```

- [ ] **Step 2: Générer + appliquer la migration**

Run: `cd apps/api && npx prisma migrate dev --name email_confirmation`
Expected: migration créée et appliquée, client régénéré, sans erreur.

- [ ] **Step 3: Vérifier la compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur (le client Prisma expose les nouveaux champs ; le code existant ne les référence pas encore).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): migration Prisma champs de confirmation email (User)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Domaine & persistance — emailVerifiedAt, erreurs, méthodes repo

**Files:**
- Modify: `apps/api/src/application/auth/types.ts`
- Modify: `apps/api/src/application/auth/errors.ts`
- Modify: `apps/api/src/application/auth/repositories.ts`
- Modify: `apps/api/src/application/auth/in-memory-repositories.ts`
- Modify: `apps/api/src/application/auth/in-memory-repositories.spec.ts`
- Modify: `apps/api/src/infrastructure/auth/prisma-user.repository.ts`
- Modify: `apps/api/src/application/auth/register.use-case.ts` (juste le littéral User → `emailVerifiedAt: null`)
- Modify: `apps/api/src/application/auth/accept-invitation.use-case.ts` (littéral User → `emailVerifiedAt: now`)
- Modify: `apps/api/prisma/seed.ts` (superadmin `emailVerifiedAt: new Date()`)

**Interfaces:**
- Consumes: type `User` (Task 1 côté DB).
- Produces: `User.emailVerifiedAt: Date | null` ; erreurs `EmailNotConfirmedError`, `ConfirmationInvalidError` ; `UserRepository.findByConfirmationToken`/`setConfirmationToken`/`confirmEmail` + doubles en mémoire + adaptateur Prisma. Réutilisés par les tâches 4, 5.

- [ ] **Step 1: Type User + erreurs**

`apps/api/src/application/auth/types.ts` — remplacer l'interface `User` par :

```ts
export interface User { id: string; email: string; name: string; role: Role; organizationId: string | null; createdAt: Date; emailVerifiedAt: Date | null; }
```

`apps/api/src/application/auth/errors.ts` — ajouter à la fin :

```ts
export class EmailNotConfirmedError extends Error {}   // login d'un compte non confirmé
export class ConfirmationInvalidError extends Error {}  // token de confirmation introuvable/expiré
```

- [ ] **Step 2: Étendre le port UserRepository**

`apps/api/src/application/auth/repositories.ts` — dans `interface UserRepository`, ajouter les 3 méthodes :

```ts
  findByConfirmationToken(token: string): Promise<{ user: User; expiresAt: Date } | null>;
  setConfirmationToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  confirmEmail(userId: string, verifiedAt: Date): Promise<void>;
```

- [ ] **Step 3: Doubles en mémoire + test (échoue)**

`apps/api/src/application/auth/in-memory-repositories.ts` — dans `class InMemoryUserRepository`, ajouter le champ privé et les 3 méthodes (après `listByOrganization`) :

```ts
  private readonly confirmations = new Map<string, { token: string; expiresAt: Date }>();
  async findByConfirmationToken(token: string): Promise<{ user: User; expiresAt: Date } | null> {
    for (const [userId, c] of this.confirmations) {
      if (c.token === token) { const user = this.rows.find((r) => r.id === userId); if (user) return { user, expiresAt: c.expiresAt }; }
    }
    return null;
  }
  async setConfirmationToken(userId: string, token: string, expiresAt: Date): Promise<void> { this.confirmations.set(userId, { token, expiresAt }); }
  async confirmEmail(userId: string, verifiedAt: Date): Promise<void> {
    const i = this.rows.findIndex((r) => r.id === userId);
    if (i >= 0) this.rows[i] = { ...this.rows[i], emailVerifiedAt: verifiedAt };
    this.confirmations.delete(userId);
  }
```

`apps/api/src/application/auth/in-memory-repositories.spec.ts` — mettre à jour le littéral User existant (ligne du `repo.save`) pour inclure `emailVerifiedAt: null`, et ajouter un test des méthodes de confirmation :

```ts
// dans le test 'User: save + findByEmail', le save devient :
await repo.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: new Date(), emailVerifiedAt: null });
```

Ajouter un nouveau test dans le `describe('in-memory auth repositories', ...)` :

```ts
  it('User: confirmation token set → find → confirm', async () => {
    const repo = new InMemoryUserRepository();
    const exp = new Date(Date.now() + 3600_000);
    await repo.save({ id: 'u2', email: 'c@d.e', name: 'C', role: 'admin', organizationId: 'o1', createdAt: new Date(), emailVerifiedAt: null });
    await repo.setConfirmationToken('u2', 'tok2', exp);
    const found = await repo.findByConfirmationToken('tok2');
    expect(found?.user.id).toBe('u2');
    expect(found?.expiresAt.getTime()).toBe(exp.getTime());
    await repo.confirmEmail('u2', new Date());
    expect((await repo.findByEmail('c@d.e'))?.emailVerifiedAt).not.toBeNull();
    expect(await repo.findByConfirmationToken('tok2')).toBeNull();
  });
```

Run: `cd apps/api && npx jest in-memory-repositories --silent`
Expected: FAIL d'abord (méthodes absentes), PASS une fois le Step 3 en place.

- [ ] **Step 4: Adaptateur Prisma**

`apps/api/src/infrastructure/auth/prisma-user.repository.ts` — remplacer `toRow`/`toUser` et ajouter les 3 méthodes :

```ts
  async findByConfirmationToken(token: string): Promise<{ user: User; expiresAt: Date } | null> {
    const r = await this.prisma.user.findUnique({ where: { confirmationToken: token } });
    if (!r || !r.confirmationExpiresAt) return null;
    return { user: this.toUser(r), expiresAt: r.confirmationExpiresAt };
  }
  async setConfirmationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { confirmationToken: token, confirmationExpiresAt: expiresAt } });
  }
  async confirmEmail(userId: string, verifiedAt: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: verifiedAt, confirmationToken: null, confirmationExpiresAt: null } });
  }
  private toRow(u: User) { return { id: u.id, email: u.email, name: u.name, role: u.role, organizationId: u.organizationId, createdAt: u.createdAt, emailVerifiedAt: u.emailVerifiedAt }; }
  private toUser(r: { id: string; email: string; name: string; role: string; organizationId: string | null; createdAt: Date; emailVerifiedAt: Date | null }): User {
    return { id: r.id, email: r.email, name: r.name, role: r.role as Role, organizationId: r.organizationId, createdAt: r.createdAt, emailVerifiedAt: r.emailVerifiedAt };
  }
```

> Note : `toRow` n'inclut pas `confirmationToken`/`confirmationExpiresAt` — `save()` ne doit pas les écraser ; ils sont gérés uniquement par `setConfirmationToken`/`confirmEmail`.

- [ ] **Step 5: Corriger les littéraux User restants (compilation)**

`apps/api/src/application/auth/register.use-case.ts` — au littéral `const user: User = {...}`, ajouter `emailVerifiedAt: null` (Task 4 complètera le reste) :

```ts
    const user: User = { id: this.ids.next(), email, name: input.name, role: 'admin', organizationId: org.id, createdAt: now, emailVerifiedAt: null };
```

`apps/api/src/application/auth/accept-invitation.use-case.ts` — au littéral `const user: User = {...}`, ajouter `emailVerifiedAt: now` (l'invité est confirmé par le lien) :

```ts
    const user: User = { id: this.ids.next(), email: inv.email, name: input.name, role: 'editor', organizationId: inv.organizationId, createdAt: now, emailVerifiedAt: now };
```

`apps/api/prisma/seed.ts` — dans `prisma.user.create({ data: {...} })`, ajouter `emailVerifiedAt: new Date()` (le superadmin doit pouvoir se connecter) :

```ts
  await prisma.user.create({ data: { id: userId, email, name: 'Super Admin', role: 'superadmin', organizationId: null, emailVerifiedAt: new Date() } });
```

- [ ] **Step 6: Compilation + tests ciblés**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/api && npx jest in-memory-repositories --silent`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/application/auth apps/api/src/infrastructure/auth/prisma-user.repository.ts apps/api/prisma/seed.ts
git commit -m "feat(api): emailVerifiedAt + méthodes repo de confirmation (secret confiné)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Notification `email_confirmation` + rendu Brevo

**Files:**
- Modify: `apps/api/src/application/notification/notification-port.ts`
- Modify: `apps/api/src/infrastructure/notification/brevo-email-notification-sender.ts`
- Modify: `apps/api/src/infrastructure/notification/brevo-email-notification-sender.spec.ts`
- Modify: `apps/api/src/application/auth/invitations.spec.ts` (narrow union)

**Interfaces:**
- Consumes: rien.
- Produces: `Notification` union avec `{ kind: 'email_confirmation'; to: string; confirmUrl: string; expiresAt: Date }`. Réutilisé par les tâches 4, 5.

- [ ] **Step 1: Étendre le type Notification**

`apps/api/src/application/notification/notification-port.ts` — remplacer le type `Notification` par l'union :

```ts
export type Notification =
  | { kind: 'invitation'; to: string; organizationName: string; inviteUrl: string; expiresAt: Date }
  | { kind: 'email_confirmation'; to: string; confirmUrl: string; expiresAt: Date };
```

(inchangé : `NOTIFICATION_PORT`, `NotificationPort`.)

- [ ] **Step 2: Narrow l'accès dans invitations.spec.ts**

`apps/api/src/application/auth/invitations.spec.ts` — remplacer la ligne `expect(s.notifier.sent[0].inviteUrl).toContain(invitation.token);` par :

```ts
    const sent = s.notifier.sent[0];
    expect(sent.kind === 'invitation' ? sent.inviteUrl : '').toContain(invitation.token);
```

- [ ] **Step 3: Rendu Brevo par kind + test (échoue)**

`apps/api/src/infrastructure/notification/brevo-email-notification-sender.ts` — remplacer la méthode `private render(...)` par un switch :

```ts
  private render(n: Notification): { subject: string; html: string } {
    switch (n.kind) {
      case 'invitation': {
        const subject = `Invitation à rejoindre ${n.organizationName} sur Okko`;
        const html = `<p>Vous êtes invité·e à rejoindre <strong>${this.escapeHtml(n.organizationName)}</strong> sur Okko.</p>`
          + `<p><a href="${this.escapeHtml(n.inviteUrl)}">Accepter l'invitation</a></p>`
          + `<p>Ce lien expire le ${n.expiresAt.toISOString().slice(0, 10)}.</p>`;
        return { subject, html };
      }
      case 'email_confirmation': {
        const subject = 'Confirmez votre inscription sur Okko';
        const html = `<p>Bienvenue sur Okko. Confirmez votre adresse email pour activer votre compte.</p>`
          + `<p><a href="${this.escapeHtml(n.confirmUrl)}">Confirmer mon inscription</a></p>`
          + `<p>Ce lien expire le ${n.expiresAt.toISOString().slice(0, 10)}.</p>`;
        return { subject, html };
      }
    }
  }
```

`apps/api/src/infrastructure/notification/brevo-email-notification-sender.spec.ts` — ajouter un test du cas confirmation. **Reprendre exactement l'idiome de mock `fetch` déjà utilisé dans ce fichier** (le test invitation existant montre la forme correcte du `jest.spyOn(global, 'fetch' ...)` et du cast des `mock.calls`) ; le nouveau test le calque :

```ts
  it('POST Brevo avec le confirmUrl pour une confirmation d’email', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue({ ok: true, status: 201 } as Response);
    const sender = new BrevoEmailNotificationSender();
    await sender.send({ kind: 'email_confirmation', to: 'x@y.z', confirmUrl: 'http://app/confirm/tok', expiresAt: new Date('2026-07-20') });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body as string).toContain('http://app/confirm/tok');
    expect(init.body as string).toContain('Confirmez votre inscription');
  });
```

Run: `cd apps/api && npx jest brevo-email-notification --silent`
Expected: PASS (test invitation existant + nouveau test confirmation).

- [ ] **Step 4: Compilation + tests notification/invitations**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/api && npx jest brevo-email-notification invitations --silent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/application/notification apps/api/src/infrastructure/notification apps/api/src/application/auth/invitations.spec.ts
git commit -m "feat(api): notification email_confirmation + rendu Brevo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: RegisterUseCase — sans auto-login, envoie la confirmation

**Files:**
- Create: `apps/api/src/application/auth/confirmation.ts`
- Modify: `apps/api/src/application/auth/register.use-case.ts`
- Modify: `apps/api/src/application/auth/register.use-case.spec.ts`

**Interfaces:**
- Consumes: `UserRepository` (dont `setConfirmationToken`), `NotificationPort`, `Clock`, `IdGenerator`, `EmailAlreadyUsedError`.
- Produces: `CONFIRM_TTL_HOURS = 24` ; `RegisterUseCase` constructeur `(users, orgs, identities, hasher, notifier, clock, ids)` ; `execute(input): Promise<{ email: string }>`.

- [ ] **Step 1: Constante partagée**

`apps/api/src/application/auth/confirmation.ts` :

```ts
export const CONFIRM_TTL_HOURS = 24;
```

- [ ] **Step 2: Réécrire RegisterUseCase**

`apps/api/src/application/auth/register.use-case.ts` — remplacer tout le fichier :

```ts
import { UserRepository, OrganizationRepository, AuthIdentityRepository } from './repositories';
import { PasswordHasher } from './password-hasher';
import { NotificationPort } from '../notification/notification-port';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { EmailAlreadyUsedError } from './errors';
import { CONFIRM_TTL_HOURS } from './confirmation';
import { User } from './types';

export interface RegisterInput { email: string; password: string; name: string; organizationName: string; }

export class RegisterUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly orgs: OrganizationRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterInput): Promise<{ email: string }> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw new EmailAlreadyUsedError(email);
    const now = new Date(this.clock.nowIso());
    const org = { id: this.ids.next(), name: input.organizationName, createdAt: now };
    await this.orgs.save(org);
    const user: User = { id: this.ids.next(), email, name: input.name, role: 'admin', organizationId: org.id, createdAt: now, emailVerifiedAt: null };
    await this.users.save(user);
    await this.identities.save({ id: this.ids.next(), userId: user.id, provider: 'password', identifier: email, secret: await this.hasher.hash(input.password), createdAt: now });
    const token = this.ids.next();
    const expiresAt = new Date(now.getTime() + CONFIRM_TTL_HOURS * 60 * 60 * 1000);
    await this.users.setConfirmationToken(user.id, token, expiresAt);
    const confirmUrl = `${process.env.INVITE_BASE_URL ?? 'http://localhost:3000'}/confirm/${token}`;
    try { await this.notifier.send({ kind: 'email_confirmation', to: email, confirmUrl, expiresAt }); } catch { /* email non parti — renvoi possible */ }
    return { email };
  }
}
```

- [ ] **Step 3: Réécrire le spec de RegisterUseCase**

`apps/api/src/application/auth/register.use-case.spec.ts` — remplacer tout le fichier (le test de `LoginUseCase` part vers `login.use-case.spec.ts` en Task 5) :

```ts
import { RegisterUseCase } from './register.use-case';
import { InMemoryUserRepository, InMemoryOrganizationRepository, InMemoryAuthIdentityRepository } from './in-memory-repositories';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';
import { EmailAlreadyUsedError } from './errors';

const hasher = { hash: async (p: string) => `h:${p}`, verify: async (p: string, h: string) => h === `h:${p}` };
const clock = { nowIso: () => '2026-07-17T00:00:00Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function makeRegister() {
  const users = new InMemoryUserRepository();
  const orgs = new InMemoryOrganizationRepository();
  const identities = new InMemoryAuthIdentityRepository();
  const notifier = new FakeNotificationSender();
  return { users, orgs, identities, notifier, uc: new RegisterUseCase(users, orgs, identities, hasher, notifier, clock, ids) };
}

describe('RegisterUseCase', () => {
  beforeEach(() => { n = 0; });

  it('crée org + user admin NON confirmé, sans token, et envoie une confirmation', async () => {
    const { users, notifier, uc } = makeRegister();
    const res = await uc.execute({ email: 'A@B.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    expect(res).toEqual({ email: 'a@b.c' });
    expect((res as Record<string, unknown>).token).toBeUndefined();
    const user = await users.findByEmail('a@b.c');
    expect(user?.role).toBe('admin');
    expect(user?.emailVerifiedAt).toBeNull();
    expect(notifier.sent).toHaveLength(1);
    const sent = notifier.sent[0];
    expect(sent.kind).toBe('email_confirmation');
    expect(sent.kind === 'email_confirmation' ? sent.confirmUrl : '').toContain('/confirm/');
  });

  it('email déjà pris → EmailAlreadyUsedError', async () => {
    const { uc } = makeRegister();
    await uc.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    await expect(uc.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop2' })).rejects.toBeInstanceOf(EmailAlreadyUsedError);
  });
});
```

Run: `cd apps/api && npx jest register.use-case --silent`
Expected: PASS (2 tests).

- [ ] **Step 4: Compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur (⚠️ le module DI `auth.module.ts` sera mis à jour en Task 6 ; à ce stade `tsc` reste vert car la factory `RegisterUseCase` est non typée — voir Task 6).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/application/auth/confirmation.ts apps/api/src/application/auth/register.use-case.ts apps/api/src/application/auth/register.use-case.spec.ts
git commit -m "feat(api): register sans auto-login + envoi de la confirmation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Use-cases confirm / resend + gating du login

**Files:**
- Create: `apps/api/src/application/auth/confirm-email.use-case.ts` + `.spec.ts`
- Create: `apps/api/src/application/auth/resend-confirmation.use-case.ts` + `.spec.ts`
- Modify: `apps/api/src/application/auth/login.use-case.ts`
- Create: `apps/api/src/application/auth/login.use-case.spec.ts`

**Interfaces:**
- Consumes: `UserRepository`, `NotificationPort`, `Clock`, `IdGenerator`, `CONFIRM_TTL_HOURS`, erreurs.
- Produces:
  - `ConfirmEmailUseCase.execute({ token }): Promise<{ email: string; alreadyConfirmed: boolean }>`
  - `ResendConfirmationUseCase.execute({ email }): Promise<void>`
  - `LoginUseCase` lève `EmailNotConfirmedError` si non confirmé.

- [ ] **Step 1: ConfirmEmailUseCase**

`apps/api/src/application/auth/confirm-email.use-case.ts` :

```ts
import { UserRepository } from './repositories';
import { Clock } from '../shared/clock';
import { ConfirmationInvalidError } from './errors';

export class ConfirmEmailUseCase {
  constructor(private readonly users: UserRepository, private readonly clock: Clock) {}
  async execute(input: { token: string }): Promise<{ email: string; alreadyConfirmed: boolean }> {
    const found = await this.users.findByConfirmationToken(input.token);
    if (!found) throw new ConfirmationInvalidError();
    if (found.user.emailVerifiedAt) return { email: found.user.email, alreadyConfirmed: true };
    const now = new Date(this.clock.nowIso());
    if (found.expiresAt.getTime() < now.getTime()) throw new ConfirmationInvalidError();
    await this.users.confirmEmail(found.user.id, now);
    return { email: found.user.email, alreadyConfirmed: false };
  }
}
```

- [ ] **Step 2: ResendConfirmationUseCase**

`apps/api/src/application/auth/resend-confirmation.use-case.ts` :

```ts
import { UserRepository } from './repositories';
import { NotificationPort } from '../notification/notification-port';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { CONFIRM_TTL_HOURS } from './confirmation';

export class ResendConfirmationUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}
  async execute(input: { email: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) return; // anti-énumération : aucun effet, aucune fuite
    const now = new Date(this.clock.nowIso());
    const token = this.ids.next();
    const expiresAt = new Date(now.getTime() + CONFIRM_TTL_HOURS * 60 * 60 * 1000);
    await this.users.setConfirmationToken(user.id, token, expiresAt);
    const confirmUrl = `${process.env.INVITE_BASE_URL ?? 'http://localhost:3000'}/confirm/${token}`;
    try { await this.notifier.send({ kind: 'email_confirmation', to: email, confirmUrl, expiresAt }); } catch { /* */ }
  }
}
```

- [ ] **Step 3: Gating du LoginUseCase**

`apps/api/src/application/auth/login.use-case.ts` — ajouter l'import et la vérification. Modifier l'import d'erreurs :

```ts
import { InvalidCredentialsError, EmailNotConfirmedError } from './errors';
```

et, dans `execute`, juste après `if (!user) throw new InvalidCredentialsError();`, ajouter :

```ts
    if (!user.emailVerifiedAt) throw new EmailNotConfirmedError();
```

- [ ] **Step 4: Écrire les specs (échouent)**

`apps/api/src/application/auth/confirm-email.use-case.spec.ts` :

```ts
import { ConfirmEmailUseCase } from './confirm-email.use-case';
import { InMemoryUserRepository } from './in-memory-repositories';
import { ConfirmationInvalidError } from './errors';

const clock = { nowIso: () => '2026-07-17T00:00:00Z' };
const now = new Date(clock.nowIso());

async function seedUnconfirmed(users: InMemoryUserRepository, token: string, expiresAt: Date) {
  await users.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: now, emailVerifiedAt: null });
  await users.setConfirmationToken('u1', token, expiresAt);
}

describe('ConfirmEmailUseCase', () => {
  it('token valide → confirme (emailVerifiedAt posé, token effacé)', async () => {
    const users = new InMemoryUserRepository();
    await seedUnconfirmed(users, 'tok', new Date(now.getTime() + 3600_000));
    const res = await new ConfirmEmailUseCase(users, clock).execute({ token: 'tok' });
    expect(res).toEqual({ email: 'a@b.c', alreadyConfirmed: false });
    expect((await users.findByEmail('a@b.c'))?.emailVerifiedAt).not.toBeNull();
    expect(await users.findByConfirmationToken('tok')).toBeNull();
  });
  it('token inconnu → ConfirmationInvalidError', async () => {
    await expect(new ConfirmEmailUseCase(new InMemoryUserRepository(), clock).execute({ token: 'nope' })).rejects.toBeInstanceOf(ConfirmationInvalidError);
  });
  it('token expiré → ConfirmationInvalidError', async () => {
    const users = new InMemoryUserRepository();
    await seedUnconfirmed(users, 'tok', new Date(now.getTime() - 1000));
    await expect(new ConfirmEmailUseCase(users, clock).execute({ token: 'tok' })).rejects.toBeInstanceOf(ConfirmationInvalidError);
  });
  it('déjà confirmé → alreadyConfirmed (idempotent)', async () => {
    const users = new InMemoryUserRepository();
    await seedUnconfirmed(users, 'tok', new Date(now.getTime() + 3600_000));
    await users.confirmEmail('u1', now);
    // un nouveau token pour retrouver l'utilisateur déjà confirmé
    await users.setConfirmationToken('u1', 'tok2', new Date(now.getTime() + 3600_000));
    const res = await new ConfirmEmailUseCase(users, clock).execute({ token: 'tok2' });
    expect(res.alreadyConfirmed).toBe(true);
  });
});
```

`apps/api/src/application/auth/resend-confirmation.use-case.spec.ts` :

```ts
import { ResendConfirmationUseCase } from './resend-confirmation.use-case';
import { InMemoryUserRepository } from './in-memory-repositories';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';

const clock = { nowIso: () => '2026-07-17T00:00:00Z' };
const now = new Date(clock.nowIso());
let n = 0; const ids = { next: () => `id${++n}` };

describe('ResendConfirmationUseCase', () => {
  beforeEach(() => { n = 0; });

  it('compte non confirmé → nouveau token + notification', async () => {
    const users = new InMemoryUserRepository();
    await users.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: now, emailVerifiedAt: null });
    const notifier = new FakeNotificationSender();
    await new ResendConfirmationUseCase(users, notifier, clock, ids).execute({ email: 'A@B.c' });
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].kind).toBe('email_confirmation');
  });
  it('compte inexistant → aucun effet, aucune notification', async () => {
    const users = new InMemoryUserRepository();
    const notifier = new FakeNotificationSender();
    await new ResendConfirmationUseCase(users, notifier, clock, ids).execute({ email: 'ghost@x.z' });
    expect(notifier.sent).toHaveLength(0);
  });
  it('compte déjà confirmé → aucun effet', async () => {
    const users = new InMemoryUserRepository();
    await users.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: now, emailVerifiedAt: now });
    const notifier = new FakeNotificationSender();
    await new ResendConfirmationUseCase(users, notifier, clock, ids).execute({ email: 'a@b.c' });
    expect(notifier.sent).toHaveLength(0);
  });
});
```

`apps/api/src/application/auth/login.use-case.spec.ts` :

```ts
import { LoginUseCase } from './login.use-case';
import { InMemoryUserRepository, InMemoryAuthIdentityRepository } from './in-memory-repositories';
import { InvalidCredentialsError, EmailNotConfirmedError } from './errors';

const hasher = { hash: async (p: string) => `h:${p}`, verify: async (p: string, h: string) => h === `h:${p}` };
const tokens = { sign: () => 'jwt', verify: () => ({ sub: 'x', email: 'x', role: 'admin' as const, organizationId: null }) };
const now = new Date('2026-07-17T00:00:00Z');

async function seed(emailVerifiedAt: Date | null) {
  const users = new InMemoryUserRepository();
  const identities = new InMemoryAuthIdentityRepository();
  await users.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: now, emailVerifiedAt });
  await identities.save({ id: 'i1', userId: 'u1', provider: 'password', identifier: 'a@b.c', secret: await hasher.hash('pw'), createdAt: now });
  return new LoginUseCase(users, identities, hasher, tokens);
}

describe('LoginUseCase', () => {
  it('compte confirmé → token', async () => {
    const uc = await seed(now);
    expect((await uc.execute({ email: 'a@b.c', password: 'pw' })).token).toBe('jwt');
  });
  it('compte NON confirmé → EmailNotConfirmedError', async () => {
    const uc = await seed(null);
    await expect(uc.execute({ email: 'a@b.c', password: 'pw' })).rejects.toBeInstanceOf(EmailNotConfirmedError);
  });
  it('mauvais mot de passe → InvalidCredentialsError', async () => {
    const uc = await seed(now);
    await expect(uc.execute({ email: 'a@b.c', password: 'bad' })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
```

Run: `cd apps/api && npx jest confirm-email resend-confirmation login.use-case --silent`
Expected: PASS (4 + 3 + 3 tests).

- [ ] **Step 5: Compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/auth/confirm-email.use-case.ts apps/api/src/application/auth/confirm-email.use-case.spec.ts apps/api/src/application/auth/resend-confirmation.use-case.ts apps/api/src/application/auth/resend-confirmation.use-case.spec.ts apps/api/src/application/auth/login.use-case.ts apps/api/src/application/auth/login.use-case.spec.ts
git commit -m "feat(api): use-cases confirm/resend + gating login non confirmé

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Endpoints contrôleur + câblage module + e2e

**Files:**
- Modify: `apps/api/src/presentation/auth/auth.controller.ts`
- Modify: `apps/api/src/auth.module.ts`
- Modify: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `RegisterUseCase` (nouvelle signature), `ConfirmEmailUseCase`, `ResendConfirmationUseCase`, `LoginUseCase` (gating), erreurs.
- Produces: endpoints `/auth/register` (201 `{status,email}`), `/auth/confirm/resend` (202), `/auth/confirm/:token` (200/410), `/auth/login` (403 si non confirmé).

- [ ] **Step 1: Contrôleur — imports + handlers**

`apps/api/src/presentation/auth/auth.controller.ts` :

Dans l'import `@nestjs/common`, ajouter `HttpCode` :

```ts
import { Body, Controller, Get, Param, Post, UseGuards, HttpCode, ConflictException, UnauthorizedException, NotFoundException, GoneException, ForbiddenException } from '@nestjs/common';
```

Ajouter les imports use-cases + erreurs :

```ts
import { ConfirmEmailUseCase } from '../../application/auth/confirm-email.use-case';
import { ResendConfirmationUseCase } from '../../application/auth/resend-confirmation.use-case';
```

et compléter l'import d'erreurs existant avec `EmailNotConfirmedError, ConfirmationInvalidError` :

```ts
import { EmailAlreadyUsedError, InvalidCredentialsError, InvitationNotFoundError, InvitationInvalidError, ForbiddenOrgError, EmailNotConfirmedError, ConfirmationInvalidError } from '../../application/auth/errors';
```

Dans le constructeur, ajouter les 2 use-cases (après `acceptInvitationUC`) :

```ts
    private readonly confirmEmailUC: ConfirmEmailUseCase,
    private readonly resendConfirmationUC: ResendConfirmationUseCase,
```

Remplacer le handler `register` et le handler `login`, et ajouter les 2 handlers de confirmation (⚠️ déclarer `confirm/resend` **avant** `confirm/:token`) :

```ts
  @Public() @Post('register')
  async register(@Body() body: { email: string; password: string; name: string; organizationName: string }) {
    try { const { email } = await this.registerUC.execute(body); return { status: 'confirmation_sent', email }; }
    catch (e) { if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e; }
  }

  @Public() @Post('confirm/resend') @HttpCode(202)
  async resendConfirmation(@Body() body: { email: string }) {
    await this.resendConfirmationUC.execute({ email: body.email });
    return { status: 'sent' };
  }

  @Public() @Post('confirm/:token') @HttpCode(200)
  async confirm(@Param('token') token: string) {
    try { return await this.confirmEmailUC.execute({ token }); }
    catch (e) { if (e instanceof ConfirmationInvalidError) throw new GoneException('lien de confirmation invalide ou expiré'); throw e; }
  }

  @Public() @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try { return await this.loginUC.execute(body); }
    catch (e) {
      if (e instanceof InvalidCredentialsError) throw new UnauthorizedException('identifiants invalides');
      if (e instanceof EmailNotConfirmedError) throw new ForbiddenException('Confirmez votre email avant de vous connecter');
      throw e;
    }
  }
```

- [ ] **Step 2: Module — câblage DI**

`apps/api/src/auth.module.ts` :

Ajouter les imports :

```ts
import { ConfirmEmailUseCase } from './application/auth/confirm-email.use-case';
import { ResendConfirmationUseCase } from './application/auth/resend-confirmation.use-case';
```

Remplacer la factory `RegisterUseCase` (le constructeur prend désormais `notifier` à la place de `tokens`) :

```ts
    { provide: RegisterUseCase, useFactory: (u, o, i, h, n, c, g) => new RegisterUseCase(u, o, i, h, n, c, g), inject: [USER_REPOSITORY, ORGANIZATION_REPOSITORY, AUTH_IDENTITY_REPOSITORY, PASSWORD_HASHER, NOTIFICATION_PORT, CLOCK, UuidIdGenerator] },
```

Ajouter les 2 nouvelles factories (à côté des autres use-cases) :

```ts
    { provide: ConfirmEmailUseCase, useFactory: (u, c) => new ConfirmEmailUseCase(u, c), inject: [USER_REPOSITORY, CLOCK] },
    { provide: ResendConfirmationUseCase, useFactory: (u, n, c, g) => new ResendConfirmationUseCase(u, n, c, g), inject: [USER_REPOSITORY, NOTIFICATION_PORT, CLOCK, UuidIdGenerator] },
```

- [ ] **Step 3: Vérifier la compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Mettre à jour l'e2e (échoue puis passe)**

`apps/api/test/auth.e2e-spec.ts` — remplacer le début du scénario `it('register → login → me ; invite → accept → login editor', ...)`. Le `register` ne renvoie plus de token : il faut confirmer via le token en DB avant de pouvoir se connecter. Remplacer les lignes depuis le `const reg = ...` jusqu'à l'obtention de `adminToken` par :

```ts
    const email = 'admin@coop.bj';
    const reg = await request(app.getHttpServer()).post('/auth/register')
      .send({ email, password: 'pw', name: 'Chef', organizationName: 'Coop' }).expect(201);
    expect(reg.body.status).toBe('confirmation_sent');
    expect(reg.body.token).toBeUndefined();

    // login bloqué tant que non confirmé
    await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'pw' }).expect(403);

    // récupère le token de confirmation en DB et confirme
    const dbUser = await prisma.user.findUnique({ where: { email } });
    await request(app.getHttpServer()).post(`/auth/confirm/${dbUser!.confirmationToken}`).expect(200);

    // confirmation invalide → 410
    await request(app.getHttpServer()).post('/auth/confirm/mauvais-token').expect(410);

    // login OK après confirmation
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'pw' }).expect(201);
    const adminToken = login.body.token;
    expect(login.body.user.role).toBe('admin');
```

Le reste du test (GET /auth/me, invitations, accept, editor 403, 410) reste inchangé : il utilise `adminToken`. (Les invités créés via `accept` sont confirmés d'office — `emailVerifiedAt = now` — donc rien à changer côté acceptation.)

⚠️ La suite e2e **efface la DB** — prévenir avant de la lancer.

Run: `pnpm --filter @okko/api test` (⚠️ efface la DB)
Expected: PASS — toute la suite verte (register/confirm/login gating + non-régression invitations/Base).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/presentation/auth/auth.controller.ts apps/api/src/auth.module.ts apps/api/test/auth.e2e-spec.ts
git commit -m "feat(api): endpoints confirm/resend + register {status,email} + login 403

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Admin — client API + Server Actions

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/lib/auth-actions.ts`
- Modify: `apps/admin/src/lib/auth-actions.test.ts`

**Interfaces:**
- Consumes: `publicFetch`, `jsonInit`, `ApiError`.
- Produces: `apiRegister(): Promise<{ status: string; email: string }>`, `apiConfirmEmail(token)`, `apiResendConfirmation(email)` ; `ActionState` étendu ; `registerAction` (→ `{ ok, email }`), `loginAction` (403 → `needsConfirmation`), `confirmAction(token)`, `resendConfirmationAction`.

- [ ] **Step 1: api.ts — types + appels de confirmation**

`apps/admin/src/lib/api.ts` — remplacer `apiRegister` par (nouveau type de retour) :

```ts
export interface RegisterResult { status: string; email: string; }
export async function apiRegister(input: { organizationName: string; name: string; email: string; password: string }): Promise<RegisterResult> {
  const res = await publicFetch('/auth/register', jsonInit('POST', input));
  return res.json();
}
```

Ajouter, à la suite des fonctions auth :

```ts
export interface ConfirmResult { confirmed: boolean; alreadyConfirmed: boolean; email: string; }
export async function apiConfirmEmail(token: string): Promise<ConfirmResult> {
  const res = await publicFetch(`/auth/confirm/${token}`, { method: 'POST' });
  return res.json();
}
export async function apiResendConfirmation(email: string): Promise<void> {
  await publicFetch('/auth/confirm/resend', jsonInit('POST', { email }));
}
```

- [ ] **Step 2: auth-actions.ts — register/login/confirm/resend**

`apps/admin/src/lib/auth-actions.ts` :

Remplacer le type `ActionState` :

```ts
export type ActionState = { error?: string; ok?: boolean; email?: string; needsConfirmation?: boolean };
```

Mettre à jour les imports d'API :

```ts
import { apiLogin, apiRegister, apiAcceptInvite, apiConfirmEmail, apiResendConfirmation, ApiError } from './api';
```

Remplacer `registerAction` (ne connecte plus ; renvoie `{ ok, email }`) :

```ts
export async function registerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const input = {
    organizationName: String(form.get('organizationName') ?? ''),
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  };
  try {
    const { email } = await apiRegister(input);
    return { ok: true, email };
  } catch (e) {
    return { error: messageFor(e, { 409: 'Cet email est déjà utilisé.' }) };
  }
}
```

Remplacer `loginAction` (403 → besoin de confirmation) :

```ts
export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  try {
    const { token } = await apiLogin(email, password);
    setSession(token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return { error: 'Confirmez votre email avant de vous connecter.', needsConfirmation: true, email };
    return { error: messageFor(e, { 401: 'Identifiants invalides.' }) };
  }
  redirect('/');
}
```

Ajouter à la fin `confirmAction` et `resendConfirmationAction` :

```ts
export type ConfirmState = { status?: 'confirmed' | 'invalid'; email?: string };
export async function confirmAction(token: string, _prev: ConfirmState, _form: FormData): Promise<ConfirmState> {
  try { const r = await apiConfirmEmail(token); return { status: 'confirmed', email: r.email }; }
  catch { return { status: 'invalid' }; }
}

export async function resendConfirmationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get('email') ?? '');
  try { await apiResendConfirmation(email); } catch { /* anti-énumération : ignore */ }
  return { ok: true, email };
}
```

- [ ] **Step 3: Mettre à jour les tests d'actions**

`apps/admin/src/lib/auth-actions.test.ts` — le mock de `./api` doit exposer les nouvelles fonctions. Remplacer la ligne `vi.mock('./api', ...)` par :

```ts
const apiLogin = vi.fn();
const apiRegister = vi.fn();
class ApiError extends Error { constructor(public status: number) { super(String(status)); } }
vi.mock('./api', () => ({
  apiLogin: (...a: unknown[]) => apiLogin(...a),
  apiRegister: (...a: unknown[]) => apiRegister(...a),
  apiAcceptInvite: vi.fn(), apiConfirmEmail: vi.fn(), apiResendConfirmation: vi.fn(), ApiError,
}));
```

(si le fichier utilise `vi.hoisted`, garder ce mécanisme et y déclarer `apiRegister` de la même façon que `apiLogin`.)

Ajouter des tests `registerAction` / `loginAction` (à côté de l'existant) :

```ts
import { loginAction, registerAction } from './auth-actions';

describe('registerAction', () => {
  beforeEach(() => { apiRegister.mockReset(); });
  it('succès → { ok, email }, pas de redirect', async () => {
    apiRegister.mockResolvedValue({ status: 'confirmation_sent', email: 'a@b.c' });
    const res = await registerAction({}, (() => { const f = new FormData(); f.append('email', 'a@b.c'); f.append('password', 'pw'); f.append('name', 'A'); f.append('organizationName', 'Coop'); return f; })());
    expect(res).toEqual({ ok: true, email: 'a@b.c' });
  });
});

describe('loginAction non confirmé', () => {
  beforeEach(() => { apiLogin.mockReset(); });
  it('403 → needsConfirmation', async () => {
    apiLogin.mockRejectedValue(new ApiError(403));
    const f = new FormData(); f.append('email', 'a@b.c'); f.append('password', 'pw');
    const res = await loginAction({}, f);
    expect(res.needsConfirmation).toBe(true);
    expect(res.email).toBe('a@b.c');
  });
});
```

Run: `cd apps/admin && pnpm test auth-actions`
Expected: PASS (tests existants + nouveaux).

- [ ] **Step 4: Compilation**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/lib/auth-actions.ts apps/admin/src/lib/auth-actions.test.ts
git commit -m "feat(admin): actions register(confirm)/login(403)/confirm/resend

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Admin — pages register (email envoyé) / confirm / login + middleware

**Files:**
- Modify: `apps/admin/src/app/register/RegisterForm.tsx`
- Create: `apps/admin/src/components/ResendConfirmation.tsx`
- Modify: `apps/admin/src/app/login/LoginForm.tsx`
- Create: `apps/admin/src/app/confirm/[token]/page.tsx`
- Create: `apps/admin/src/app/confirm/[token]/ConfirmForm.tsx`
- Modify: `apps/admin/src/middleware.ts`
- Modify: `apps/admin/src/components/app-shell.tsx`

**Interfaces:**
- Consumes: `registerAction`/`loginAction`/`confirmAction`/`resendConfirmationAction` + `ActionState`/`ConfirmState` (Task 7).
- Produces: parcours UI complet register→email→confirm→login.

- [ ] **Step 1: Composant de renvoi réutilisable**

`apps/admin/src/components/ResendConfirmation.tsx` :

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { resendConfirmationAction, type ActionState } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" disabled={pending}>{pending ? 'Envoi…' : label}</Button>;
}

/** Si `email` est fourni, il est envoyé en champ caché (bouton simple) ; sinon un champ email est affiché. */
export function ResendConfirmation({ email, label = 'Renvoyer l’email de confirmation' }: { email?: string; label?: string }) {
  const [state, action] = useFormState<ActionState, FormData>(resendConfirmationAction, {});
  return (
    <form action={action} className="space-y-2">
      {email ? <input type="hidden" name="email" value={email} /> : <Input name="email" type="email" placeholder="votre@email" required aria-label="Email" />}
      {state.ok ? <p className="text-sm text-muted-foreground">Si un compte non confirmé existe, un nouvel email a été envoyé.</p> : <SubmitButton label={label} />}
    </form>
  );
}
```

- [ ] **Step 2: RegisterForm — panneau « email envoyé »**

`apps/admin/src/app/register/RegisterForm.tsx` — remplacer tout le fichier :

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { registerAction, type ActionState } from '@/lib/auth-actions';
import { ResendConfirmation } from '@/components/ResendConfirmation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Création…' : 'Créer mon organisation'}</Button>;
}

export function RegisterForm() {
  const [state, action] = useFormState<ActionState, FormData>(registerAction, {});

  if (state.ok) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-3xl">📬</div>
        <p className="text-sm">Un email de confirmation a été envoyé à <strong>{state.email}</strong>. Cliquez le lien qu'il contient pour activer votre compte.</p>
        <div className="pt-2"><ResendConfirmation email={state.email} label="Renvoyer l’email" /></div>
      </div>
    );
  }

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

- [ ] **Step 3: LoginForm — renvoi si non confirmé**

`apps/admin/src/app/login/LoginForm.tsx` — remplacer tout le fichier :

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction, type ActionState } from '@/lib/auth-actions';
import { ResendConfirmation } from '@/components/ResendConfirmation';
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
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <SubmitButton />
      </form>
      {state.needsConfirmation && (
        <div className="rounded-md border p-3">
          <p className="mb-2 text-sm text-muted-foreground">Vous n'avez pas confirmé votre email ?</p>
          <ResendConfirmation email={state.email} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Page /confirm/[token]**

`apps/admin/src/app/confirm/[token]/page.tsx` :

```tsx
import { ConfirmForm } from './ConfirmForm';

export default function ConfirmPage({ params }: { params: { token: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <div className="text-2xl font-extrabold text-primary">🌱 Okko</div>
      <ConfirmForm token={params.token} />
    </main>
  );
}
```

`apps/admin/src/app/confirm/[token]/ConfirmForm.tsx` :

```tsx
'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { confirmAction, type ConfirmState } from '@/lib/auth-actions';
import { ResendConfirmation } from '@/components/ResendConfirmation';
import { Button } from '@/components/ui/button';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Vérification…' : 'Confirmer mon inscription'}</Button>;
}

export function ConfirmForm({ token }: { token: string }) {
  const [state, formAction] = useFormState<ConfirmState, FormData>(confirmAction.bind(null, token), {});

  if (state.status === 'confirmed') {
    return (
      <div className="space-y-4">
        <div className="text-3xl">✅</div>
        <p className="text-sm">Votre compte est confirmé. Vous pouvez maintenant vous connecter.</p>
        <Link href="/login"><Button className="w-full">Se connecter</Button></Link>
      </div>
    );
  }
  if (state.status === 'invalid') {
    return (
      <div className="space-y-4">
        <div className="text-3xl">⚠️</div>
        <p className="text-sm">Ce lien de confirmation est invalide ou expiré.</p>
        <ResendConfirmation label="Recevoir un nouveau lien" />
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">Cliquez pour finaliser votre inscription.</p>
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 5: Middleware + shell — `/confirm/` public**

`apps/admin/src/middleware.ts` — dans `isPublic`, ajouter la branche `/confirm/` :

```ts
function isPublic(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register' || pathname.startsWith('/invite/') || pathname.startsWith('/confirm/');
}
```

`apps/admin/src/components/app-shell.tsx` — dans `isBare`, ajouter `/confirm/` :

```ts
function isBare(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register' || pathname.startsWith('/invite/') || pathname.startsWith('/confirm/') || pathname === '/bientot';
}
```

- [ ] **Step 6: Compilation + build**

Run: `cd apps/admin && pnpm exec tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/admin && pnpm build`
Expected: build réussi ; la route `/confirm/[token]` apparaît ; aucune erreur server-only.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/app/register/RegisterForm.tsx apps/admin/src/components/ResendConfirmation.tsx apps/admin/src/app/login/LoginForm.tsx apps/admin/src/app/confirm apps/admin/src/middleware.ts apps/admin/src/components/app-shell.tsx
git commit -m "feat(admin): page email envoyé + /confirm/[token] + renvoi + login non confirmé

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Vérification finale + documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Suite API (⚠️ efface la DB — prévenir)**

Run: `pnpm --filter @okko/api test`
Expected: PASS — unités auth (register/confirm/resend/login) + e2e (register→confirm→login) + non-régression.

- [ ] **Step 2: Suite admin + build**

Run: `cd apps/admin && pnpm test`
Expected: PASS (jwt, http, api, auth-actions, middleware).

Run: `cd apps/admin && pnpm exec tsc --noEmit && pnpm build`
Expected: clean + build réussi.

- [ ] **Step 3: Re-seed superadmin (confirmé) pour la démo**

Run: `cd apps/api && SUPERADMIN_EMAIL=superadmin@okko.dev SUPERADMIN_PASSWORD=okko-dev npx prisma db seed`
Expected: superadmin créé/présent (avec `emailVerifiedAt` posé → connexion possible).

- [ ] **Step 4: Documenter dans le README**

Dans la section « Admin (dev) » du `README.md`, ajouter que l'inscription passe désormais par une **confirmation d'email** : `/register` crée le compte non confirmé et envoie un email (`/confirm/<token>`) ; la connexion est refusée (403) tant que l'email n'est pas confirmé ; un renvoi est possible depuis la page d'inscription et depuis `/login`. Préciser que les invités (via lien d'invitation) et le superadmin (seed) sont confirmés d'office.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: confirmation d'email à l'inscription (flux admin)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Vérification finale (post-tâches)
- `pnpm --filter @okko/api test` vert (⚠️ efface la DB) ; `cd apps/admin && pnpm test` vert ; `tsc --noEmit` + `pnpm build` OK.
- Smoke manuel : `/register` → panneau « email envoyé » ; récupérer le lien `/confirm/<token>` (log Brevo/stub ou DB) → confirmer → `/login` ; login avant confirmation → message + renvoi ; superadmin seedé se connecte.

## Critères de succès (rappel spec)
- [ ] `User.emailVerifiedAt` + `confirmationToken`/`confirmationExpiresAt` + migration ; token secret confiné à la persistance.
- [ ] Register crée un compte non confirmé, sans JWT, envoie l'email de confirmation.
- [ ] `POST /auth/confirm/:token` confirme (idempotent), 410 si invalide/expiré ; `POST /auth/confirm/resend` anti-énumération (202).
- [ ] Login bloqué (403) tant que non confirmé.
- [ ] Notification `email_confirmation` + rendu Brevo ; stub en test.
- [ ] Admin : page « email envoyé » + renvoi ; `/confirm/[token]` ; message login + renvoi ; middleware public `/confirm/`.
- [ ] Invités & superadmin confirmés d'office (pas de régression login).
- [ ] Suites API + admin vertes ; aucun réseau réel.

## Suite
Durcissements ultérieurs possibles : rate-limiting du renvoi, expiration/renvoi configurables.
