# Enrichir les sections existantes de la fiche Culture (léger, sans migration) — Design

**Statut :** validé (brainstorming), prêt pour le plan.

## Objectif

Compléter le **référentiel Culture** en ajoutant les champs manquants aux sections **déjà existantes** stockées en JSON (aucune migration Prisma). Première des deux briques « compléter l'existant » ; la seconde (variétés structurées, symptômes ravageurs/maladies, commercialisation enrichie — qui nécessitent des migrations) suivra. Les médias/documentation (upload de fichiers) sont une brique distincte ultérieure.

## Contexte & architecture

La fiche Culture est **event-sourcée** (`apps/api`, hexagonal) :
- Union d'events dans `src/domain/crop/crop-event.ts` (`CropCreated`, `ClimaticRequirementsSet`, `PhenologySet`, `NutritionSet`, `CroppingWindowAdded`, …).
- Value objects du domaine avec sérialisation JSON : `domain/shared/climatic-requirements.ts` (utilise `RangeValue`), `domain/crop/phenological-stage.ts`, `domain/crop/nutrient-requirement.ts`, `domain/window/technical-operation.ts`.
- Agrégat `Crop` (rejoue les events), projection `compose-crop-document`, use-cases (`update-crop`, `set-crop-requirements`, `set-crop-phenology`, `set-crop-nutrition`, `add/update-window`), DTO API, éditeurs admin (`IdentityEditor`, `RequirementsEditor`, `PhenologyEditor`, `NutritionEditor`, `WindowEditor`), rendu du diff, complétude (`crop-completeness`).
- Sections concernées stockées en **colonnes JSON** sur la table `Crop` (`metadata`, `climatic`, `phenology`, `nutrition`) et dans la table `CroppingWindow` (`operations` JSON) → **aucune migration Prisma**.

**Contrainte clé — évolution d'events rétro-compatible :** les events déjà stockés ne contiennent pas les nouveaux champs. Tous les champs ajoutés sont donc **optionnels** dans les payloads d'events et les value objects ; l'agrégat les traite comme `undefined` par défaut → les anciens events se rejouent sans erreur, les fiches existantes restent valides.

## Périmètre

**Inclus :** ajout de champs à 5 sections existantes (identité, exigences climatiques, calendrier/phénologie, fertilisation, itinéraire technique), de l'event jusqu'à l'éditeur admin + libellés du diff.

**Hors périmètre :**
- Brique « moyen » (suivante) : variétés structurées (résistances/rendement/adaptation), **symptômes** ravageurs/maladies, commercialisation enrichie (produits/formes/débouchés) — nécessitent des migrations de tables.
- Médias/documentation (photos, vidéos, PDF) — brique dédiée (upload/stockage).
- Récolte enrichie, adventices, post-récolte, bonnes pratiques, valeur nutritionnelle — briques ultérieures.
- Pas de nouvelle **catégorie de complétude** (on enrichit des sections déjà comptées).

## Décisions produit (validées)

- Deux briques ; celle-ci = le « léger » (JSON, sans migration).
- Échelles qualitatives faible/moyen(ne)/élevé(e) pour besoin en eau et sensibilité sécheresse.
- `method` (fertilisation) et `usageCategory` (identité) en **select** (code + libellé) ; `equipment` (itinéraire) en **liste de chaînes** (comme `inputs`).
- Convention enum : code technique + table de libellés FR (comme `CYCLE_TYPE_LABELS`).

---

## Section 1 — Champs à ajouter (par section)

