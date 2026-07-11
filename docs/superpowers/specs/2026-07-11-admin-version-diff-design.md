# Spec — Admin : vue de diff entre versions (Lot C-admin D2)

**Projet** : Okko — admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Rendre utilisable dans l'admin le **diff sémantique entre deux versions publiées** (C3 côté API). Dernière sous-brique du câblage admin du Lot C (après D1 — historique & restauration). Une **page dédiée** `/crops/[id]/diff` avec deux sélecteurs De/À affiche ce qui a changé entre deux révisions : champs cœur modifiés + items ajoutés/supprimés/modifiés par section.

**Contexte technique (vérifié) :**
- L'API a l'endpoint `GET /crops/:id/diff?from=A&to=B` (C3 mergé) → `CropDiff { cropId, from, to, fields: FieldChange[], sections: SectionDiff[] }`.
- `getCropVersions` existe déjà (D1) et sert à peupler les sélecteurs.
- shadcn `Select` disponible (`src/components/ui/select.tsx`).
- L'admin n'a **aucun framework de test** → vérification = `pnpm --filter @okko/admin build` + smoke manuel.

**Décisions (brainstorming 2026-07-11) :**
- **Périmètre = admin seulement** (l'API a tout ; aucun changement back-end).
- **Emplacement** = page dédiée `/crops/[id]/diff` avec deux sélecteurs (révisions arbitraires en query), liée depuis la page des versions.
- **Rendu** = labellé : champs en « libellé : avant → après » ; sections en groupes **Ajoutés/Supprimés/Modifiés** avec libellés d'items ; valeurs complexes/modifiées en bloc compact JSON. (Rendu riche par item = polissage ultérieur, hors périmètre.)

## 2. Périmètre

### Dans le lot
- Types `CropDiff`/`SectionDiff`/`FieldChange`/`ItemChange` + `getCropDiff` (`src/lib/api.ts`).
- Page `/crops/[id]/diff` (Server Component, lit `searchParams`).
- Composant client `VersionSelectors` (deux `Select`, navigation par URL).
- Composant présentiel `CropDiffView` (rendu labellé).
- Lien « Comparer les versions → » depuis `/crops/[id]/versions`.

### Hors périmètre
- **Rendu riche par item** (réutiliser les composants de fiche) → ultérieur.
- **Diff descendant dans les sous-champs** d'un item → dépend d'un raffinement API différé.
- Changement **back-end**.
- Framework de test admin.

## 3. Comportement préservé
- Page des versions (D1) : inchangée hormis l'ajout du lien « Comparer les versions → ».
- Autres pages/endpoints : inchangés ; on **ajoute** une route.

## 4. Architecture

### 4.1 Client API — `src/lib/api.ts`
```ts
export interface FieldChange { field: string; before: unknown; after: unknown; }
export interface ItemChange  { key: string;   before: unknown; after: unknown; }
export interface SectionDiff { section: string; added: unknown[]; removed: unknown[]; changed: ItemChange[]; }
export interface CropDiff {
  cropId: string;
  from: number;
  to: number;
  fields: FieldChange[];
  sections: SectionDiff[];
}

export async function getCropDiff(id: string, from: number, to: number): Promise<CropDiff> {
  // GET /crops/:id/diff?from=${from}&to=${to} ; cache: 'no-store' ; erreurs via readError
}
```

### 4.2 Page de diff — `src/app/crops/[id]/diff/page.tsx` (Server Component)
- Signature `{ params: { id: string }; searchParams: { from?: string; to?: string } }`.
- `const versions = await getCropVersions(params.id).catch(() => []);`
- **Moins de 2 versions** → afficher « Il faut au moins deux versions publiées pour comparer. » (+ lien retour), sans fetch de diff.
- **Défauts** : `to = versions[0].revision` (la plus récente) ; `from = versions[1].revision` (avant-dernière). Les valeurs de `searchParams.from`/`to` (parsées en entier) priment si présentes.
- `const diff = await getCropDiff(params.id, from, to).catch(() => null);` → si `null` (révision invalide), afficher un message d'erreur (+ sélecteurs pour corriger).
- En-tête : lien « ← Retour aux versions » vers `/crops/[id]/versions` + titre « Comparer les versions ».
- Rend `<VersionSelectors cropId={params.id} versions={versions} from={from} to={to} />` puis `<CropDiffView diff={diff} />` (si `diff` non nul).

### 4.3 `VersionSelectors` — `src/app/crops/[id]/diff/VersionSelectors.tsx` (Client Component)
- Props `{ cropId: string; versions: CropVersion[]; from: number; to: number }`.
- Deux `Select` (De / À). Options = `versions` étiquetées `v{revision} — {publishedBy}`, valeur = `revision`.
- Au changement d'un `Select` → `router.push(\`/crops/${cropId}/diff?from=${nextFrom}&to=${nextTo}\`)` (met à jour l'URL ; la page Server recharge le diff).
- Import `CropVersion` depuis le client API.

