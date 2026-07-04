# Spec — Libellés FR & UX des formulaires (admin)

**Projet** : Okko — back-office de la base de connaissances
**Date** : 2026-07-05
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Rendre le back-office **cohérent en français** et les formulaires **UX/UI friendly**. Aujourd'hui les énumérations s'affichent en codes bruts anglais (`SUITABLE`, `PUBLISHED`, `HARVEST`, `LOW`…) dans les selects **et** en lecture (fiche, listes, badges) ; les champs utilisent le placeholder comme libellé ; la justification d'une zone est un `input` étroit ; la date d'un relevé de prix est un champ natif. On introduit une **source unique de libellés FR**, on l'applique partout, on soigne l'ergonomie des formulaires, et on remplace la date par un **date picker shadcn**. **Aucun changement backend** : l'API conserve les codes (intégrité des données + i18n futur) ; la traduction vit dans l'admin.

## 2. Périmètre

### Dans le lot
- **Module de libellés** `apps/admin/src/lib/labels.ts` : mappage `code → libellé FR` pour toutes les énumérations, + helpers pour dériver les options de select.
- **Application aux selects** : cycle (crops/new), aptitude de zone, opération technique (fenêtre), niveau d'intrants (rendement), sensibilité (ravageur), type de ravageur (pests/new + éditeur), base du besoin (nutrition). Les options affichent le FR ; la **valeur envoyée à l'API reste le code**.
- **Application aux affichages lecture** : fiche culture (`crops/[id]/page.tsx`), liste cultures (`crops/page.tsx`), liste ravageurs (`pests/page.tsx`), dashboard (`page.tsx`) — statut, cycle, aptitude, type/sensibilité ravageur, opération, niveau de rendement, base nutrition.
- **UX des formulaires** : chaque champ reçoit un `Label` au-dessus (avec astérisque si requis) et un texte d'aide court si utile ; espacements et regroupements cohérents ; placeholders utiles.
- **Saison** (fenêtre de production) : `input` libre → **select fixe** à 3 valeurs.
- **Justification** (rattacher une zone) : `input` → **`Textarea`** (nouveau primitif shadcn).
- **Date du relevé de prix** : champ natif `type="date"` → **date picker shadcn** (`Popover` + `Calendar`, locale FR).

### Hors périmètre
- Aucun changement backend, aucun nouvel endpoint. L'API garde les codes.
- Pas de traduction anglaise/multilingue de l'UI (FR uniquement pour l'instant).
- Pas de refonte des libellés de champs texte libres autres que ceux listés.
- Édition/suppression des lignes déjà persistées : hors périmètre (comme les lots précédents).

## 3. Libellés FR validés (source de vérité)

**Type de cycle** (`CycleType`)
| Code | FR |
|---|---|
| SEASONAL_ANNUAL | Annuelle (saisonnière) |
| BIENNIAL | Bisannuelle |
| PERENNIAL_HERBACEOUS | Pérenne herbacée |
| PERENNIAL_WOODY_FRUIT | Pérenne ligneuse (fruitière) |
| FORESTRY_WOOD | Forestière (bois) |

**Aptitude de zone** (`SuitabilityRating`)
| Code | FR |
|---|---|
| SUITABLE | Favorable |
| MARGINAL | Marginale |
| UNSUITABLE | Défavorable |

**Opération technique** (`OperationType`)
| Code | FR |
|---|---|
| CLEARING | Défrichage / préparation du sol |
| NURSERY | Pépinière |
| PLANTING | Plantation / semis |
| FERTILIZATION | Fertilisation |
| WEEDING | Désherbage / sarclage |
| PEST_CONTROL | Traitement phytosanitaire |
| HARVEST | Récolte |
| OTHER | Autre |

**Niveau d'intrants** (rendement — `LOW/MEDIUM/HIGH`) : Faible / Moyen / Élevé
**Sensibilité** (ravageur — `LOW/MEDIUM/HIGH`) : Faible / Modérée / Élevée
**Base du besoin** (nutrition — `PER_HECTARE/PER_TONNE`) : Par hectare (kg/ha) / Par tonne de récolte (kg/t)

**Type de ravageur / maladie** (`PestType`)
| Code | FR |
|---|---|
| INSECT | Insecte |
| FUNGUS | Champignon (maladie fongique) |
| BACTERIA | Bactérie |
| VIRUS | Virus |
| WEED | Adventice (mauvaise herbe) |
| NEMATODE | Nématode |
| OTHER | Autre |

**Statut** (`CropStatus`) : DRAFT → Brouillon · PUBLISHED → Publiée · ARCHIVED → Archivée

**Saison** (select fixe, valeurs = libellés, texte libre côté API) : `Saison des pluies`, `Saison sèche`, `Contre-saison`.