**1. Identité** *(event `CropCreated` + l'event d'update d'identité ; use-cases create/update-crop ; `IdentityEditor`)*
- `usageCategory?: string` — catégorie d'usage. Codes : `CEREAL`, `LEGUME`, `VEGETABLE` (maraîchère), `FRUIT`, `TUBER`, `INDUSTRIAL`, `FODDER` (fourragère), `TREE` (arboricole). Table de libellés `USAGE_CATEGORY_LABELS` côté admin. Distinct du `cycleType` (annuel/pérenne) et de `family` (famille botanique).
- `description?: Record<string, string>` — texte de présentation, multilingue (clé `fr`), cohérent avec `commonNames`.

**2. Exigences agroécologiques** *(VO `ClimaticRequirements` + event `ClimaticRequirementsSet` ; `set-crop-requirements` ; `RequirementsEditor`)*
- `altitude?: RangeValue` — plage `{ min, optimal, max, unit }` (unité `m`), en réutilisant le VO `RangeValue` existant (comme température/pluviométrie).
- `waterNeed?: string` — besoin en eau. Codes : `LOW` / `MEDIUM` / `HIGH`.
- `droughtSensitivity?: string` — sensibilité à la sécheresse. Codes : `LOW` / `MEDIUM` / `HIGH`.
- Libellés admin : `WATER_NEED_LABELS`, `DROUGHT_SENSITIVITY_LABELS` (faible/moyen(ne)/élevé(e)).

**3. Calendrier cultural** *(VO `PhenologicalStage` + event `PhenologySet`, par stade ; `set-crop-phenology` ; `PhenologyEditor`)*
- `description?: string` — texte par stade.
- `recommendedWork?: string` — travaux recommandés par stade (texte). *(Champs de note opérationnelle → `string` simple, pas la structure multilingue du catalogue.)*

**4. Fertilisation** *(VO `NutrientRequirement` + event `NutritionSet`, par apport ; `set-crop-nutrition` ; `NutritionEditor`)*
- `method?: string` — méthode d'application. Codes : `BROADCAST` (épandage), `LOCALIZED` (localisé), `FOLIAR` (foliaire), `FERTIGATION` (fertirrigation). Libellés `FERTILIZATION_METHOD_LABELS`.

**5. Itinéraire technique** *(VO `TechnicalOperation` + event `CroppingWindowAdded`, par opération ; `add/update-window` ; `WindowEditor`)*
- `equipment?: string[]` — matériel, liste de chaînes (même forme que `inputs`).

## Section 2 — Approche technique (identique pour les 5)

Pour chaque champ, la chaîne de modification :
1. **Value object** (`domain/**`) : ajouter la propriété optionnelle dans les props + `toJSON()` + la reconstruction depuis JSON.
2. **Event** (`domain/crop/crop-event.ts`) : ajouter le champ optionnel au payload de l'event concerné.
3. **Agrégat `Crop`** : dans l'application de l'event, transmettre le nouveau champ (défaut `undefined` si absent — rétro-compatibilité).
4. **Use-case** (`set-crop-*` / `update-crop` / `add-window`) : accepter le champ optionnel dans l'input et l'inclure dans l'event émis.
5. **Projection** `compose-crop-document` + **DTO** API : exposer le champ.
6. **Admin** : le champ dans l'éditeur correspondant (`@/components/ui/select` pour les enums ; liste éditable pour `equipment` ; textarea pour `description`/`recommendedWork`) + les tables de libellés dans `lib/labels.ts`. `lib/api.ts` : étendre les interfaces (`CropDetail`, `PhenologicalStage`, `NutrientRequirement`, `TechnicalOperation`, la signature de `updateCrop`/`setRequirements`/…).
7. **Diff** : ajouter les libellés des nouveaux champs au rendu du diff (le diff est généré par comparaison de sections ; s'assurer que les nouveaux champs sont nommés lisiblement).

**Aucune migration Prisma** (sections JSON). **Aucune nouvelle catégorie de complétude.** Rétro-compatibilité : champs optionnels partout ; les events et fiches existants restent valides.

## Section 3 — Tests

**API** (Jest, doubles en mémoire, event-sourcing) :
- VO : `toJSON`/reconstruction incluent les nouveaux champs quand présents, et se comportent bien quand absents (rétro-compat).
- Agrégat/projection : un event enrichi (ex. `ClimaticRequirementsSet` avec `altitude`/`waterNeed`) est rejoué et le document composé expose les champs ; un **ancien event sans les champs** se rejoue sans erreur (champs `undefined`).
- Use-cases : `setRequirements`/`setPhenology`/`setNutrition`/`addWindow`/`updateCrop` acceptent et persistent les nouveaux champs.
- Non-régression : la suite crop existante (versions, diff, complétude, publish) reste verte.

**Admin** : validé par `tsc --noEmit` + `pnpm build` (éditeurs) ; pas de test unitaire par éditeur.

**Validation manuelle** : éditer une fiche → renseigner catégorie d'usage, description, altitude/besoin en eau/sensibilité sécheresse, description+travaux par stade, méthode de fertilisation, matériel d'opération → publier → vérifier le diff et l'affichage.

## Critères de succès

- [ ] Les 5 sections exposent leurs nouveaux champs, de l'event à l'éditeur admin.
- [ ] Événements rétro-compatibles : les fiches/events existants se rejouent sans erreur (champs optionnels).
- [ ] Aucune migration Prisma ; aucune nouvelle catégorie de complétude.
- [ ] Enums via code + table de libellés FR ; `equipment` en liste ; `description`/`recommendedWork` en texte.
- [ ] Diff lisible pour les nouveaux champs.
- [ ] Suites API (dont non-régression crop) + admin vertes ; build OK.

## Suite

Brique « moyen » : variétés structurées + symptômes ravageurs/maladies + commercialisation enrichie (migrations). Puis récolte enrichie, post-récolte, adventices, bonnes pratiques, médias.