### 4.4 `CropDiffView` — `src/app/crops/[id]/diff/CropDiffView.tsx` (composant présentiel)
- Props `{ diff: CropDiff }`.
- **Cas vide** : `fields.length === 0 && sections.length === 0` → « Aucune différence entre ces deux versions. »
- **Bloc « Champs modifiés »** — pour chaque `FieldChange` :
  - libellé via `FIELD_LABELS` : `name→Nom`, `scientificName→Nom scientifique`, `family→Famille`, `cycleType→Type de cycle`, `climatic→Exigences climatiques`, `edaphic→Exigences édaphiques`, `metadata→Métadonnées`, `phenology→Phénologie`, `nutrition→Nutrition`, `yields→Rendement` (repli sur la clé brute) ;
  - **scalaire** (`typeof before/after === 'string' | 'number'`) → inline « avant → après » ; **sinon** → deux blocs `<pre className="text-xs …">` (avant / après, `JSON.stringify(v, null, 2)`).
- **Blocs de section** — pour chaque `SectionDiff`, titre via `SECTION_LABELS` (`varieties→Variétés`, `zones→Zones`, `croppingWindows→Fenêtres de production`, `pests→Ravageurs & maladies`, `prices→Prix`) et trois groupes :
  - **Ajoutés** (texte vert, ex. `text-green-700`) : liste de `itemLabel(section, item)` ;
  - **Supprimés** (texte rouge, ex. `text-red-700`) : idem ;
  - **Modifiés** : `itemLabel(section, change.before)` + blocs compacts `<pre>` avant/après.
- **`itemLabel(section, item)`** (lecture défensive, `item as any`) : `varieties`→`name?.fr`, `zones`→`zoneName?.fr`, `pests`→`pestName?.fr`, `prices`→`${market} — ${date}`, `croppingWindows`→`season` ; repli sur `String(item?.id ?? item?.zoneId ?? item?.pestId ?? '?')`.
- `FIELD_LABELS`/`SECTION_LABELS`/`itemLabel` co-localisés dans le composant.

## 5. Gestion d'erreur
- Moins de 2 versions → message dédié, pas de fetch de diff.
- `getCropDiff` en échec (révision inexistante → 404, infra) → `null` → message d'erreur + sélecteurs pour corriger.
- `from == to` → l'API renvoie un diff vide → `CropDiffView` affiche « Aucune différence ».

## 6. Vérification
- `pnpm --filter @okko/admin build` (⇒ typecheck) sans erreur.
- Smoke manuel contre une API vivante :
  - publier une culture, éditer, republier (≥ 2 versions) ;
  - `/crops/[id]/versions` → « Comparer les versions → » → page diff (De/À par défaut avant-dernière → dernière) ;
  - le diff montre le champ changé (`Nom : … → …`) et les items de section ajoutés/supprimés/modifiés ;
  - changer un sélecteur recharge le diff (URL mise à jour) ;
  - sélectionner deux fois la même révision → « Aucune différence ».

## 7. Critères de succès
- [ ] `CropDiff`/`SectionDiff`/`FieldChange`/`ItemChange` + `getCropDiff` dans `api.ts`.
- [ ] Page `/crops/[id]/diff` (searchParams, défauts, < 2 versions géré, erreur gérée).
- [ ] `VersionSelectors` (2 `Select`, navigation par URL).
- [ ] `CropDiffView` (champs labellés + sections Ajoutés/Supprimés/Modifiés + `itemLabel`, cas vide).
- [ ] Lien « Comparer les versions → » depuis la page des versions (si ≥ 2).
- [ ] `next build` vert ; smoke manuel OK.
- [ ] Rendu riche & sous-champs & back-end **non** inclus.

## Références
- API C3 : `docs/superpowers/specs/2026-07-11-crop-version-diff-design.md`.
- Admin D1 : `docs/superpowers/specs/2026-07-11-admin-versions-history-restore-design.md`.
- Code : `src/lib/api.ts` (`getCropVersions`, `CropVersion`, `readError`, `BASE`), `src/app/crops/[id]/versions/page.tsx`, `src/components/ui/select.tsx`.
