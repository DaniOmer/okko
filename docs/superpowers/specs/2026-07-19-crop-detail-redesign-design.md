# Refonte des vues de détail d'une culture — publiée & aperçu client — Design

**Statut :** validé (brainstorming visuel), prêt pour le plan.

## Objectif

Retravailler les deux vues de lecture d'une fiche Culture pour une lecture agréable et hiérarchisée : l'**aperçu client** (`/crops/[id]/fiche`) devient une page publique soignée style « magazine » ; la **version publiée** (`/crops/[id]/published`) reste dense/admin (tout vérifier d'un coup d'œil), mais avec le même vocabulaire visuel. Aucune modification de l'API ni du modèle de données — refonte purement présentation (React/Tailwind/shadcn).

## Contexte & existant

- Deux composants React côté admin, alimentés par le même DTO `CropDetail` (`getCropPublished`) :
  - `apps/admin/src/app/crops/[id]/CropReadView.tsx` — version publiée, aujourd'hui grille de `Card` 2 colonnes, sections en **listes à puces** brutes.
  - `apps/admin/src/app/crops/[id]/FicheClientView.tsx` — aperçu client, colonne unique de sections `h2 + puces`.
  - Pages serveur : `published/page.tsx` (bandeau ambre « version figée » + `CropReadView`) et `fiche/page.tsx` (en-tête + `FicheClientView`).
- Le DTO `CropDetail` porte déjà tout le nécessaire : identité (`usageCategory?`, `description?.fr`), `climatic` (`temperature?/rainfall?/altitude?` en `{min,optimal,max,unit}`, `waterNeed?`, `droughtSensitivity?`), `edaphic` (`ph?`, `texture?`), `varieties` (`diseaseResistances?[{pestId,level}]`, `zoneAdaptations?[{zoneId,rating}]`, `maturityDays?`, `traits[]`), `zones` (`zoneName.fr`, `rating`, `justification`), `phenology` (`name.fr`, `startDay`, `endDay`, `order`), `croppingWindows` (`season`, `sowingStart?/sowingEnd?`, `irrigationRequired`, `operations[{type,label.fr,timingDays,inputs[],equipment?[]}]`), `pests` (`pestName.fr`, `susceptibility`, `type`, `controlMethods[{category,description.fr}]`, `sensitiveStages[]`), `nutrition` (`nutrient`, `amount`, `unit`, `basis`, `stage?`), `yields` (`inputType`, `min/average/potential`, `unit`, `zoneId?`), `prices` (`form`, `price`, `currency`, `unit`, `market`, `periodStart/End`), `commercialization` (`form`, `saleUnits[]`, `outlets[]`).
- Maps de libellés FR existantes réutilisées (`lib/labels.ts`) + helper `labelOf(map, code)`. Icônes : `lucide-react` (déjà dépendance).

## Décisions (validées en brainstorming)

- **Deux designs distincts** : publiée = dense/vérification ; client = page soignée.
- **Toutes les sections affichées** dans les deux vues ; une section vide affiche **« Non renseigné »**.
- **Aperçu client = « Fiche magazine »** : colonne unique centrée (~780px), grand en-tête, **nav en pilules collante**, sections espacées avec icône + titre et composants riches.
- **Version publiée = grille de cartes dense** (2 colonnes), bandeau « version figée », **bande de complétude** (11 segments verts/gris) en tête.
- **Palette « Vert classique raffiné »** (ci-dessous). Code sémantique **favorable/marginal/défavorable = vert/ambre/rouge** partout.

## Système visuel

**Jetons de couleur** (palette retenue) — à exposer en helper, sans toucher le thème global shadcn :

| Rôle | Texte | Fond |
|---|---|---|
| primaire (vert) | `#245c27` | `#eaf3ea` |
| good (favorable / résistance élevée / peu sensible) | `#245c27` | `#eaf3ea` |
| warn (marginal / moyen) | `#b45309` | `#fef3e2` |
| bad (défavorable / peu résistant / très sensible) | `#b91c1c` | `#fdecec` |
| neutral | `#475569` | `#eef1f4` |
| encre / atténué / filet | `#1f2937` / `#6b7280` / `#e6e8eb` | — |
| marqueur semis (frise) | ambre `#b45309` | — |

