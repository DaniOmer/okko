# Okko 🌱

**Plateforme d'agriculture de précision (végétale puis animale) pour l'Afrique subsaharienne.**

Okko rassemble en un seul endroit le savoir agronomique actionnable, le suivi de production et le diagnostic assisté par IA, culture par culture — pour rendre l'agriculture de précision accessible à tous les acteurs agricoles, et bâtir la base de connaissances agronomique la plus complète du continent, ouverte à terme via API.

> 📖 Vision complète, spec et plans dans [`docs/`](docs/) :
>
> - [Vision globale](docs/2026-07-02-vision-globale.md) — les 4 modules, l'API, l'IA, le modèle économique (recherche sourcée)
> - [Spec Phase 0](docs/superpowers/specs/2026-07-02-base-connaissances-agronomique-design.md) — base de connaissances + back-office admin
> - [Plan 1](docs/superpowers/plans/2026-07-02-base-connaissances-fondations.md) — fondations + tranche verticale `Crop`

---

## État actuel

**Phase 0 — Base de connaissances + back-office admin : ✅ COMPLÈTE** (Plans 1 à 7).

La fiche culture couvre toutes les catégories agronomiques du spec, saisissables via l'admin et exposées par `GET /crops/:id` (sérialisation **AI-ready** pour le futur chatbot) :

> identité · cycle · variétés · exigences climatiques · exigences édaphiques · zones d'adéquation · phénologie · fenêtres de production (avec itinéraires) · ravageurs & maladies (avec lutte durable) · nutrition · rendement · prix

Transversal : versionnement + **journal d'audit** (avec historique consultable), **provenance** sur les valeurs, **indicateur de complétude** par catégorie, i18n. **136 tests** (unitaires + intégration + e2e). Voir [Roadmap](#roadmap).

---

## Architecture

Monorepo **pnpm** avec deux applications :

```
okko/
├── apps/
│   ├── api/     # Backend NestJS — clean architecture, TDD, Prisma/PostgreSQL
│   └── admin/   # Frontend Next.js — back-office (Tailwind, shadcn-ready)
└── docs/        # Vision, specs, plans
```

Le backend suit une **clean architecture** stricte — les dépendances pointent vers l'intérieur, le domaine n'importe rien d'externe :

```
apps/api/src/
├── domain/          # Cœur métier PUR (zéro dépendance externe)
│   ├── shared/      # Value objects: RangeValue, TranslatableText, Provenance
│   └── crop/        # Agrégat Crop, enums CycleType / CropStatus
├── application/     # Use-cases + ports (interfaces repository) + read-model AI-ready
├── infrastructure/  # Adaptateurs Prisma, PrismaService, SystemClock
└── presentation/    # Contrôleur REST + module NestJS (injection de dépendances)
```

### Concepts clés du modèle de données

- **Trois notions temporelles orthogonales** pour couvrir tous les types de culture sans cas particulier : la **phénologie** (jours, biologie de la plante), les **phases du cycle de vie** (années, pour les pérennes), et les **fenêtres de production** (zone × saison). Une culture annuelle = une pérenne à une seule phase.
- **Versionnement + audit** : chaque fiche a un statut (`DRAFT` / `PUBLISHED` / `ARCHIVED`) et un journal d'audit avec diff old→new.
- **Provenance** sur chaque valeur (saisie experte vs source externe) — prépare l'API et le futur chatbot.
- **AI-ready** : un read-model dénormalisé sérialise chaque fiche pour un LLM (base du futur RAG agronomique).
- **`metadata` JSONB** par catégorie : échappatoire pour les spécificités imprévues, sans migration.

---

## Stack

| Couche          | Techno                                           |
| --------------- | ------------------------------------------------ |
| Base de données | PostgreSQL 16 (colonnes typées + JSONB)          |
| Backend         | NestJS · TypeScript strict · Prisma · Jest (TDD) |
| Frontend        | Next.js 14 · TailwindCSS · shadcn/ui · lucide    |
| Outillage       | pnpm workspaces · Docker Compose                 |

