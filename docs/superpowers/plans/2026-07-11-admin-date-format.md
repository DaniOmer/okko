# Admin — formatage des dates (polish) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les horodatages de l'admin en français lisible (« 12 juil. 2026 à 14:23 ») via un helper `date-fns` partagé, appliqué à la table des versions et à la carte « Historique ».

**Architecture :** Un helper `formatDateTime(iso)` dans `src/lib/format.ts` (date-fns + locale `fr`, déjà installés), appliqué aux deux affichages de date bruts. Aucun changement back-end.

**Tech Stack :** Next.js 14, TypeScript, `date-fns` (+ `date-fns/locale/fr`).

## Global Constraints

- **Aucun changement back-end** ; consommation de données déjà présentes.
- **Pas de framework de test admin** : barrière de vérif = **`pnpm --filter @okko/admin build`** vert + smoke manuel (à rapporter ; app live non lancée par l'implémenteur).
- **Format** : `d MMM yyyy 'à' HH:mm`, locale `fr`. **Garde-fou** : date invalide → renvoyer la chaîne brute.
- **Réutiliser** `date-fns` (déjà utilisé par `src/components/date-picker.tsx`).
- Copie UI en français. Commit `feat(admin):`. Terminer le message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Commandes depuis la racine du repo `/Users/scalens_01/Documents/personal-project/okko` ; éditions sous `apps/admin/`.

---

## File Structure

**Créés :**
- `apps/admin/src/lib/format.ts` — helper `formatDateTime`.

**Modifiés :**
- `apps/admin/src/app/crops/[id]/versions/page.tsx` — `publishedAt` formaté.
- `apps/admin/src/app/crops/[id]/page.tsx` — `h.at` (carte Historique) formaté.

---

## Task 1 : Helper `formatDateTime` + application aux 2 affichages

**Files:**
- Create: `apps/admin/src/lib/format.ts`
- Modify: `apps/admin/src/app/crops/[id]/versions/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Produces : `formatDateTime(iso: string): string`.

- [ ] **Step 1 : Créer `format.ts`** :
```ts
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return isValid(d) ? format(d, "d MMM yyyy 'à' HH:mm", { locale: fr }) : iso;
}
```

- [ ] **Step 2 : Appliquer dans la table des versions** — dans `apps/admin/src/app/crops/[id]/versions/page.tsx` :
  - ajouter en tête : `import { formatDateTime } from '../../../../lib/format';`
  - remplacer la cellule `<TableCell className="text-muted-foreground">{v.publishedAt}</TableCell>` par `<TableCell className="text-muted-foreground">{formatDateTime(v.publishedAt)}</TableCell>`.

- [ ] **Step 3 : Appliquer dans la carte Historique** — dans `apps/admin/src/app/crops/[id]/page.tsx` :
  - ajouter en tête : `import { formatDateTime } from '../../../lib/format';`
  - dans la carte « Historique », remplacer `{h.at}` par `{formatDateTime(h.at)}` (la ligne `<li key={h.id} className="py-2">{h.at} — {h.actor} — {Object.keys(h.changes).join(', ')}</li>` devient `…>{formatDateTime(h.at)} — {h.actor} — …`).

> Chemins d'import : depuis `versions/page.tsx` (`src/app/crops/[id]/versions/`) → `../../../../lib/format` (4 niveaux) ; depuis `[id]/page.tsx` (`src/app/crops/[id]/`) → `../../../lib/format` (3 niveaux).

- [ ] **Step 4 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (compile + typecheck).

- [ ] **Step 5 : Smoke manuel** (à rapporter, non bloquant). Avec l'API sur `:3001` + `pnpm --filter @okko/admin dev` : la table des versions et la carte « Historique » affichent « 12 juil. 2026 à 14:23 » au lieu de l'ISO brut.

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/lib/format.ts apps/admin/src/app/crops/[id]/versions/page.tsx apps/admin/src/app/crops/[id]/page.tsx
git commit -m "feat(admin): formate les dates (versions + historique) en français lisible

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- Helper unique `formatDateTime` (garde-fou date invalide → chaîne brute).
- Appliqué aux 2 affichages de date bruts (versions + Historique) ; aucun autre changement.
- Zéro back-end ; `pnpm --filter @okko/admin build` vert.