**Sémantique couleur (attention : résistance et sensibilité sont inversées)** — helper `tone(kind, code)` → `'good' | 'warn' | 'bad' | 'neutral'` :
- `suitability` : `SUITABLE`→good, `MARGINAL`→warn, `UNSUITABLE`→bad.
- `susceptibility` : `LOW`→good, `MEDIUM`→warn, `HIGH`→bad.  *(peu sensible = bon)*
- `resistance` : `HIGH`→good, `MEDIUM`→warn, `LOW`→bad.  *(très résistant = bon)*
- inconnu → neutral.

**Composants de présentation partagés** (nouveaux, réutilisés par les deux vues) :
- `tone(kind, code)` + `TONE_CLASS: Record<tone, string>` (classes Tailwind avec les hex ci-dessus) — fonctions pures, testables.
- `ToneBadge({ tone, children })` — puce colorée (résistances, sensibilité, aptitude).
- `RangeBar({ label, min, optimal, max, unit })` — barre horizontale avec dégradé, point vert positionné à l'optimal (`left = (optimal-min)/(max-min)`), bornes min/optimal/max sous la barre. Si la plage est absente → ne pas rendre la barre.
- `Timeline({ steps })` — frise horizontale ; `steps = {j, label, tone?, marker?}[]` ; le point « semis » (J0) est ambré et plus gros. Réutilisée par Phénologie et Itinéraire technique.
- `sectionIcon(key)` — renvoie l'icône lucide de la section (voir table).
- Ces composants vivent dans `apps/admin/src/components/fiche/` (helpers dans `fiche-ui.ts`, composants React dans le même dossier) ; les deux vues restent à leur emplacement actuel. Les **conteneurs de section diffèrent** entre les deux vues (bloc magazine vs carte).

**Icônes lucide par section :** Exigences climatiques → `Thermometer` ; Édaphiques → `Mountain` ; Variétés → `Sprout` ; Zones → `MapPin` ; Phénologie → `Activity` ; Calendrier & itinéraire → `CalendarDays` ; Ravageurs & maladies → `Bug` ; Nutrition → `FlaskConical` ; Rendement → `Wheat` ; Prix → `Coins` ; Commercialisation → `ShoppingCart`.

## Résolution des noms (référentiels)

Les résistances de variété portent un `pestId` et les adaptations un `zoneId` (codes, pas de noms). Les pages serveur `fiche/page.tsx` et `published/page.tsx` chargent les référentiels et passent des maps `id→nom` aux vues :
- **pests** : charger la liste des bioagresseurs (endpoint `/pests`, comme les éditeurs) → `Map<pestId, nom.fr>` ; repli sur le `pestId` brut si absent.
- **zones** : résoudre d'abord via `crop.zones` (déjà `zoneName.fr` par `zoneId`) ; repli sur une map zones référentiel si le zone n'est pas rattaché à la culture, sinon l'`id` brut.
- Les `yields[].zoneId` continuent de se résoudre via `crop.zones` (comportement actuel conservé).

## Section 1 — Aperçu client (« Fiche magazine »)

Page `fiche/page.tsx` : conteneur centré `max-w-3xl`. `FicheClientView` réécrit :
- **En-tête (hero)** : barre d'accent verte à gauche ; `crop.name` (grand) + `scientificName` en italique atténué ; paragraphe `description.fr` si présent ; rangée de badges : `family`, `labelOf(CYCLE_TYPE_LABELS, cycleType)`, `labelOf(USAGE_CATEGORY_LABELS, usageCategory)` si présent, `v{publishedVersion} · publiée`.
- **Nav pilules collante** (`sticky top-0`) : une pilule par section, ancres `#exigences`, `#varietes`, … (défilement doux). La pilule active peut rester statique (mise en évidence au scroll = bonus, non requis).
- **Sections** (icône + titre + compteur) dans cet ordre : Exigences agroécologiques, Variétés, Zones, Phénologie, Calendrier & itinéraire, Ravageurs & maladies, Nutrition, Rendement, Prix, Commercialisation. Traitements :
  - **Exigences** : `RangeBar` pour température / pluviométrie / altitude / pH (celles présentes) ; badges qualitatifs `Besoin en eau` / `Sensibilité sécheresse` (via WATER_NEED/DROUGHT labels). Texture en ligne.
  - **Variétés** : une carte par variété — nom + `maturityDays` ; `ToneBadge` par résistance (`<nom maladie> · <niveau>`, tone=resistance) ; `ToneBadge` par adaptation (`<zone> · <aptitude>`, tone=suitability) ; `traits` en petites puces neutres.
  - **Zones** : pastille colorée (dot tone=suitability) + `zoneName` — `aptitude` ; justification atténuée.
  - **Phénologie** : `Timeline` triée par `startDay` (`J{start}–J{end}`, label `name.fr`).
  - **Calendrier & itinéraire** : par fenêtre — ligne saison/semis/irrigation ; `Timeline` des opérations triées par `timingDays`, avec le repère **J0 Semis** ambré inséré ; intrants/matériel en petites puces neutres sous l'étape.
  - **Ravageurs & maladies** : carte par bioagresseur — nom + `ToneBadge` sensibilité (tone=susceptibility) + type ; méthodes de lutte en liste ; stades sensibles atténués.
  - **Nutrition** : liste `nutrient — amount unit (stage)`.
  - **Rendement** : une ligne `<type intrant> : min–average–potential unit` par entrée (+ nom de zone si `zoneId`), l'`average` en gras.
  - **Prix** : petit tableau (Forme / Prix `price currency/unit` / Marché / Période).
  - **Commercialisation** : carte par produit — forme + unités (puces) + débouchés (puces).
  - **Section vide** → texte atténué « Non renseigné ».

