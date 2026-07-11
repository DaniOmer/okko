# Spec — Admin : formatage des dates (polish)

**Projet** : Okko — admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Afficher les horodatages de l'admin dans un format français lisible (« 12 juil. 2026 à 14:23 ») au lieu des chaînes ISO brutes. Deux endroits sont concernés : la table des versions publiées (`publishedAt`) et la carte « Historique » (AuditLog, `at`).

**Contexte (vérifié) :** `date-fns` (+ locale `fr`) est déjà une dépendance de l'admin (utilisé par `src/components/date-picker.tsx`). Aucun changement back-end.

**Décision (brainstorming 2026-07-11) :** format **date + heure** — `d MMM yyyy 'à' HH:mm` (locale `fr`).

## 2. Périmètre

### Dans le lot
- Helper partagé `formatDateTime(iso)` (`src/lib/format.ts`).
- Application aux 2 affichages de date bruts.

### Hors périmètre
- Autres pistes de polish (diff riche, diff sous-champ, note de publication).
- Changement back-end.
- Framework de test admin.

## 3. Architecture

### 3.1 Helper — `src/lib/format.ts` (nouveau)
```ts
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return isValid(d) ? format(d, "d MMM yyyy 'à' HH:mm", { locale: fr }) : iso;
}
```
- Garde-fou : date invalide → renvoie la chaîne brute (`iso`), pas de crash.

### 3.2 Applications
- `src/app/crops/[id]/versions/page.tsx` : `{v.publishedAt}` → `{formatDateTime(v.publishedAt)}` (import du helper).
- `src/app/crops/[id]/page.tsx` (carte « Historique ») : `{h.at}` → `{formatDateTime(h.at)}` (import du helper).

## 4. Vérification
- `pnpm --filter @okko/admin build` (⇒ typecheck) sans erreur.
- Smoke manuel : les dates s'affichent « 12 juil. 2026 à 14:23 » dans la table des versions et la carte Historique.

## 5. Critères de succès
- [ ] `formatDateTime` (`src/lib/format.ts`) avec garde-fou date invalide.
- [ ] Appliqué aux 2 endroits (versions + Historique).
- [ ] `next build` vert ; smoke manuel OK.
- [ ] Aucun changement back-end ; autres pistes non incluses.

## Références
- `src/components/date-picker.tsx` (usage `date-fns`/`fr` existant), `src/app/crops/[id]/versions/page.tsx`, `src/app/crops/[id]/page.tsx`.
