# Spec — Complétude & publication (Brique 2 : B1 + B2 + E1)

**Projet** : Okko — API (NestJS) + admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Trois correctifs liés autour de la **maturité de publication** d'une fiche culture :

- **B1** — corriger le pourcentage de complétude affiché en **liste** et **dashboard** (aujourd'hui faux : ~50 % au lieu de la valeur réelle).
- **B2** — **interdire la publication** tant que la fiche n'est pas complète à **100 %** (les 10 catégories).
- **E1** — afficher comme « version » le **numéro de révision publiée** (Brouillon → v1 → v2…), au lieu du compteur d'événements interne.

Référence backlog : `docs/2026-07-11-backlog-retours-usage.md` (§B, §E).

## 2. Contexte (vérifié)

- La complétude compte **10 catégories** (booléens) : `climatic, edaphic, phenology, nutrition, yields, varieties, zones, windows, pests, prices` (`crop-completeness.ts`).
- **Détail** (`GET /crops/:id`) hydrate les 5 sous-collections depuis leurs **projections** (`CropDocumentComposer.compose`) → complétude correcte. **Liste** (`GET /crops`) fait `toCropDocument(s)` **sans** hydrater → 5 catégories toujours `false` → plafond ~50 % (`crop.controller.ts:94`).
- Le **read path** est **projection-based** : `crops.list()`/`findById()` reconstruisent `CropSnapshot` depuis la ligne projetée de la table `Crop` (`prisma-crop.repository.ts` `toSnapshot(row)`), **pas** par rejeu d'événements. La table `Crop` ne stocke pas les sous-collections (tables séparées).
- L'agrégat (write path, `Crop.fromEvents`) **porte** toutes les sections via getters (`crop.ts:132-141`) et tient déjà `_publishedRevision` (0 → +1 à chaque événement `Published`, `crop.ts:82,181`).
- Le compteur interne `version` (`_version += 1` à chaque édition) **n'est utilisé pour aucun contrôle de concurrence** ; il n'est qu'affiché. `PublishedCrop` porte déjà `revision` (1, 2, 3…).
- ⚠️ **La suite de tests API efface la DB de dev** (pas de `.env.test`). Prévenir avant de la lancer ; la DB est actuellement vide.

## 3. Périmètre

### Dans le lot
- **B1** : la liste (`GET /crops`) hydrate chaque fiche via le composer existant → complétude correcte.
- **B2** : garde de complétude à la publication (API) + bouton Publier/Republier désactivé si < 100 % (admin).
- **E1** : exposer `publishedVersion` (API, projection + read model) et l'afficher (admin), « Brouillon » si 0.

### Hors périmètre
- Édition des sous-items → **Brique 3** ; refontes de modèle (fenêtres/rendements/prix) → **D1+** ; vue client → **F1**.
- Modifier le mécanisme interne `_version` (on cesse seulement de l'afficher).
- Optimiser le N+1 de la liste (projection allégée) → différé (YAGNI ; volume admin faible).

### Comportement préservé
- Le **détail** `GET /crops/:id` : inchangé (déjà hydraté).
- Toute la chaîne diff/restore/notes : inchangée.
- Publier une fiche **complète** : comportement actuel (statut, révision, note).

## 4. Architecture — API (couche 1, TDD Jest)

### 4.1 B1 — hydrater la liste
Dans `crop.controller.ts`, `@Get() list()` : au lieu de `toCropDocument(s)`, composer chaque fiche comme le fait le détail :
```ts
@Get()
async list() {
  const snaps = await this.crops.list();
  return Promise.all(snaps.map((s) => this.composer.compose(s.id, s)));
}
```
→ chaque `CropDocument` de la liste porte la complétude correcte (et `publishedVersion`, cf. 4.3). N+1 assumé au volume admin actuel.

### 4.2 B2 — garde de complétude à la publication
- Nouvelle erreur applicative `IncompleteCropError` (porte la liste des catégories manquantes), dans `publish-crop.use-case.ts` (ou un module dédié) :
```ts
export class IncompleteCropError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Crop incomplete: missing ${missing.join(', ')}`);
    this.name = 'IncompleteCropError';
  }
}
```
- Dans `PublishCropUseCase.execute`, **avant** `crop.publish()`, calculer la complétude depuis l'**agrégat** (getters) avec la **même** `computeCompleteness` :
```ts
const report = computeCompleteness({
  climatic: !!crop.climatic, edaphic: !!crop.edaphic,
  phenology: crop.phenology.length > 0, nutrition: crop.nutrition.length > 0,
  yields: crop.yields.length > 0, varieties: crop.varieties.length > 0,
  zones: crop.zones.length > 0, windows: crop.windows.length > 0,
  pests: crop.pests.length > 0, prices: crop.prices.length > 0,
});
if (report.percent < 100) {
  const missing = Object.entries(report.categories).filter(([, v]) => !v).map(([k]) => k);
  throw new IncompleteCropError(missing);
}
```
S'applique à la **1re publication et aux republications** (même chemin). Aucune écriture n'a lieu si l'erreur est levée (garde avant `append`/`save`).
- **Contrôleur** : `mapCropError` mappe `IncompleteCropError` → **422** (`UnprocessableEntityException`) avec le message (catégories manquantes). Le handler `@Post(':id/publish')` route déjà ses erreurs via `mapCropError`.

### 4.3 E1 — exposer `publishedVersion`
Le read path étant projection-based, `publishedVersion` doit être **persisté** sur la projection `Crop`.
1. **Modèle** (`prisma/schema.prisma`) : `model Crop` gagne `publishedVersion Int @default(0)`. Migration additive `add_crop_published_version`.
2. **`CropSnapshot`** (`crop.ts`) gagne `publishedVersion: number`.
3. **`toSnapshot()`** : `publishedVersion: this._publishedRevision`.
4. **`fromSnapshot()`** : inchangé. **Aucun use-case de mutation `Crop` n'utilise `fromSnapshot`** (tous chargent via `Crop.fromEvents` ; `fromSnapshot` ne sert qu'aux agrégats `PestDisease`/`Zone`). Donc `_publishedRevision` est toujours reconstruit correctement par rejeu d'événements avant chaque `toSnapshot()` → **aucun risque d'écraser** `publishedVersion` à 0 lors d'une édition. La valeur affichée provient du snapshot projeté (voir 5).
5. **Repositories** :
   - Prisma (`prisma-crop.repository.ts`) : `save` écrit `publishedVersion: s.publishedVersion` ; `toSnapshot(row)` lit `publishedVersion: row.publishedVersion`.
   - In-memory (`in-memory-crop.repository.ts`) : le record est stocké tel quel → `publishedVersion` porté.
6. **Read model** (`crop-read-model.ts`) : `CropDocument` gagne `publishedVersion: number` (= `s.publishedVersion`). Le document figé composé au moment du publish le porte donc aussi (utile pour la page publiée).

> `publishedVersion` et `PublishedCrop.revision` restent cohérents : le use-case calcule `revision = latest ? latest.revision + 1 : 1` et l'agrégat incrémente `_publishedRevision` sur le même événement `Published`.

## 5. Architecture — Admin (couche 2, barrière build)

### 5.1 B1 — rien à changer
La liste/dashboard lisent déjà `completeness.percent` ; le chiffre devient correct côté API.

### 5.2 B2 — désactiver Publier/Republier si < 100 %
- `lib/api.ts` : `CropDetail`/type liste exposent déjà `completeness` (avec `percent` et `categories`). Ajouter `publishedVersion: number` au type (cf. 5.3).
- `PublishButton.tsx` reçoit un nouveau prop `completeness: { percent: number; categories: Record<string, boolean> }` (déjà présent sur `crop` dans `crops/[id]/page.tsx`).
  - Si `completeness.percent < 100` : **ne pas** rendre `PublishDialog` ; à la place, un bouton **désactivé** « Publier » + un court texte listant les catégories manquantes (libellés FR via la map de libellés existante `@/lib/labels` si une entrée existe, sinon la clé). Cela vaut pour l'état « jamais publiée » **et** l'état « modifications non publiées » (Republier).
  - Si `= 100 %` : comportement actuel (PublishDialog).
- `crops/[id]/page.tsx` passe `completeness={crop.completeness}` à `PublishButton`.
- Défense en profondeur : même si l'utilisateur contournait le bouton, l'API renvoie 422.

### 5.3 E1 — afficher la version publiée
- `lib/api.ts` : `CropDetail` (et le type liste) gagnent `publishedVersion: number`.
- Helper d'affichage (inline) : `publishedVersion === 0 ? 'Brouillon' : \`v${publishedVersion}\``.
- **Détail** `crops/[id]/page.tsx:43` : remplacer `v{crop.version}` par ce libellé.
- **Page publiée** `crops/[id]/published/page.tsx:18` : remplacer `v{crop.version}` par `v{crop.publishedVersion}` (une fiche publiée a `publishedVersion ≥ 1`).
- **Table des versions** `crops/[id]/versions/page.tsx` : la colonne d'identité de version affiche `v{v.revision}` (badge « courante » conservé) ; **renommer son en-tête « Révision » → « Version »** et **retirer la colonne « Version » interne** (`v{v.version}`). `CropVersion.version` peut rester dans le type (non affiché).