---

## Prérequis

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Docker** (pour PostgreSQL via Docker Compose)

---

## Démarrage

```bash
# 1. Installer les dépendances
pnpm install

# 2. Lancer PostgreSQL
pnpm db:up

# 3. Appliquer les migrations de base de données
pnpm --filter @okko/api prisma:migrate

# 4. Démarrer le backend (port 3001)
pnpm --filter @okko/api start:dev

# 5. Dans un autre terminal, démarrer l'admin (port 3000)
pnpm --filter @okko/admin dev
```

Ouvrir **http://localhost:3000/crops** pour lister et créer des fiches culture.

> La configuration de connexion Postgres vit dans `apps/api/.env` (non versionné). Valeur par défaut :
> `DATABASE_URL="postgresql://okko:okko@localhost:5432/okko?schema=public"`

---

## Tests

```bash
# Toute la suite backend (unitaires + intégration + e2e)
pnpm --filter @okko/api test

# Build de l'admin (type-check des pages)
pnpm --filter @okko/admin build
```

Les tests d'intégration et e2e nécessitent Postgres lancé (`pnpm db:up`).

---

## Authentification (dev)

### Variables d'environnement

| Variable             | Rôle                                              | Valeur par défaut   |
| -------------------- | ------------------------------------------------- | ------------------- |
| `JWT_SECRET`         | Clé de signature des tokens JWT                   | *(obligatoire)*     |
| `JWT_EXPIRES_IN`     | Durée de vie du token (ex. `7d`)                  | `7d`                |
| `BREVO_API_KEY`      | Clé API Brevo pour l'envoi d'e-mails              | *(obligatoire prod)*|
| `BREVO_SENDER`       | Adresse expéditrice des e-mails transactionnels   | *(obligatoire prod)*|
| `INVITE_BASE_URL`    | URL de base pour les liens d'invitation           | *(obligatoire prod)*|
| `SUPERADMIN_EMAIL`   | E-mail du compte superadmin initial               | `superadmin@okko.dev` |
| `SUPERADMIN_PASSWORD`| Mot de passe du compte superadmin initial         | `change-me`         |

### Créer le superadmin

```bash
cd apps/api
SUPERADMIN_EMAIL=superadmin@okko.dev SUPERADMIN_PASSWORD=okko-dev npx prisma db seed
```

La commande est **idempotente** : si un utilisateur avec cet e-mail existe déjà, elle affiche « superadmin déjà présent » et ne crée pas de doublon.

> **Accès** : les endpoints de la base de connaissances (`POST /crops`, etc.) sont réservés aux `superadmin`. Seul `GET /crops/:id/published` reste public (aucun token requis).

---

## Admin (dev)

L'admin exige désormais une connexion. Les écritures Base passent par des **Server Actions** — le navigateur n'appelle jamais l'API directement.

### Démarrage

```bash
# 1. Créer le superadmin (idempotent)
cd apps/api && npx prisma db seed

# 2. Lancer l'admin (port 3000)
cd apps/admin && pnpm dev

# 3. Se connecter sur http://localhost:3000/login
#    superadmin → accès complet (Base de connaissances)
#    admin      → /membres uniquement
```

### Variables d'environnement (`apps/admin/.env`)

Copier `apps/admin/.env.example` et ajuster :

| Variable                 | Rôle                                               | Valeur par défaut         |
| ------------------------ | -------------------------------------------------- | ------------------------- |
| `NEXT_PUBLIC_API_URL`    | URL du backend NestJS                              | `http://localhost:3001`   |
| `SESSION_COOKIE_SECURE`  | Cookie session HTTPS uniquement (`true` en prod)   | `false`                   |

### Flux principaux

- **Création d'organisation** : `/register` (self-service, crée org + compte admin).
- **Inviter un collaborateur** : `/membres` → envoyer une invitation → lien `/invite/<token>` → création du compte → `/bientot` (rôle `editor`).
- **Base de connaissances** : accès réservé au `superadmin` ; toutes les mutations passent par des Server Actions (aucun token JWT exposé au navigateur).

