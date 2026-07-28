# Zone agro-écologique — enrichissement des champs descriptifs (Brique 1)

_Design validé en brainstorming le 2026-07-28._

## Contexte

L'entité `AgroEcologicalZone` est aujourd'hui **minimale** : le domaine stocke `name`, `country`,
`koppen` (texte libre), `altitude`, `annualRainfall`, `notes`, `images`, `metadata` — mais l'admin
n'édite que **4 champs** (nom, pays, koppen, photos). `altitude`, `annualRainfall` et `notes` existent
en base mais sont **morts** (ni saisis ni affichés). La grille métier cible une fiche zone bien plus
riche. Cette brique couvre les **champs descriptifs** ; les relations (cultures adaptées, bioagresseurs
fréquents) feront l'objet d'une **Brique 2** distincte.

`AgroEcologicalZone` est un agrégat **CRUD immuable** (constructeur privé, `create`/`update`/
`fromSnapshot`/`toSnapshot`), comme `Pest`.

## Décisions actées (brainstorming)

1. **Descriptif d'abord** (Brique 1) ; relations = Brique 2 (hors périmètre).
2. **Type de climat = nouveau champ** `climateType` (énum 6 valeurs) **+ `koppen` conservé** en champ
   séparé optionnel « Classification de Köppen ».
3. **Température moyenne = valeur unique** (nombre, °C). Pluviométrie annuelle = plage min/max
   (existante, enfin rendue éditable). **Altitude exposée** (plage min/max, déjà en base).
4. **Refactor du constructeur** : `AgroEcologicalZone` passe d'un constructeur privé **positionnel**
   (9 params) à un constructeur **à objet de props** — ajouter ~12 champs en positionnel donnerait
   ~20 arguments (source d'erreurs). Changement **contenu à `agro-ecological-zone.ts`** : les
   appelants utilisent déjà `create`/`update`/`fromSnapshot` (qui prennent des objets), leurs
   signatures ne changent pas.

## Modèle — champs ajoutés à `ZoneSnapshot`

Identification : `code?`, `region?`, `description?` (`Record<string,string>`, fr). *(`notes` reste
interne, non exposé.)*

Climat : `climateType?` (énum), `koppen?` (conservé), `altitude?` (min/max, existant),
`annualRainfall?` (min/max, existant), `meanTemperature?` (`number`, °C), `meanHumidity?` (`number`, %).

Saisons (codes de mois, cf. `MONTH_LABELS`) : `rainySeasonStart?`, `rainySeasonEnd?`,
`drySeasonStart?`, `drySeasonEnd?`.

Sols : `soilTypes?` (`string[]`, tags libres), `fertility?` (énum), `drainage?` (énum).

Tous **optionnels** (nullable). `update()` est étendu pour piloter l'ensemble de ces champs
descriptifs (aujourd'hui il n'en gère que 4) ; `id`, `notes`, `metadata` sont préservés ; `images`
remplacées seulement si fournies (comportement actuel conservé).

## Énumérations & libellés (admin `labels.ts`)

```ts
CLIMATE_TYPE_LABELS = {
  TROPICAL_HUMID: 'Tropical humide', TROPICAL_DRY: 'Tropical sec', SAHELIAN: 'Sahélien',
  MEDITERRANEAN: 'Méditerranéen', TEMPERATE: 'Tempéré', HIGHLAND: 'Montagnard',
};
FERTILITY_LABELS = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée' };
DRAINAGE_LABELS  = { POOR: 'Faible', MODERATE: 'Modéré', GOOD: 'Bon' };
```
Saisons : réutilisent `MONTH_LABELS` (Select shadcn, valeur vide = non renseigné). Le domaine ne valide
pas ces énumérations (contrainte portée par les Select admin, comme ailleurs).

## Migration & données

Colonnes **additives nullable** sur `AgroEcologicalZone` (Prisma) : `code String?`, `region String?`,
`description Json?`, `climateType String?`, `meanTemperature Float?`, `meanHumidity Float?`,
`rainySeasonStart String?`, `rainySeasonEnd String?`, `drySeasonStart String?`, `drySeasonEnd String?`,
`soilTypes Json?`, `fertility String?`, `drainage String?`. `altitude` et `annualRainfall` existent
déjà. `ADD COLUMN` uniquement → zones existantes préservées. Repo Prisma (`toRow`/`toSnapshot`) lit/écrit
les nouveaux champs.

## API

`CreateZoneUseCase` / `UpdateZoneUseCase` (inputs) et les corps du `ZoneController` (`@Post`/`@Patch`)
acceptent tous les nouveaux champs. Le read-model / DTO zone (`listZones`, détail) les expose. Le
`update-zone` étend son mapping vers le `update()` complet.

## Admin

- `Zone` (api.ts) gagne les nouveaux champs ; `createZone`/`updateZone` (actions) les transmettent.
- **Formulaire de création** (`zones/new`) et **modale d'édition** (`ZoneRowActions`) enrichis, en
  sections : Identification / Climat / Saisons / Sols. Composants shadcn (Select pour
  climat/fertilité/drainage/mois ; `MinMaxRangeInput` pour altitude & pluviométrie ; Input number pour
  température & humidité ; `TagListInput` pour les types de sols). Les modales défilent déjà
  (`max-h-90vh`), donc l'ajout de sections est absorbé.
- **Liste des zones** : badge « type de climat » par ligne (via `CLIMATE_TYPE_LABELS`).
- (Pas de page « fiche zone » dédiée aujourd'hui ; l'édition passe par la modale — inchangé.)

## Tests (unitaires ciblés uniquement)

Rappel : **jamais** `jest` complet ni `*.e2e-spec.ts`/`*.int-spec.ts` (ils effacent la base de dev).

- **Domaine** (`agro-ecological-zone.spec.ts` étendu) : `create` avec tous les nouveaux champs →
  `toSnapshot` les expose ; `update` modifie les champs descriptifs et **préserve** `id`/`notes`/
  `metadata`/`images` ; `fromSnapshot` round-trip complet. Le refactor props-object est couvert par ces
  tests existants + nouveaux.
- **Admin** : `tsc --noEmit` comme garde.

## Décomposition (le plan aura ~2 phases)

1. **Backend** : refactor constructeur props-object + nouveaux champs (`ZoneSnapshot`, `create`,
   `update`, `fromSnapshot`) + specs ; migration + repo ; use-cases create/update + controller + DTO.
2. **Admin** : `Zone` type + actions + libellés ; formulaires création & édition enrichis ; badge liste.

## Hors périmètre

- **Relations** : « cultures adaptées » (vue inverse de `CropZoneSuitability`) et « bioagresseurs
  fréquents » (relation zone↔bioagresseur, inexistante) → **Brique 2**.
- Page fiche zone dédiée (l'édition reste via modale).
- Champ `notes` interne : conservé tel quel, non exposé (la « description » est un champ distinct).
