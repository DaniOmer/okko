# Spec — Module 2 / Brique A « Organisations locataires & accès »

**Date** : 2026-08-04
**Statut** : validé (design), en attente relecture
**Périmètre** : Module 2 (carnet de suivi de production) — fondation d'accès

## Contexte

Okko ouvre son **carnet de suivi de production** (Module 2) à des **organisations clientes**
(entreprises agricoles, coopératives, ONG). Ces orgs s'inscrivent sur la **même app web**
que le back-office Okko, mais avec un accès **strictement cloisonné** : elles utilisent le
suivi de culture de leur tenant et **consultent** les fiches de la Base en lecture seule ;
elles **ne peuvent pas éditer la Base** (créer/modifier/publier cultures, zones, ravageurs),
réservée aux experts Okko.

Cette brique A pose la **fondation d'accès** : type d'organisation, rôles tenant, inscription
d'une org cliente, invitation de membres, et la **frontière de permissions**. Les parcelles
(brique B), le journal (C) et les recommandations (D) viennent ensuite.

### État actuel (audité)

- `register` (`apps/api/src/application/auth/register.use-case.ts`) crée une **Organization**
  + un premier User en rôle **`admin`** (rôle plateforme). Donc aujourd'hui, n'importe quelle
  inscription publique devient admin Okko — la faille que cette brique ferme.
- `Organization` (schema) n'a **pas** de type. `User.role` est une chaîne libre.
- `create-invitation.use-case` fixe le rôle **en dur à `'editor'`** ; l'endpoint
  `POST /auth/invitations` est `@Roles('admin')`.
- Les contrôleurs `crop`/`zone`/`pest`/`media` sont **`@Roles('superadmin')` au niveau
  classe** — la **lecture comme l'écriture** exige `superadmin`. Exposer les fiches aux
  tenants impose donc de **séparer la lecture (publiée) de l'édition**.
- Auth = JWT Bearer ; `RolesGuard` + décorateur `@Roles()` déjà en place.

## Objectifs

1. Distinguer une **org plateforme** (Okko) d'une **org cliente** (`CUSTOMER`).
2. Introduire 4 **rôles tenant** : `ORG_ADMIN`, `AGRONOMIST`, `FIELD_AGENT`, `VIEWER`.
3. Inscription publique → org `CUSTOMER` + créateur `ORG_ADMIN`.
4. Invitation de membres **scopée par `org.kind`** (un `ORG_ADMIN` invite parmi les rôles tenant).
5. **Frontière de permissions** : édition de la Base = rôles plateforme uniquement (bloqué
   serveur) ; fiches **publiées** en lecture ouvertes aux rôles tenant ; toute donnée tenant
   filtrée par `organizationId`.
6. Surface : **une seule app**, navigation et routes gatées par rôle (défense en profondeur :
   masquage UI + blocage serveur).

## Non-objectifs (briques suivantes)

- **Parcelle** (brique B), **Journal** (C), **Recommandations datées** (D).
- Rôle **Agriculteur/Bénéficiaire** en self-service + **surface mobile**.
- Refonte de l'auth (on réutilise register/confirmation/invitation/JWT existants).
- Facturation / plans tarifaires.

## Modèle de données & rôles

### `Organization.kind`