### Prénom + nom (onboarding)

L'inscription (`/register`) et l'acceptation d'une invitation (`/invite/<token>`) demandent désormais **prénom et nom séparément** (`firstName` / `lastName`) — plus aucun champ `name` unique.

La page d'invitation affiche en plus :
- le **nom de l'organisation** à rejoindre (titre de la page) ;
- l'**email pré-rempli et verrouillé** (issu du token d'invitation, non modifiable).

### Confirmation d'email à l'inscription

L'inscription passe désormais par une **confirmation d'email** :

1. `/register` crée le compte non confirmé et envoie un email contenant un lien `/confirm/<token>`.
2. La connexion est refusée (403) tant que l'email n'est pas confirmé — un message invite à confirmer ou à renvoyer l'email.
3. Un **renvoi** de l'email est disponible depuis la page `/register` (panneau « email envoyé ») et depuis `/login`.

> **Exception** : les utilisateurs invités (via le lien `/invite/<token>`) et le superadmin (créé par `prisma db seed`) sont confirmés d'office — leur connexion fonctionne immédiatement sans passer par ce flux.

---

## API (Phase 0)

| Méthode    | Route                                                                                 | Description                                                                             |
| ---------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `POST`     | `/crops` · `GET /crops` · `GET /crops/:id`                                            | Créer / lister / récupérer une fiche (compose toutes les catégories + complétude)       |
| `PATCH`    | `/crops/:id` · `/publish` · `/requirements` · `/phenology` · `/nutrition` · `/yields` | Mettre à jour identité / publier (409) / exigences / phénologie / nutrition / rendement |
| `POST/GET` | `/crops/:id/varieties` · `/windows` · `/prices`                                       | Variétés · fenêtres de production · série de prix                                       |
| `PUT/GET`  | `/crops/:id/zones/:zoneId` · `/pests/:pestId`                                         | Adéquation zone · contrôle ravageur                                                     |
| `GET`      | `/crops/:id/history`                                                                  | Historique d'audit de la fiche                                                          |
| `POST/GET` | `/zones` · `/pests`                                                                   | Catalogues partagés (zones agro-écologiques · ravageurs/maladies)                       |

Toutes les réponses de fiche sont projetées via le read-model `CropDocument` (AI-ready, avec `completeness`).

---

## Scripts utiles (racine)

| Commande                      | Effet                                 |
| ----------------------------- | ------------------------------------- |
| `pnpm db:up` / `pnpm db:down` | Démarrer / arrêter PostgreSQL         |
| `pnpm test`                   | Lancer les tests de tous les packages |

---

## Roadmap

| Phase | Contenu                                           | Statut                      |
| ----- | ------------------------------------------------- | --------------------------- |
| **0** | Base de connaissances + back-office admin (socle) | ✅ **complète** (Plans 1-7) |
| **1** | Carnet de suivi de production (event sourcing)    | ⏳                          |
| **2** | Diagnostic IA (photo → maladie → recommandation)  | ⏳                          |
| **3** | API publique de la base + analytics               | ⏳                          |
| **4** | Module élevage (agriculture animale de précision) | ⏳                          |

**Phase 0 — plans livrés** (chacun testable seul, voir `docs/superpowers/plans/`) :
Plan 1 fondations · Plan 2 variétés + climat/sol · Plan 3 zones agro-écologiques · Plan 4 fenêtres + phénologie + itinéraire · Plan 5 ravageurs/maladies + lutte durable · Plan 6 nutrition + rendement + prix · Plan 7 historique d'audit + complétude.

---

## Principes directeurs

Offline-first · médiation humaine (technicien/coopérative) · une culture à la fois en profondeur · traçabilité des conseils · aucune promesse de rendement non prouvée · lutte durable/agroécologique au cœur · protection des données des agriculteurs.