## 6. Gestion d'erreur
- **B2** : publier < 100 % → `IncompleteCropError` → **422** avec message ; aucune donnée écrite. À 100 % → publication normale.
- **B1** : hydratation identique au détail ; si une projection renvoie vide, la catégorie compte comme absente (comportement de complétude inchangé).
- **E1** : `publishedVersion` par défaut `0` (migration) → « Brouillon » pour toute fiche jamais publiée.

## 7. Tests (TDD API)
- **`crop-completeness` / read-model** : inchangé (fonction pure déjà testée).
- **Liste (e2e ou use-case)** : une fiche avec les 10 catégories remplies → `GET /crops`[0].completeness.percent === 100 (non-régression du bug ~50 %).
- **Publish use-case** (`publish-crop.spec`) :
  - fiche à 100 % → publie ; `publishedVersion` passe à 1 ; republier après une modification (toujours 100 %) → 2.
  - fiche < 100 % → `IncompleteCropError` avec `missing` non vide ; **aucun** événement `Published` appended, `PublishedCrop` inchangé.
- **e2e publish** : `POST /crops/:id/publish` sur fiche incomplète → **422** ; sur fiche complète → 200 + `GET /crops/:id` `publishedVersion === 1`.
- **Snapshot/projection** : `publishedVersion` survit au save/find (Prisma & in-memory).
- **Non-régression** : les e2e/specs de publication existants restent verts (compléter les fiches de test à 100 % là où ils publient, sinon ils tomberaient sous la nouvelle garde).

