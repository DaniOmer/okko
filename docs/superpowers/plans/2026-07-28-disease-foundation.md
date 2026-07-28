# Maladies — fondation (kind=DISEASE, Brique 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre une maladie (bioagresseur `kind=DISEASE`) créable, éditable, filtrable et visible, en réutilisant les sections génériques existantes.

**Architecture:** Réutilise l'entité `Pest` via le discriminant `kind` (déjà en place). On ajoute les types de maladie à l'enum `PestType`, l'organe « Collet », et on rend les formulaires/liste/fiche conscients du kind DISEASE. Aucune migration (valeurs d'énum + libellés seulement).

**Tech Stack:** NestJS (domaine), jest (unit), Next.js 14, Tailwind + shadcn, TypeScript.

## Global Constraints

- **NE JAMAIS lancer `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts`** (ils effacent la base de dev). Uniquement specs unitaires ciblées : `pnpm --filter @okko/api exec jest <chemin sous src/>`.
- **Aucune migration** : `PestType` est une colonne texte ; `kind=DISEASE` persiste déjà. On n'ajoute que des valeurs d'énum (domaine) et des libellés (admin).
- Types de maladie : `FUNGUS`, `BACTERIA`, `VIRUS`, `PHYTOPLASMA`, `OOMYCETE`, `DEFICIENCY` (+ `OTHER` réutilisé). Le domaine ne valide pas catégorie×kind (contrainte portée par le Select admin).
- **Périmètre Brique 1** : maladie créable avec les sections génériques + liste/fiche kind-aware (chip « Maladie », icône 🦠, catégorie scopée). **Hors périmètre** (→ Brique 2) : bloc `_disease`, éditeur dédié, +Vent, relibellé des sections (Dégâts→Symptômes), prévention détaillée.
- UI **française**, composants **shadcn**. `npx tsc --noEmit` vert (api ET admin) avant chaque commit. Commit après chaque tâche.

---

### Task 1: Domaine — types de maladie sur `PestType`

**Files:**
- Modify: `apps/api/src/domain/pest/pest-type.ts`
- Test: `apps/api/src/domain/pest/pest-type.spec.ts` (update)

**Interfaces:**
- Produces: `PestType` gagne `FUNGUS`, `BACTERIA`, `VIRUS`, `PHYTOPLASMA`, `OOMYCETE`, `DEFICIENCY`.

- [ ] **Step 1: Update the test (RED)**

The existing `apps/api/src/domain/pest/pest-type.spec.ts` asserts the enum has NO pathogens — that's now wrong. Replace the whole file with:
```ts
import { PestType } from './pest-type';

describe('PestType', () => {
  it('contient les catégories animales, adventices et maladies', () => {
    expect(Object.values(PestType).sort()).toEqual(
      [
        'ANNUAL_BROADLEAF', 'ANNUAL_GRASS', 'BACTERIA', 'BIRD', 'DEFICIENCY', 'FUNGUS',
        'INSECT', 'MAMMAL', 'MITE', 'MOLLUSC', 'NEMATODE', 'OOMYCETE', 'OTHER',
        'PERENNIAL_BROADLEAF', 'PERENNIAL_GRASS', 'PHYTOPLASMA', 'SEDGE', 'VIRUS',
      ].sort(),
    );
    ['FUNGUS', 'BACTERIA', 'VIRUS', 'PHYTOPLASMA', 'OOMYCETE', 'DEFICIENCY'].forEach((t) =>
      expect(Object.values(PestType)).toContain(t),
    );
  });
});
```

- [ ] **Step 2: Run → fail**

`pnpm --filter @okko/api exec jest src/domain/pest/pest-type.spec.ts` → FAIL (enum manque les types maladie).

- [ ] **Step 3: Add disease values**

In `apps/api/src/domain/pest/pest-type.ts`, add before `OTHER = 'OTHER'` :
```ts
  FUNGUS = 'FUNGUS',
  BACTERIA = 'BACTERIA',
  VIRUS = 'VIRUS',
  PHYTOPLASMA = 'PHYTOPLASMA',
  OOMYCETE = 'OOMYCETE',
  DEFICIENCY = 'DEFICIENCY',
```

- [ ] **Step 4: Run → pass**

`pnpm --filter @okko/api exec jest src/domain/pest` → all PASS.

- [ ] **Step 5: Typecheck + commit**
```bash
cd apps/api && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/api/src/domain/pest/pest-type.ts apps/api/src/domain/pest/pest-type.spec.ts
git commit -m "feat(pest): types de maladie sur PestType (champignon/bactérie/virus/phytoplasme/oomycète/carence)"
```

---

### Task 2: Admin — libellés maladie + Collet + formulaires création/édition