## Section 2 — Version publiée (dense, admin)

Page `published/page.tsx` : conteneur large (`max-w-5xl`). En-tête compact (nom + nom scientifique + `family · cycle · usage`), **bandeau ambre** « 🔒 Version publiée figée — v{publishedVersion} · lecture seule », lien « ← Retour au brouillon ». `CropReadView` réécrit :
- **Bande de complétude** : 11 segments étiquetés (Exigences, Édaphique, Variétés, Zones, Phénologie, Calendrier, Ravageurs, Nutrition, Rendement, Prix, Commercialisation) ; vert si renseigné, gris si vide — repère d'audit.
- **Grille de cartes** `md:grid-cols-2`, denses (petit padding). Chaque section = une carte (icône + titre + compteur). Réutilise les composants partagés mais en version compacte : plages en **texte inline** `18–**24**–32 °C` (optimal en gras) plutôt que barres ; badges/pastilles colorés identiques ; itinéraire condensé en une ligne (`J-15 Labour · **J0 Semis** · J+45 Fertilisation`) ; prix et commercialisation en cartes pleine largeur (`col-span-2`). Sections larges : Calendrier, Prix, Commercialisation.
- Les sections vides affichent « Non renseigné » (cohérent avec le segment gris).

## Hors périmètre

- Aucune modification API / DTO / domaine / migration.
- Pas de nouvelle donnée (photos/médias — brique future).
- Pas de i18n au-delà du `fr` déjà utilisé.
- La mise en évidence dynamique de la pilule active au scroll est un bonus, non requis.

## Tests

- **Helpers purs** (Vitest) : `tone(kind, code)` couvre les trois familles + inversion résistance/sensibilité + repli neutral ; positionnement `RangeBar` (optimal → pourcentage) sur un cas.
- **Admin** : `tsc --noEmit` + `pnpm build` verts (les deux vues + pages serveur).
- **Validation manuelle** : ouvrir `/crops/<maïs>/fiche` et `/crops/<maïs>/published` sur une fiche remplie et une fiche partielle ; vérifier hiérarchie, couleurs sémantiques, frises, tableaux, états « Non renseigné », résolution des noms maladie/zone.

## Critères de succès

- [ ] Aperçu client en colonne unique « magazine » : hero, nav pilules, sections riches (barres min–opt–max, badges tone, frises, tableaux).
- [ ] Version publiée dense en grille de cartes + bandeau figé + bande de complétude ; même vocabulaire visuel, compact.
- [ ] Toutes les sections affichées ; sections vides → « Non renseigné » dans les deux vues.
- [ ] Sémantique couleur correcte, y compris l'inversion résistance (HIGH=bon) vs sensibilité (HIGH=mauvais).
- [ ] Noms maladie/zone résolus depuis les référentiels (repli sur l'id).
- [ ] Palette « Vert classique raffiné » appliquée via helper (pas de refonte du thème global).
- [ ] Composants de présentation partagés (tone, ToneBadge, RangeBar, Timeline) réutilisés par les deux vues ; `tsc` + build verts ; helpers testés.

## Suite

Médias/photos par section ; onglet maladies (référentiel riche) ; éventuel export PDF de la fiche publiée.
