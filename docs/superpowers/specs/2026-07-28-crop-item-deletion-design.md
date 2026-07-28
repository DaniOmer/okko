# Suppression d'items dans une fiche culture

_Design validé en brainstorming le 2026-07-28._

## Contexte

La fiche culture permet de **créer** et **modifier** ses sous-entités, mais **jamais de les supprimer** :
variétés, notes de zone (aptitude), fenêtres de culture, liens ravageurs (contrôle) et points de prix
peuvent être ajoutés/édités sans aucun moyen de retrait (ni endpoint API, ni méthode domaine, ni UI).
C'est le « gap 6 » de l'audit d'édition de la fiche culture. Cette brique ajoute la suppression pour
les **5 entités**.

`Crop` est un agrégat **event-sourcé**. Ces 5 collections vivent sur l'agrégat via événements
(`VarietyAdded/Updated`, `CroppingWindowAdded/Updated`, `PricePointAdded/Updated`,
`ZoneSuitabilitySet`, `PestControlSet`) **et** dans des projections de lecture séparées
(`VarietyRepository`, `CropPestControlRepository`, `CroppingWindowRepository`, `PricePointRepository`,
`CropZoneSuitabilityRepository`), interrogées par la composition du read-model.

## Décisions actées (brainstorming)

1. **Périmètre : les 5 entités** (variétés, zones, fenêtres, liens ravageurs, prix).
2. **Pattern par entité, calqué sur `add`/`update`** (pas d'événement/endpoint générique, pas de
   soft-delete). L'event-sourcing conserve l'historique dans le journal ; la projection reflète la
   vérité courante (item retiré).
3. **UX : suppression dans la modale d'édition.** Un bouton « Supprimer » (rouge) en bas de l'éditeur
   de chaque item, **en mode édition uniquement** (pas à la création), avec **confirmation inline**
   à deux temps (clic → « Supprimer / Annuler »).
4. **Synchronisation de la projection via `replaceForCrop`** (déjà exposé par les 5 repos et utilisé
   par `rebuildCropProjections`) — pas de nouvelle méthode `delete()` sur les repos.
5. **Intégrité référentielle : rien à gérer.** « Supprimer » retire l'association au niveau de la
   culture (la note de zone, le lien ravageur, une variété/fenêtre/prix), **pas** l'entité globale
   (zone/ravageur restent dans leurs catalogues). Les références croisées (adaptations variété→zone,
   résistances variété→ravageur) pointent vers les entités globales, pas vers ces associations.

## Modèle — domaine (`crop.ts` + `crop-event.ts`)

Cinq nouveaux événements + méthodes de retrait :

| Entité | Méthode domaine | Événement | `apply` (filtre) | Clé |
|---|---|---|---|---|
| Variété | `removeVariety(id)` | `VarietyRemoved { varietyId }` | `_varieties = _varieties.filter(v => v.id !== varietyId)` | `id` |
| Fenêtre | `removeCroppingWindow(id)` | `CroppingWindowRemoved { windowId }` | `_windows.filter(w => w.id !== windowId)` | `id` |
| Prix | `removePricePoint(id)` | `PricePointRemoved { priceId }` | `_prices.filter(p => p.id !== priceId)` | `id` |
| Zone | `removeZoneSuitability(zoneId)` | `ZoneSuitabilityRemoved { zoneId }` | `_zones.filter(z => z.zoneId !== zoneId)` | `zoneId` |
| Ravageur | `removePestControl(pestId)` | `PestControlRemoved { pestId }` | `_pests.filter(p => p.pestId !== pestId)` | `pestId` |