**Files:**
- Modify: `apps/admin/src/lib/labels.ts`
- Modify: `apps/admin/src/app/pests/new/page.tsx`
- Modify: `apps/admin/src/app/pests/PestRowActions.tsx`

**Interfaces:**
- Produces: `DISEASE_CATEGORY_LABELS`, `ATTACKED_ORGAN_LABELS` gagne `COLLAR`.
- Consumes (rien d'autres tâches).

- [ ] **Step 1: `labels.ts` — Collet + libellés maladie**

In `apps/admin/src/lib/labels.ts`:

1a. `ATTACKED_ORGAN_LABELS` — insérer `COLLAR: 'Collet'` entre `ROOTS` et `STEMS` :
```ts
export const ATTACKED_ORGAN_LABELS: Record<string, string> = {
  ROOTS: 'Racines', COLLAR: 'Collet', STEMS: 'Tiges', LEAVES: 'Feuilles', FLOWERS: 'Fleurs', FRUITS: 'Fruits', SEEDS: 'Graines',
};
```

1b. Ajouter `DISEASE_CATEGORY_LABELS` (près de `WEED_CATEGORY_LABELS`) :
```ts
export const DISEASE_CATEGORY_LABELS: Record<string, string> = {
  FUNGUS: 'Champignon', BACTERIA: 'Bactérie', VIRUS: 'Virus', PHYTOPLASMA: 'Phytoplasme',
  OOMYCETE: 'Oomycète', DEFICIENCY: 'Carence', OTHER: 'Autre',
};
```

- [ ] **Step 2: `pests/new/page.tsx` — offrir Maladie + scoping 3 voies**

In `apps/admin/src/app/pests/new/page.tsx`:

2a. Import — ajouter `DISEASE_CATEGORY_LABELS` :
```ts
import { PEST_TYPE_LABELS, PEST_PHOTO_CATEGORY_LABELS, WEED_CATEGORY_LABELS, DISEASE_CATEGORY_LABELS } from '@/lib/labels';
```

2b. `categoryLabels` (ligne `const categoryLabels = ...`) → 3 voies :
```ts
  const categoryLabels = kind === 'WEED' ? WEED_CATEGORY_LABELS : kind === 'DISEASE' ? DISEASE_CATEGORY_LABELS : PEST_TYPE_LABELS;
```

2c. `onKindChange` — première catégorie du map scopé (3 voies) :
```ts
  function onKindChange(k: string) {
    setKind(k);
    const map = k === 'WEED' ? WEED_CATEGORY_LABELS : k === 'DISEASE' ? DISEASE_CATEGORY_LABELS : PEST_TYPE_LABELS;
    setType(Object.keys(map)[0]);
  }
```

2d. Select « Type de bioagresseur » — ajouter l'option Maladie (entre Ravageur et Adventice) :
```tsx
                  <SelectItem value="ANIMAL">Ravageur</SelectItem>
                  <SelectItem value="DISEASE">Maladie</SelectItem>
                  <SelectItem value="WEED">Adventice</SelectItem>
```

- [ ] **Step 3: `PestRowActions.tsx` — même chose en édition**

In `apps/admin/src/app/pests/PestRowActions.tsx`:

3a. Import — ajouter `DISEASE_CATEGORY_LABELS` (à la ligne d'import des labels).

3b. `categoryLabels` → 3 voies :
```ts
  const categoryLabels = kind === 'WEED' ? WEED_CATEGORY_LABELS : kind === 'DISEASE' ? DISEASE_CATEGORY_LABELS : PEST_TYPE_LABELS;
```

3c. `onKindChange` → 3 voies :
```ts
  function onKindChange(k: string) {
    setKind(k);
    const map = k === 'WEED' ? WEED_CATEGORY_LABELS : k === 'DISEASE' ? DISEASE_CATEGORY_LABELS : PEST_TYPE_LABELS;
    setType(Object.keys(map)[0]);
  }
```
(Adapter au corps exact de la fonction existante — la seule différence est le `map` à 3 voies puis `setType(Object.keys(map)[0])`.)

3d. Select kind — ajouter l'option Maladie (entre Ravageur et Adventice) :
```tsx
                  <SelectItem value="ANIMAL">Ravageur</SelectItem>
                  <SelectItem value="DISEASE">Maladie</SelectItem>
                  <SelectItem value="WEED">Adventice</SelectItem>
```

- [ ] **Step 4: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/lib/labels.ts apps/admin/src/app/pests/new/page.tsx apps/admin/src/app/pests/PestRowActions.tsx
git commit -m "feat(admin): création/édition maladie (types + Collet) — kind Maladie + catégories scopées"
```

---

### Task 3: Admin — liste (filtre Maladies) + fiche (badge/icône maladie)

**Files:**
- Modify: `apps/admin/src/app/pests/page.tsx`
- Modify: `apps/admin/src/app/pests/[id]/PestFicheView.tsx`

**Interfaces:**
- Consumes: `DISEASE_CATEGORY_LABELS` (Task 2).

- [ ] **Step 1: `pests/page.tsx` — filtre Maladies + catégorie scopée**

In `apps/admin/src/app/pests/page.tsx`:

1a. Import — ajouter `DISEASE_CATEGORY_LABELS` :
```ts
import { labelOf, PEST_TYPE_LABELS, PEST_KIND_LABELS, WEED_CATEGORY_LABELS, DISEASE_CATEGORY_LABELS } from '@/lib/labels';
```

1b. Barre de filtre — ajouter le lien Maladies (entre Ravageurs et Adventices) :
```tsx
        <Link href="/pests?kind=ANIMAL" className={kindFilter === 'ANIMAL' ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Ravageurs</Link>
        <Link href="/pests?kind=DISEASE" className={kindFilter === 'DISEASE' ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Maladies</Link>
        <Link href="/pests?kind=WEED" className={kindFilter === 'WEED' ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Adventices</Link>
```

1c. Cellule catégorie (la ligne `<TableCell>{labelOf(... p.type)}</TableCell>`) → 3 voies :
```tsx
                <TableCell>{labelOf((p.kind ?? 'ANIMAL') === 'WEED' ? WEED_CATEGORY_LABELS : p.kind === 'DISEASE' ? DISEASE_CATEGORY_LABELS : PEST_TYPE_LABELS, p.type)}</TableCell>
```

- [ ] **Step 2: `PestFicheView.tsx` — icône/catégorie maladie au hero**

In `apps/admin/src/app/pests/[id]/PestFicheView.tsx`:

2a. Import `@/lib/labels` — ajouter `DISEASE_CATEGORY_LABELS` à la liste importée.

2b. Après `const isWeed = pest.kind === 'WEED';` (ligne ~16), ajouter :
```ts
  const isDisease = pest.kind === 'DISEASE';
```

2c. `categoryLabel` (ligne ~17) → 3 voies :
```ts
  const categoryLabel = isWeed ? labelOf(WEED_CATEGORY_LABELS, pest.type) : isDisease ? labelOf(DISEASE_CATEGORY_LABELS, pest.type) : labelOf(PEST_TYPE_LABELS, pest.type);
```

2d. Badge catégorie du hero (ligne ~41) — icône 3 voies :
```tsx
              {isWeed ? '🌿' : isDisease ? '🦠' : '🐛'} {categoryLabel}
```
(Le chip kind « Maladie » via `PEST_KIND_LABELS` fonctionne déjà. On ne touche PAS aux libellés de sections — le relibellé Dégâts→Symptômes est en Brique 2.)

- [ ] **Step 3: Typecheck + commit**
```bash
cd apps/admin && npx tsc --noEmit
cd /Users/scalens_01/Documents/personal-project/okko
git add apps/admin/src/app/pests/page.tsx "apps/admin/src/app/pests/[id]/PestFicheView.tsx"
git commit -m "feat(admin): liste filtre Maladies + fiche maladie (badge/icône/catégorie kind-aware)"
```

- [ ] **Step 4: Vérification manuelle**

Démarrer admin + API. `/pests/new` : le Select « Type de bioagresseur » propose Ravageur / **Maladie** / Adventice ; choisir Maladie → les catégories deviennent Champignon/Bactérie/Virus/Phytoplasme/Oomycète/Carence/Autre ; créer une maladie ; elle apparaît en liste avec le badge « Maladie » et sa catégorie. Onglet **Maladies** de la liste → filtre. Ouvrir la fiche → chip « Maladie », icône 🦠, catégorie maladie ; sections génériques (Biologie, Dégâts, Répartition, Gestion, Sources) éditables et affichées (organes atteints propose désormais **Collet**). Vérifier qu'un ravageur/adventice existant reste inchangé.

---

## Notes de fin

- **Aucune migration** ; réutilise l'entité `Pest` (`kind=DISEASE`).
- **Brique 2** (plan suivant) : bloc `_disease` (agent pathogène, mode de propagation, premiers/avancés symptômes, risque de confusion, pertes potentielles, vitesse d'évolution, prévention détaillée), `PestDiseaseEditor`, `+Vent` sur conditions favorables, et rendu de la fiche conscient du kind (Dégâts → « Symptômes », masquages).
- « Carence » incluse comme type (seul type abiotique) — retirable si besoin.