## 8. Vérification
- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB de dev — prévenir). Migration appliquée (`prisma migrate dev`).
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke manuel : liste/dashboard affichent la vraie complétude ; bouton Publier grisé + catégories manquantes tant que < 100 % ; « Brouillon » avant publication, « v1 » après, « v2 » après republication ; table des versions sans colonne interne.

## 9. Critères de succès
- [ ] B1 : `GET /crops` renvoie la complétude correcte (hydratée) ; dashboard/liste justes.
- [ ] B2 : publier < 100 % → 422 (`IncompleteCropError`, catégories manquantes) ; aucune écriture ; à 100 % → OK. Bouton admin grisé + message si < 100 %.
- [ ] E1 : `publishedVersion` persisté (migration) + exposé (snapshot, read model) ; admin affiche « Brouillon »/v{n} au détail, page publiée, et la table des versions (en-tête « Version », colonne interne retirée).
- [ ] Suite API verte ; build admin vert.
- [ ] `_version` interne non modifié ; détail API inchangé ; hors-périmètre non touché.

## Références
- Backlog : `docs/2026-07-11-backlog-retours-usage.md` (§B, §E).
- API : `apps/api/prisma/schema.prisma` (`model Crop`), `src/domain/crop/crop.ts` (`CropSnapshot`, `toSnapshot`, `_publishedRevision`), `src/application/crop/{crop-completeness,crop-read-model,compose-crop-document,publish-crop.use-case}.ts`, `src/infrastructure/crop/prisma-crop.repository.ts`, `src/application/crop/in-memory-crop.repository.ts`, `src/presentation/crop/crop.controller.ts` (`list`, `mapCropError`, publish).
- Admin : `src/lib/api.ts`, `src/app/crops/[id]/page.tsx`, `src/app/crops/[id]/editors/PublishButton.tsx`, `src/app/crops/[id]/published/page.tsx`, `src/app/crops/[id]/versions/page.tsx`, `src/lib/labels.ts`.