- Chaque `apply` met `_hasUnpublishedChanges = true` (comme les `Added`/`Updated`/`Set`).
- Les **checkpoints** capturent déjà ces 5 collections → `publish`/`discardDraft`/`restoreDraft`
  restent cohérents automatiquement (un retrait est un simple changement d'état).
- Le type union `CropEvent` gagne les 5 variantes.

## Application — 5 `RemoveXUseCase`

Chacun mirroir de l'`UpdateX`/`AddX` correspondant :

1. `events.load(cropId)` ; si vide → `CropNotFoundError`.
2. `Crop.fromEvents(stored)`.
3. **Vérifier l'existence** de l'item (`crop.varieties.some(v => v.id === id)`, etc.) ; sinon lever
   l'erreur `XNotFoundError` de l'entité (réutiliser celle définie dans l'`update-X.use-case`
   existant ; en définir une seulement si aucune n'existe).
4. `crop.removeX(id)`.
5. `events.append(cropId, stored.length, pending.map(e => ({ event: e, actor, at })))`.
6. `crops.save(crop.toSnapshot())`.
7. **`repo.replaceForCrop(cropId, crop.<collection>)`** — resynchronise la projection de lecture sur
   la collection post-retrait (l'item supprimé disparaît). Même primitive que `rebuildCropProjections`.
8. `audit.record({ entityType: <même que add/update>, entityId: id, actor, at, changes: { removed: { id } } })`.

Aucune nouvelle méthode de repository : `replaceForCrop(cropId, items)` existe déjà sur
`VarietyRepository`, `CroppingWindowRepository`, `PricePointRepository`, `CropZoneSuitabilityRepository`,
`CropPestControlRepository`.

## API — 5 endpoints

Sous la garde `superadmin` existante du `CropController` :

- `DELETE /crops/:id/varieties/:varietyId`
- `DELETE /crops/:id/windows/:windowId`
- `DELETE /crops/:id/prices/:priceId`
- `DELETE /crops/:id/zones/:zoneId`
- `DELETE /crops/:id/pests/:pestId`

Chacun : `@HttpCode(204)`, appelle le `RemoveXUseCase`, mappe `XNotFoundError`→404 et
`CropNotFoundError`→404 (via le `mapCropError` existant, complété si besoin). Les use-cases sont câblés
dans `crop.module.ts` (factory + `inject` du store d'événements, du repo de projection concerné, de
l'audit et de l'horloge — mêmes tokens que l'`update-X` correspondant).

## Admin — bouton réutilisable + câblage

**Composant `DeleteWithConfirm`** (nouveau, réutilisable) : un bouton « Supprimer » rouge qui, au clic,
passe en confirmation inline (« Supprimer définitivement ? » + [Annuler] [Supprimer]) ; le second clic
déclenche l'action. Props : `{ onConfirm: () => void; disabled?: boolean }`. Il ne gère ni le busy ni le
refresh (délégués à l'éditeur hôte).

**Câblage** dans les 5 éditeurs, **en mode édition seulement** (`initial` présent) : placé dans le pied
de l'éditeur, à gauche des boutons Annuler/Enregistrer. Au clic confirmé, il appelle
`submit(() => deleteCropX(cropId, itemId))` — le `submit` du render-prop `EditorShell` gère déjà
`busy`, la fermeture et `router.refresh()`. Éditeurs concernés : `VarietyEditor`, `ZoneSuitabilityEditor`,
`WindowEditor`, `PestControlEditor`, `PriceEditor`.

**5 actions** `apps/admin/src/lib/actions.ts` : `deleteCropVariety(cropId, varietyId)`,
`deleteCropWindow(cropId, windowId)`, `deleteCropPrice(cropId, priceId)`,
`deleteCropZone(cropId, zoneId)`, `deleteCropPest(cropId, pestId)` → `authFetch(url, { method: 'DELETE' })`.

## Migration & données

**Aucune migration.** L'agrégat est event-sourcé (nouveaux événements, pas de schéma) ; les projections
sont des tables Prisma existantes resynchronisées par `replaceForCrop` (déjà implémenté). Aucun impact
sur les données existantes.

## Publication & versions

Un retrait est un changement de brouillon : `_hasUnpublishedChanges = true`. Il n'apparaît dans la
version publiée qu'après `publish`. `discardDraft`/`restoreDraft` restaurent l'état depuis les
checkpoints (qui incluent déjà les 5 collections) et `rebuildCropProjections` resynchronise les
projections — donc annuler un brouillon **restaure** un item supprimé, comme attendu.

## Tests (unitaires ciblés uniquement)

Rappel : **jamais** `jest` complet, ni `*.e2e-spec.ts`, ni `*.int-spec.ts` (ils effacent la base de dev).
Uniquement `pnpm --filter @okko/api exec jest <chemin sous src/>`.

- **Domaine** (par entité) : `removeX` retire l'item ciblé, préserve les autres et les autres blocs,
  passe `hasUnpublishedChanges` à `true` ; round-trip via `fromEvents`.
- **Use-case** (par entité) : culture inconnue → `CropNotFoundError` ; item inconnu → `XNotFoundError` ;
  cas nominal → l'item disparaît des events **et** la projection est resynchronisée (`replaceForCrop`
  appelé avec la collection sans l'item) ; audit `removed` enregistré.
- **Admin** : `tsc --noEmit` comme garde ; `DeleteWithConfirm` — test léger optionnel (le clic confirmé
  appelle `onConfirm`).

## Décomposition (le plan aura ~2 phases)

1. **Backend** : 5 événements + méthodes domaine + `apply` (+ specs domaine) ; 5 `RemoveXUseCase`
   (+ specs) ; 5 endpoints `DELETE` + câblage module.
2. **Admin** : `DeleteWithConfirm` + 5 actions + câblage dans les 5 éditeurs (mode édition).

## Hors périmètre

- Suppression des entités **globales** (zone/ravageur des catalogues) — non concernée ici.
- Suppression d'items des sections **remplacées en bloc** (phénologie, nutrition, rendements,
  commercialisation, images) : déjà possible en resoumettant la liste sans l'item — pas de nouvel
  endpoint nécessaire.
- Réordonnancement, corbeille/undo visible côté UI (l'annulation passe par `discardDraft`).
