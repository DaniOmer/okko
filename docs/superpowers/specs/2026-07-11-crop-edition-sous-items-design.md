# Spec — Édition des sous-items (Brique 3)

**Projet** : Okko — API (NestJS) + admin (Next.js)
**Date** : 2026-07-11
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Permettre de **modifier** un item existant dans les sections d'une fiche culture (aujourd'hui on ne peut qu'ajouter). Sections concernées : **variété, ravageur, nutrition, rendement, phénologie, zone**. Ajoute un affordance « Modifier » par item, ouvrant le même éditeur pré-rempli.

Référence backlog : `docs/2026-07-11-backlog-retours-usage.md` (§C1).

## 2. Contexte (vérifié)

Capacité de mise à jour par section, aujourd'hui :
- **Zone** (`ZoneSuitabilitySet`) : *upsert par clé* (`zoneId`) — re-soumettre avec la même clé remplace. **API prête.**
- **Ravageur** (`PestControlSet`) : *upsert par clé* (`pestId`), mais l'upsert **remplace tout l'enregistrement** et `CropPestView` **n'expose pas** `threshold`/`sensitiveStages` → une édition naïve les écraserait. **Petit ajout API** : les exposer sur la vue (la projection les stocke déjà — simple mapping). L'admin ré-émet aussi `controlMethods` inchangés pour ne pas les perdre.
- **Nutrition** (`NutritionSet`), **rendement** (`YieldsSet`), **phénologie** (`PhenologySet`) : événement « Set » (remplace la liste entière). Éditer = re-soumettre la liste avec l'item modifié. **API prête.**
- **Variété** (`VarietyAdded`) : *append-only*, **pas** d'événement de mise à jour → **nécessite un ajout API**. Chaque variété a un `id` stable.
- **Prix** (`PricePointAdded`, append-only) → reporté à **D5** (plage de dates). **Fenêtre** (append-only) → reporté à **D1** (refonte). **Exclus.**

Côté admin (`crops/[id]/page.tsx`) : chaque section est une Card avec un bouton « + Ajouter » et un `<ul>` d'items. Les éditeurs Set (Nutrition/Yields/Phenology) reçoivent déjà `current` ; les éditeurs upsert (Zone/Pest) reçoivent leur catalogue. Les items exposent : variété→`id`, zone→`zoneId`, ravageur→`pestId`, phéno→`order`/index, nutrition/rendement→index.

⚠️ **La suite de tests API efface la DB de dev** — prévenir avant de la lancer.

## 3. Périmètre

### Dans le lot
- **API** : mise à jour de variété (événement `VarietyUpdated` + `UpdateVarietyUseCase` + endpoint `PUT /crops/:id/varieties/:varietyId` + tests).
- **Admin** : les 6 éditeurs (Variety, PestControl, ZoneSuitability, Nutrition, Yields, Phenology) gagnent un **mode édition** ; `page.tsx` ajoute un bouton « Modifier » par item.

### Hors périmètre
- **Suppression** d'un item (non demandée — YAGNI).
- **Prix** (→ D5), **fenêtre** (→ D1).
- Refontes de modèle (rendement par zone, stades, etc.) → D2/D3/D4.

### Comportement préservé
- L'**ajout** de chaque section : inchangé (mode par défaut des éditeurs).
- Publication/complétude/version : inchangés. Une édition déclenche `hasUnpublishedChanges` comme aujourd'hui.
- Sections prix/fenêtre : inchangées.

## 4. Architecture — API (variété seulement)

### 4.1 Domaine — `apps/api/src/domain/crop/crop.ts`
- Nouvelle méthode : `updateVariety(v: VarietySnapshot): void { this.raise({ type: 'VarietyUpdated', variety: v }); }`.
- `apply`, nouveau cas :
```ts
case 'VarietyUpdated':
  this._varieties = this._varieties.map((x) => (x.id === e.variety.id ? e.variety : x));
  this._hasUnpublishedChanges = true;
  break;
```
- Le type d'événement `VarietyUpdated` (payload `{ variety: VarietySnapshot }`) est ajouté à l'union des `CropEvent`.

### 4.2 Use-case — `apps/api/src/application/crop/update-variety.use-case.ts`
Miroir de `AddVarietyUseCase`, mais met à jour par id :
```ts
async execute(input: { cropId: string; varietyId: string; name: Record<string,string>; maturityDays?: number; yieldPotential?: …; traits?: string[]; actor: string }): Promise<VarietySnapshot> {
  const stored = await this.events.load(input.cropId);
  if (stored.length === 0) throw new CropNotFoundError(input.cropId);
  const crop = Crop.fromEvents(stored);
  if (!crop.varieties.some((v) => v.id === input.varietyId)) throw new VarietyNotFoundError(input.varietyId);
  const variety = Variety.create({ id: input.varietyId, cropId: input.cropId, name: TranslatableText.create(input.name), maturityDays: input.maturityDays, yieldPotential: …, traits: input.traits });
  const snap = variety.toSnapshot();
  crop.updateVariety(snap);
  const at = this.clock.nowIso();
  await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
  await this.varieties.save(snap);   // upsert par id sur la projection
  await this.audit.record({ entityType: 'Variety', entityId: input.varietyId, actor: input.actor, at, changes: { updated: snap } });
  return snap;
}
```
- Nouvelle erreur `VarietyNotFoundError` (id inexistant) → 404 au contrôleur.
- `varieties.save(snap)` : la projection est un upsert par id (vérifier ; sinon utiliser `replaceForCrop`).

