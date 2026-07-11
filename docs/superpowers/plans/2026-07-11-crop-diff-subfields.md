# Diff — sous-champs d'un item modifié (API) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir `diffCropDocuments` : chaque item `changed` d'une section à clé porte désormais `fields: FieldChange[]` (les sous-champs directs qui diffèrent), en conservant `before`/`after`.

**Architecture :** Ajout purement additif à la fonction pure `crop-diff.ts` : un helper `diffObjectFields` (diff des clés directes d'un item via `deepEqual`) branché dans la boucle `changed`. Un niveau de profondeur (valeurs imbriquées reportées entières). `before`/`after` conservés → l'admin D2 reste fonctionnel.

**Tech Stack :** TypeScript + Jest.

## Global Constraints

- **Additif & rétro-compatible** : `ItemChange` gagne `fields` mais garde `key`/`before`/`after`.
- **Un niveau** : `diffObjectFields` compare les clés **directes** de l'item ; une valeur imbriquée (objet/tableau) qui change est reportée **entière** (avant/après), sans descente.
- **Portée** : uniquement le `changed` des **sections à clé** (varieties/zones/croppingWindows/pests/prices). Champs cœur, sections-valeur, added/removed : **inchangés**. Pas de schéma.
- **Tests** : TDD (rouge d'abord). Après la tâche, `npx jest` (dans `apps/api`) **entièrement vert** + `npx tsc --noEmit`.
- Commit `feat(api):`. Terminer le message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Commandes depuis `apps/api` (`cd /Users/scalens_01/Documents/personal-project/okko/apps/api`).

---

## File Structure

**Modifiés :**
- `src/application/crop/crop-diff.ts` — `ItemChange.fields` + `diffObjectFields` + branchement.
- `src/application/crop/crop-diff.spec.ts` — nouveaux tests + complétion de l'assertion « variété modifiée ».

---

## Task 1 : `ItemChange.fields` + `diffObjectFields` (TDD)

**Files:**
- Modify: `src/application/crop/crop-diff.ts`
- Modify: `src/application/crop/crop-diff.spec.ts`

**Interfaces:**
- Produces : `ItemChange { key: string; before: unknown; after: unknown; fields: FieldChange[] }` ; helper module `diffObjectFields(before: unknown, after: unknown): FieldChange[]`.

- [ ] **Step 1 : Écrire les tests qui échouent** — ajouter à `crop-diff.spec.ts`. Réutiliser les helpers `doc()`/`variety()` déjà présents dans ce fichier :
```ts
it('changed d\'un item porte les sous-champs modifiés (un niveau)', () => {
  const d = diffCropDocuments(1, 2,
    doc({ varieties: [variety('X', 120)] }),
    doc({ varieties: [variety('X', 130)] }));
  expect(d.sections[0].changed[0].fields).toEqual([{ field: 'maturityDays', before: 120, after: 130 }]);
  // before/after entiers conservés
  expect(d.sections[0].changed[0].before).toEqual(variety('X', 120));
  expect(d.sections[0].changed[0].after).toEqual(variety('X', 130));
});

it('un champ imbriqué modifié est reporté entier (pas de descente)', () => {
  const vBefore = { id: 'X', cropId: 'c1', name: { fr: 'Obatanpa' }, traits: [] } as any;
  const vAfter = { id: 'X', cropId: 'c1', name: { fr: 'Obatanpa 2' }, traits: [] } as any;
  const d = diffCropDocuments(1, 2, doc({ varieties: [vBefore] }), doc({ varieties: [vAfter] }));
  expect(d.sections[0].changed[0].fields).toEqual([{ field: 'name', before: { fr: 'Obatanpa' }, after: { fr: 'Obatanpa 2' } }]);
});
```
> Lire le haut de `crop-diff.spec.ts` pour la forme exacte de `doc()`/`variety()` (le helper `variety(id, maturityDays?)` existe déjà d'après les tests C3). Adapter si besoin.

- [ ] **Step 2 : Compléter le test existant « variété modifiée ».** Le test C3 « variété modifiée (même id) → changed » asserte `changed: [{ key: 'X', before: variety('X', 120), after: variety('X', 130) }]` — ajouter la clé `fields` :
```ts
    changed: [{ key: 'X', before: variety('X', 120), after: variety('X', 130), fields: [{ field: 'maturityDays', before: 120, after: 130 }] }],
```
(Faire de même pour l'assertion « zone modifiée par zoneId » si elle asserte la forme complète de `changed` : ajouter `fields: [{ field: 'rating', before: '<avant>', after: '<après>' }]` — se laisser guider par le diff Jest.)

- [ ] **Step 3 : Lancer → échoue.**

Run: `npx jest -- crop-diff.spec`
Expected: FAIL (`fields` absent).

- [ ] **Step 4 : Modifier `crop-diff.ts`.**

4a. Étendre l'interface :
```ts
export interface ItemChange { key: string; before: unknown; after: unknown; fields: FieldChange[]; }
```

4b. Ajouter le helper au niveau module (près de `deepEqual`) :
```ts
function diffObjectFields(before: unknown, after: unknown): FieldChange[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const out: FieldChange[] = [];
  for (const k of keys) {
    if (!deepEqual(b[k], a[k])) out.push({ field: k, before: b[k], after: a[k] });
  }
  return out;
}
```

4c. Dans la boucle `changed` des sections à clé, remplacer :
```ts
      if (afterItem !== undefined && !deepEqual(beforeItem, afterItem)) changed.push({ key: k, before: beforeItem, after: afterItem });
```
par :
```ts
      if (afterItem !== undefined && !deepEqual(beforeItem, afterItem)) changed.push({ key: k, before: beforeItem, after: afterItem, fields: diffObjectFields(beforeItem, afterItem) });
```

- [ ] **Step 5 : Lancer → passent.**

Run: `npx jest -- crop-diff.spec`
Expected: PASS.

- [ ] **Step 6 : Suite complète verte + typage.**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS. L'e2e `crop-diff.e2e` reste vert (ajout additif) ; si un cas y asserte la forme de `changed`, le compléter avec `fields`.

- [ ] **Step 7 : Commit**
```bash
git add src/application/crop/crop-diff.ts src/application/crop/crop-diff.spec.ts
git commit -m "feat(api): diff — sous-champs modifiés par item (ItemChange.fields)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Précision** : `changed[].fields` liste les sous-champs directs modifiés ; `before`/`after` entiers conservés (rétro-compat admin D2).
- **Un niveau** : une valeur imbriquée modifiée est reportée entière (pas de chemin `name.fr`).
- **Additif** : champs cœur / sections-valeur / added/removed inchangés ; aucun schéma ; suite verte.
