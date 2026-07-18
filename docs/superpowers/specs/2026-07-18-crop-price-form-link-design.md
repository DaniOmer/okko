# Fiche Culture — prix rattachés à une forme + débouchés structurés — Design

**Statut :** validé (brainstorming), prêt pour le plan.

## Objectif

Relier les **prix** aux **formes commercialisées** d'une culture (la plupart des cultures se vendent sous plusieurs formes : grain, huile, farine…), et structurer les **débouchés** (canaux de vente) en codes au lieu de texte libre. Passer les selects et le sélecteur de dates de l'admin aux composants **shadcn**.

## Contexte & état existant (découvert à l'exploration)

- **Prix** = agrégat `PricePoint` **séparé** (table `PricePoint`, CRUD add/update/list, time-series) : `id, cropId, market, periodStart, periodEnd, price, unit, currency`. Passe par les events `PricePointAdded/Updated` (portés par l'agrégat `Crop`) **et** un repository dédié (la projection reçoit les prix via `opts.prices`, pas depuis le snapshot). **Pas** dans `CropSnapshot`.
  - `unit` est aujourd'hui une **chaîne libre** (défaut `"FCFA/kg"`, mélange unité+devise) ; `currency` est une chaîne libre (défaut `"XOF"`).
  - **Manque** : aucun lien vers la **forme** du produit → un prix « 500/kg » est ambigu dès qu'une culture a plusieurs formes.
- **Commercialisation** = section JSON event-sourcée sur `Crop` : `CommercializationProduct { form, saleUnits[], outlets[] }` (structurelle, stable). `form` et `saleUnits` sont déjà des **codes** ; `outlets` est une **liste de texte libre** → dérive possible (p.ex. saisir un nom de marché, redondant avec `PricePoint.market`).
- Barèmes existants réutilisés : `PRODUCT_FORM_LABELS` (GRAIN/FLOUR/OIL/LEAF/FRUIT/TUBER/OTHER), `SALE_UNIT_LABELS` (KG/BAG/CRATE/TONNE).
- Admin : `PriceEditor` (`unit` en `<Input>` libre, dates via `date-picker.tsx` = `<input type="date">` natif) ; `CommercializationEditor` (`form` déjà en `<Select>` shadcn, `saleUnits` en boutons-bascule, `outlets` en liste de `<Input>` libres). Composants shadcn **présents** : `Select`, `Calendar`, `Popover`, `Button`, `Input`, `Badge` (⚠️ `command.tsx` absent). Le `DatePicker` natif n'utilise **pas** `Calendar`/`Popover`.
- Complétude : 11 catégories dont `prices` et `commercialization` (chacune `length > 0`). **Inchangée** par cette brique (on enrichit des sections déjà comptées, pas de nouvelle catégorie).

## Décisions produit (validées)

- **Multi-formes = la norme** → un **prix se rattache à une forme**.
- **Modèle A (couplage fort, côté UI)** : à la saisie d'un prix, le select de **forme** ne propose que les **formes déclarées** dans la commercialisation de la culture, et le select d'**unité** ne propose que les `saleUnits` de cette forme. Corollaire : **déclarer la commercialisation avant** de saisir des prix (l'éditeur bloque si commercialisation vide). `form` est un **champ requis structuré** côté domaine (porté par l'event, stocké, montré dans le diff), mais **le serveur ne valide pas** l'appartenance de la forme aux formes déclarées : client admin unique et de confiance ; une validation d'enum serveur coupleraient `add/update-price` à l'état commercialisation et ferait échouer les tests prix existants sans gain réel (YAGNI). Le couplage vit dans l'UX.
- **Débouché conservé mais structuré** : codes de canal via **select**, plus de texte libre.
- **shadcn** pour **tous les selects** et le **sélecteur de dates** (période de prix).
- Pas de nouvelle catégorie de complétude. Clean architecture + TDD stricts.
- Pas de rétro-compat d'events. Données existantes : la migration ajoute une colonne `form` **nullable** ; le repo mappe `?? 'GRAIN'` en lecture pour les anciennes lignes (best-effort ; l'expert corrige dans l'UI). L'ancien `unit` libre s'affiche en repli brut si non reconnu.

---

## Section 1 — Prix rattaché à une forme (API)

**`PricePoint` (VO + snapshot) gagne `form: string`** (code `PRODUCT_FORM`). Le champ `unit` **change de sémantique** : il portait une chaîne libre, il porte désormais un **code `SALE_UNIT`** (KG/BAG/CRATE/TONNE). **Pas de renommage de colonne** (`unit` reste `unit`), seule sa valeur devient un code — l'UI l'y contraint.

**Technique :**
- `domain/price/price-point.ts` : `PricePointSnapshot` + `CreateProps` + constructeur + getter + `toSnapshot`/`fromSnapshot` gagnent `form`.
- Events `PricePointAdded/Updated` portent déjà `PricePointSnapshot` → `form` se propage automatiquement.
- `AddPricePointInput` / `UpdatePricePointInput` + use-cases gagnent `form: string` (requis). Les tests prix existants passent simplement `form: 'GRAIN'`. **Pas** de validation d'appartenance côté serveur (voir décisions).
- **Migration Prisma** (manuelle, comme les précédentes) : `ALTER TABLE "PricePoint" ADD COLUMN "form" TEXT;` (nullable).
- `prisma-price-point.repository.ts` : `toRow` mappe `form` ; `toSnapshot` mappe `form: row.form ?? 'GRAIN'`.
- Contrôleur `POST/PUT /crops/:id/prices` : le `@Body` inline gagne `form: string`.
- Read-model : `prices` est un passe-plat depuis les snapshots du repo → `form` remonte sans changement de code (à couvrir par test).
- `crop-diff.ts` : `prices` est une section à clé (`id`) ; `diffObjectFields` compare toutes les clés → un changement de `form`/`unit` remonte déjà. **Test** l'ajoutant.

## Section 2 — Éditeur prix admin (forme + unité couplées + calendrier shadcn)

- `lib/api.ts` : `PricePoint` gagne `form: string`.
- `lib/actions.ts` : bodies de `addPrice`/`updatePrice` gagnent `form: string`.
- `PriceEditor.tsx` : nouvelle prop `commercialization: CommercializationProduct[]`.
  - Select **forme** (shadcn) : options = formes déclarées distinctes (`commercialization.map(p => p.form)`), libellées via `PRODUCT_FORM_LABELS`.
  - Select **unité** (`unit`, shadcn) : options = `saleUnits` de la forme choisie, libellées via `SALE_UNIT_LABELS`. Se réinitialise quand la forme change.
  - Si `commercialization` est vide → message « Déclare d'abord la commercialisation » + formulaire désactivé.
  - Dates `periodStart`/`periodEnd` : **date-picker shadcn** (`Calendar` dans `Popover`, bouton déclencheur) — nouveau composant partagé `shadcn-date-picker.tsx` (valeur ISO `YYYY-MM-DD` ⇄ `Date`). Ne pas toucher l'ancien `date-picker.tsx` (autres usages).
  - `currency` : reste un `<Input>` (défaut `XOF`) — hors périmètre.
- `page.tsx` : passe `commercialization={crop.commercialization ?? []}` au `PriceEditor` (add + edit).
- Vues lecture (`CropReadView.tsx`, `FicheClientView.tsx`) : afficher la **forme** (label) + l'**unité** (label) + `currency` + `market` + période. Repli brut si code inconnu.

## Section 3 — Débouchés structurés (codes + select)

- `lib/labels.ts` : nouveau `OUTLET_LABELS` :
  `SELF_CONSUMPTION: 'Autoconsommation'`, `LOCAL_MARKET: 'Marché local'`, `WHOLESALER: 'Grossiste / collecteur'`, `PROCESSOR: 'Transformateur'`, `EXPORT: 'Export'`, `COOPERATIVE: 'Coopérative / groupement'`.
- `CommercializationEditor.tsx` : remplacer la liste d'`<Input>` libres par un **select shadcn** ajoutant un canal à la liste + **badges** retirables (options = canaux pas encore choisis). `outlets` reste `string[]` (codes désormais).
- VO `CommercializationProduct` **inchangé** (déjà `outlets: string[]`).
- Vues lecture : afficher les débouchés via `OUTLET_LABELS` (repli brut si code inconnu, p.ex. anciens textes libres).

## Section 4 — Tests

**API** (Jest, doubles mémoire, event-sourcing ; TDD) :
- `price-point.spec` : round-trip `form` (toSnapshot/fromSnapshot).
- `add-price-point.use-case.spec` / `update-price-point.use-case.spec` : acceptent `form` (requis) et le persistent dans le snapshot ; tests existants mis à jour avec `form: 'GRAIN'`.
- `crop-read-model` : la projection des prix expose `form`.
- `crop-diff.spec` : un changement de `form` d'un prix (même id) remonte en `changed`.
- Non-régression : suite crop complète verte.

**Admin** : `tsc --noEmit` + `pnpm build`.

**Validation manuelle** : déclarer commercialisation (grain: sac/kg + débouchés grossiste/export ; huile: …) → saisir un prix (le select forme propose grain+huile, l'unité suit) → publier → vérifier diff + affichage + calendrier shadcn.

## Critères de succès

- [ ] `PricePoint` porte `form` (code) de l'event à l'éditeur ; migration colonne `form`.
- [ ] Selects forme/unité de l'éditeur prix couplés aux formes/unités **déclarées** (modèle A côté UI) ; garde si commercialisation vide.
- [ ] Débouchés en codes (`OUTLET_LABELS`) via select shadcn + badges ; VO inchangé.
- [ ] Dates de période via `Calendar`/`Popover` shadcn ; tous les selects concernés en shadcn.
- [ ] Clean architecture (domain pur → application → présentation/admin) ; chaque couche en TDD.
- [ ] Diff lisible pour `form`/`unit` des prix ; suites API + admin vertes ; builds OK.
- [ ] Réutilise `PRODUCT_FORM`/`SALE_UNIT` existants ; pas de nouvelle catégorie de complétude.

## Suite

Récolte enrichie, post-récolte, adventices, bonnes pratiques, médias ; onglet maladies (référentiel riche) + association maladie↔stade ; Carnet (données de terrain). Éventuel passage du reste des inputs date au calendrier shadcn.