> Note : `LOW/MEDIUM/HIGH` porte **deux** libellés distincts selon le contexte (niveau d'intrants vs sensibilité). Le module expose donc deux tables séparées (`INPUT_LEVEL_LABELS`, `SUSCEPTIBILITY_LABELS`), pas une seule.

## 4. Architecture

### 4.1 Module de libellés — `apps/admin/src/lib/labels.ts`
Export d'un objet `Record<string,string>` par énumération, plus un helper d'options :

```ts
export const CYCLE_TYPE_LABELS: Record<string, string> = { SEASONAL_ANNUAL: 'Annuelle (saisonnière)', /* … */ };
export const SUITABILITY_LABELS: Record<string, string> = { SUITABLE: 'Favorable', MARGINAL: 'Marginale', UNSUITABLE: 'Défavorable' };
export const OPERATION_TYPE_LABELS: Record<string, string> = { /* … */ };
export const INPUT_LEVEL_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé' };
export const SUSCEPTIBILITY_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Modérée', HIGH: 'Élevée' };
export const NUTRITION_BASIS_LABELS: Record<string, string> = { PER_HECTARE: 'Par hectare (kg/ha)', PER_TONNE: 'Par tonne de récolte (kg/t)' };
export const PEST_TYPE_LABELS: Record<string, string> = { /* … */ };
export const CROP_STATUS_LABELS: Record<string, string> = { DRAFT: 'Brouillon', PUBLISHED: 'Publiée', ARCHIVED: 'Archivée' };
export const SEASONS = ['Saison des pluies', 'Saison sèche', 'Contre-saison'] as const;

// Résout un code en FR, avec repli sur le code lui-même si inconnu (défensif).
export function labelOf(map: Record<string, string>, code: string): string { return map[code] ?? code; }
```

Les selects itèrent sur `Object.entries(MAP)` : `value=code`, texte=FR. Les affichages lecture appellent `labelOf(MAP, code)`. Le repli sur le code évite un blanc si l'API renvoyait une valeur non mappée.

### 4.2 Nouveaux primitifs shadcn
- `apps/admin/src/components/ui/textarea.tsx` — Textarea shadcn (new-york).
- `apps/admin/src/components/ui/popover.tsx` — Popover Radix (new-york).
- `apps/admin/src/components/ui/calendar.tsx` — Calendar (react-day-picker), locale FR (`date-fns/locale/fr`).
- `apps/admin/src/components/date-picker.tsx` — composant client réutilisable : reçoit `value: string` (ISO `yyyy-MM-dd`) + `onChange: (iso: string) => void`, affiche un `Button` déclencheur (date formatée FR ou placeholder) ouvrant un `Popover` contenant le `Calendar` ; convertit l'ISO ↔ `Date`.
- Dépendances ajoutées : `react-day-picker`, `@radix-ui/react-popover`, `date-fns`.

### 4.3 UX transverse des formulaires
Patron de champ : un `Label` (avec ` *` si requis) + le contrôle + éventuel `<p className="text-xs text-muted-foreground">` d'aide. Les triplets min/opt/max reçoivent un sous-libellé (`min · optimal · max`) et l'unité reste visible. Zéro couleur en dur (tokens uniquement, comme le lot 2). Server/Client Components inchangés (les éditeurs restent client, les listes/fiche restent serveur).

## 5. Data flow (inchangé côté API)
Formulaire → select renvoie le **code** (ex. `SUITABLE`) → même appel API qu'aujourd'hui. Lecture : l'API renvoie le code → l'admin applique `labelOf(...)` au rendu. La date : le picker maintient l'ISO `yyyy-MM-dd` en interne et l'envoie tel quel à `addPrice(...)` (contrat API inchangé).

## 6. Gestion d'erreur
Inchangée : erreurs API affichées inline dans les modales (`text-destructive`). Le date picker n'introduit pas de nouvel appel réseau. Le `labelOf` a un repli sur le code (jamais de blanc).

## 7. Tests
Conforme au reste de l'admin — **le build est la porte** (pas de tests unitaires admin) :
1. `pnpm --filter @okko/admin build` réussit (types + ESLint, `react/no-unescaped-entities`).
2. Vérification manuelle : chaque select montre du FR ; la fiche/listes/badges montrent du FR ; justification en textarea ; saison en select ; date picker FR qui enregistre bien l'ISO ; clair + sombre OK.

## 8. Critères de succès
- [ ] `lib/labels.ts` centralise tous les libellés ; selects **et** affichages lecture l'utilisent.
- [ ] Aucun code d'énumération brut (`SUITABLE`, `PUBLISHED`, `HARVEST`, `LOW`, `PER_HECTARE`, `INSECT`…) visible à l'écran (selects, fiche, listes, badges, dashboard).
- [ ] La valeur envoyée à l'API reste le **code** (aucune régression fonctionnelle).
- [ ] Chaque champ de formulaire a un `Label` (astérisque si requis) ; justification en `Textarea` ; saison en select fixe.
- [ ] Date du relevé de prix via date picker shadcn (locale FR), envoi ISO `yyyy-MM-dd`.
- [ ] `next build` réussit ; aucun changement backend ; l'API (136 tests) reste intacte.

## 9. Notes de découpage
Lot unique à tâches groupées (pas de backend, pas de tests unitaires). Ordre naturel : (1) module labels + primitifs, (2) selects, (3) affichages lecture, (4) UX champs + textarea + saison, (5) date picker.

## Références
- Énumérations source : `apps/api/src/domain/**` (`cycle-type.ts`, `suitability-rating.ts`, `window/operation-type.ts`, `crop-status.ts`, types ravageur/nutrition).
- Lot précédent (habillage shadcn) : `docs/superpowers/plans/2026-07-04-admin-refonte-2-restyle-modales.md`.
- shadcn : Textarea, Popover, Calendar — https://ui.shadcn.com