### 4.3 Endpoint — `apps/api/src/presentation/crop/crop.controller.ts`
```ts
@Put(':id/varieties/:varietyId')
async updateVariety(@Param('id') id: string, @Param('varietyId') varietyId: string, @Body() body: { name: Record<string,string>; maturityDays?: number; traits?: string[] }) {
  try {
    const snap = await this.updateVarietyUC.execute({ cropId: id, varietyId, ...body, actor: ACTOR });
    return snap;
  } catch (e) { mapCropError(e, id); }
}
```
- `mapCropError` mappe `VarietyNotFoundError` → `NotFoundException`.
- Câblage du provider `UpdateVarietyUseCase` dans le module.

### 4.4 Tests (TDD)
- **update-variety.use-case.spec** : ajouter une variété puis la mettre à jour → la projection porte les nouvelles valeurs, même `id`, une seule variété ; mettre à jour un id absent → `VarietyNotFoundError`.
- **e2e** (`variety-requirements` ou nouveau) : `POST` variété → `PUT /crops/:id/varieties/:vid` → `GET /crops/:id` montre la variété modifiée (même id, count inchangé).
- **Non-régression** : suite API verte.

## 5. Architecture — Admin (6 éditeurs, mode édition)

Patron commun : chaque éditeur accepte des props optionnelles de mode édition. Absentes → **ajout** (comportement actuel). Présentes → **édition** (label `EditorShell` « Modifier », champs pré-remplis, soumission de mise à jour). `page.tsx` rend un bouton « Modifier » compact par item, câblé à l'éditeur en mode édition.

### 5.1 Set-style — `NutritionEditor`, `YieldsEditor`, `PhenologyEditor`
- Nouvelle prop `editIndex?: number`.
- Si présent : `useState` initialisés depuis `current[editIndex]` ; label « Modifier » ; à la soumission `next = current.map((it, i) => i === editIndex ? nouvelItem : it)` puis `PATCH` (endpoint existant).
- Si absent : `next = [...current, nouvelItem]` (actuel).

### 5.2 Upsert — `ZoneSuitabilityEditor`, `PestControlEditor`
- Nouvelle prop `initial?` (l'item existant, incl. sa clé `zoneId`/`pestId`).
- Si présent : label « Modifier » ; le **sélecteur de clé** (zone / ravageur) est **pré-sélectionné et désactivé** ; les autres champs (rating/justification ; susceptibility/threshold/sensitiveStages) pré-remplis ; soumission `PUT` sur la même clé (upsert remplace).
- Si absent : ajout (actuel).

### 5.3 Variété — `VarietyEditor`
- Nouvelle prop `initial?` (`{ id, name, maturityDays?, traits }`).
- Si présent : label « Modifier » ; champs pré-remplis ; soumission `updateVariety(cropId, id, { … })` → `PUT /crops/:id/varieties/:id`.
- Si absent : `addVariety` (`POST`, actuel).
- `lib/api.ts` : nouvelle fonction `updateVariety(cropId, varietyId, body): Promise<void>` (`PUT`).

### 5.4 `page.tsx` — déclencheurs par item
Pour chacune des 6 sections, dans le `.map` des items, rendre à côté du texte un bouton « Modifier » (compact) qui monte l'éditeur en mode édition avec l'item :
- Variété : `<VarietyEditor cropId initial={v} />`
- Zone : `<ZoneSuitabilityEditor cropId zones={zones} initial={z} />`
- Ravageur : `<PestControlEditor cropId pests={pests} initial={p} />`
- Phéno : `<PhenologyEditor cropId current={crop.phenology} editIndex={i} />`
- Nutrition : `<NutritionEditor cropId current={crop.nutrition} editIndex={i} />`
- Rendement : `<YieldsEditor cropId current={crop.yields} editIndex={i} />`

> L'éditeur en mode édition rend son propre déclencheur `EditorShell` (bouton « Modifier »). Le fix « vider les formulaires » (Brique 1) reste valable pour le mode ajout ; en mode édition, la réouverture repré-remplit depuis `initial`/`current[editIndex]` (props), donc pas de reset à vide.

## 6. Gestion d'erreur
- **API** : `PUT` variété sur id/crop inexistant → 404 (`VarietyNotFoundError`/`CropNotFoundError`). Corps invalide → comportement de validation actuel.
- **Admin** : erreurs de soumission affichées via `EditorShell` (comme l'ajout).

## 7. Vérification
- **API** : `pnpm --filter @okko/api test` vert (⚠️ efface la DB — prévenir).
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke manuel : pour chaque section, « Modifier » un item change bien sa valeur ; l'ajout marche toujours ; en édition upsert (zone/ravageur) la clé est verrouillée.

## 8. Critères de succès
- [ ] API : `VarietyUpdated` + `UpdateVarietyUseCase` + `PUT /crops/:id/varieties/:varietyId` + tests ; met à jour par id (même count), 404 si id absent.
- [ ] Admin : les 6 éditeurs ont un mode édition ; `page.tsx` a un « Modifier » par item pour les 6 sections.
- [ ] Upsert (zone/ravageur) : clé verrouillée en édition. Set (nutrition/rendement/phéno) : remplace l'item à l'index. Variété : `PUT` par id.
- [ ] Ajout inchangé ; suppression **non** incluse ; prix/fenêtre inchangés.
- [ ] Suite API verte ; build admin vert.

## Références
- Backlog : `docs/2026-07-11-backlog-retours-usage.md` (§C1).
- API : `src/domain/crop/crop.ts`, `src/application/crop/{add-variety,update-variety}.use-case.ts`, `src/application/crop/variety.repository.ts`, `src/presentation/crop/crop.controller.ts`.
- Admin : `src/lib/api.ts`, `src/app/crops/[id]/page.tsx`, `src/app/crops/[id]/editors/{VarietyEditor,PestControlEditor,ZoneSuitabilityEditor,NutritionEditor,YieldsEditor,PhenologyEditor}.tsx`.