Nouveau champ `kind : 'PLATFORM' | 'CUSTOMER'` (string).
- Migration additive : colonne `kind` (défaut `'CUSTOMER'`) ; **data-step** : passer l'/les
  org(s) existante(s) à `'PLATFORM'` (toutes les orgs actuelles sont celles d'Okko).
- Domaine/type Organization : porter `kind`.

### Rôles — deux ensembles disjoints sur `User.role`

- **Plateforme** (inchangé) : `superadmin` | `admin` | `editor`.
- **Tenant** (nouveau) : `ORG_ADMIN` | `AGRONOMIST` | `FIELD_AGENT` | `VIEWER`.

Constantes centralisées (ex. `apps/api/src/application/auth/roles.ts`) :
`PLATFORM_ROLES`, `TENANT_ROLES`, et un helper `rolesFor(kind)` renvoyant l'ensemble
autorisé selon `org.kind`. Les deux ensembles étant disjoints, un rôle identifie sans
ambiguïté son plan.

### `register` → org cliente

`RegisterUseCase` : créer l'org avec `kind: 'CUSTOMER'` et le premier user en
**`ORG_ADMIN`** (au lieu de `admin`). Flux de confirmation email réutilisé tel quel.

### Invitations scopées

- `CreateInvitationInput` gagne un `role` ; l'endpoint valide que `role ∈ rolesFor(org.kind)`
  (sinon rejet). Fin du `role: 'editor'` codé en dur.
- `POST /auth/invitations` (+ list/revoke) : autoriser aussi **`ORG_ADMIN`** (aujourd'hui
  `@Roles('admin')` seulement), afin qu'un admin d'org cliente invite ses membres. Le listing
  reste **filtré par `organizationId`** de l'invitant.
- `accept-invitation` : le rôle appliqué au nouvel utilisateur vient de `invitation.role`
  (comportement existant conservé).

## Frontière de permissions

**Serveur = source de vérité.**

| Surface | Plateforme | Tenant |
|---|---|---|
| Édition Base (crops/zones/pests **write + publish**, media) | ✅ | ❌ bloqué |
| Consultation fiches (**GET publiées**) | ✅ | ✅ lecture seule, publiées uniquement |
| Membres (inviter/gérer) | son org plateforme | son org `CUSTOMER`, rôles tenant, scopé `organizationId` |
| Suivi (parcelles/journal) | — | placeholder « bientôt » |

- **Séparer lecture/écriture** sur le contrôleur culture : le `@Roles('superadmin')` de classe
  est remplacé par des gardes **par méthode** — écriture/publication → rôles plateforme ;
  un ou des **GET de fiches publiées** ouverts aux rôles tenant (et plateforme). `zone`/`pest`
  restent plateforme-only (les tenants n'ont pas besoin de les lire séparément en brique A ;
  les données zone/ravageur apparaissent via la fiche culture publiée si besoin — sinon
  hors périmètre).
- **Vérifier la sémantique de `RolesGuard`** (rôles listés = exacts vs hiérarchie) et
  l'étendre au besoin pour accepter une **liste** de rôles par endpoint couvrant les deux plans.
- Les tenants ne voient que les crops **publiés** (pas les brouillons Okko) — réutiliser le
  chemin « published » existant.

## Frontend (app admin)

1. **Navigation selon le rôle** : le plan (plateforme vs tenant) se déduit du **rôle seul**
   (`GET /auth/me` le porte déjà ; les deux ensembles étant disjoints, pas besoin d'exposer
   `org.kind` côté front). Home tenant ≠ home Okko.
2. **Espace tenant** :
   - **Fiches** : liste des cultures **publiées** + vues de lecture existantes
     (`CropReadView` / `FicheClientView`), sans éditeurs.
   - **Membres** : réutiliser `/membres`, avec le choix de rôle limité aux **rôles tenant**.
   - **Suivi de culture** : placeholder « bientôt ».
3. **Masquer** les routes/menus d'édition de la Base pour les rôles tenant (blocage serveur
   déjà en place ; le masquage est du confort).

## Tests

- **Use-cases** :
  - `register` crée une org `CUSTOMER` + user `ORG_ADMIN`.
  - `create-invitation` : accepte un rôle tenant pour un invitant d'org `CUSTOMER` ; **rejette**
    un rôle plateforme pour une org `CUSTOMER` (et inversement).
- **Garde/contrôleur** :
  - un utilisateur tenant est **refusé** sur une écriture de la Base (POST/PATCH crop).
  - un utilisateur tenant est **autorisé** sur le GET d'une fiche **publiée**.
- **Type-check** : `tsc --noEmit` vert côté API et admin.

## Points de touche (récap)

**API**
1. `prisma/schema.prisma` — `Organization.kind` + migration (colonne + data-step PLATFORM).
2. Domaine/type Organization — `kind`.
3. `application/auth/roles.ts` (nouveau) — `PLATFORM_ROLES`, `TENANT_ROLES`, `rolesFor(kind)`.
4. `register.use-case.ts` — org `CUSTOMER`, user `ORG_ADMIN`.
5. `create-invitation.use-case.ts` (+ input) & `auth.controller.ts` — rôle paramétré + validé,
   endpoints invitations ouverts à `ORG_ADMIN`, listing scopé `organizationId`.
6. `RolesGuard` / `@Roles` — sémantique multi-rôles / deux plans.
7. `crop.controller.ts` — séparer GET publié (tenant + plateforme) de l'écriture/publication
   (plateforme). `zone`/`pest`/`media` restent plateforme-only.

**Admin**
8. Navigation + home selon le rôle ; exposition de `org.kind`/rôle au client.
9. Espace tenant : fiches publiées (lecture, réutilise les vues), `/membres` scopé, placeholder Suivi.
10. Blocage/masquage des routes d'édition de la Base pour les rôles tenant.

**Tests** : specs `register`, `create-invitation`, garde lecture/écriture ; `tsc` API + admin.

**Sans** : parcelle/journal/reco, agriculteur self-service, mobile, facturation.
