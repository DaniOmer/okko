# Backlog — retours d'usage admin (2026-07-11)

Analyse des remarques issues d'un test réel de l'admin, croisées avec le code. Beaucoup se ramènent à quelques **causes communes** localisées. Regroupées par nature, avec cause racine (références fichier) et séquencement.

Source : feedback utilisateur (agronome, porteur du projet).

---

## A. Bugs transverses « état & fraîcheur » — rapides, causes identifiées

### A1 — Les formulaires ne se vident pas après soumission
Remarques : variété, fenêtre, ravageur, nutrition.
**Cause unique.** Les éditeurs sont des dialogues `EditorShell` dont les champs vivent dans un `useState` de l'enfant. À la soumission, `EditorShell` ferme le dialogue (`setOpen(false)`) mais **ne démonte pas** l'enfant → le state survit et réapparaît à la réouverture.
**Fix.** Un seul correctif dans `apps/admin/src/app/crops/[id]/editors/EditorShell.tsx` (ne monter les enfants que si `open`, ou remonter via `key`) répare **tous** les éditeurs.

### A2 — Refresh manuel nécessaire pour voir la liste / les KPI
Remarques : dashboard après ajout de culture, liste ravageurs.
**Cause.** `EditorShell` appelle déjà `router.refresh()` (le détail se met à jour). Le trou est sur **dashboard** (`apps/admin/src/app/page.tsx`) et **liste de cultures** (`apps/admin/src/app/crops/page.tsx`) : server components mis en cache par la navigation, non revalidés après ajout.
**Fix.** Stratégie de revalidation (`no-store` / `dynamic` / `revalidatePath`). La page versions utilise déjà `no-store` — patron à généraliser.

### A3 — La sélection de date ne marche pas
Remarque : relevé de prix.
**Cause.** Le `DatePicker` existe (`@/components/date-picker`, sur `calendar`+`popover`) et est branché dans `PriceEditor`, mais buggé.
**Fix.** Correctif ciblé du composant.

➡️ **Brique 1 « Confort & fraîcheur » : A1 + A2 + A3.**

---

## B. Complétude & règle de publication — 1 bug net + 1 règle métier

### B1 — La complétude affichée en liste/dashboard est fausse (90% réel vs 50% affiché)
**Cause précise.** L'endpoint liste `@Get()` fait `toCropDocument(s)` **sans hydrater** variétés/zones/fenêtres/ravageurs/prix (`apps/api/src/presentation/crop/crop.controller.ts:94`). `toCropDocument` ne lit ces 5 collections **que** depuis les options (`crop-read-model.ts:48-52`), jamais depuis le snapshot → **5 des 10 catégories toujours `false`** en liste (plafond ~50%). Le détail passe par `composeCropDocument` (hydraté) → correct.
**Fix.** Hydrater la liste, ou (plus propre depuis que l'agrégat absorbe les sections) calculer la complétude sur le snapshot event-sourcé.

### B2 — Interdire la publication si complétude < 100%
Nouvelle règle dans `PublishCropUseCase` (garde + message). **Dépend de B1** (chiffre fiable d'abord).

➡️ **Brique 2** avec E1.

---

## E. Sémantique de version

### E1 — « v1 seulement après complétion+publication ; +1 si update+publication »
**Cause.** `_version += 1` à **chaque** événement d'édition (`apps/api/src/domain/crop/crop.ts:174-180`) : compteur interne d'événements, pas un numéro de publication. Il existe déjà un `revision` propre à `PublishedCrop` (C1). Le modèle mental utilisateur = **numéro de révision publiée**.
**Fix.** Exposer « version » = nombre de révisions publiées (0 tant que non publié, v1 à la 1re publication, +1 par republication) ; cesser d'afficher le compteur interne.

➡️ **Brique 2 « Complétude juste + règle de publication » : B1 + B2 + E1** (intriqués).

---

## C. Édition des sous-items — feature de complétude

### C1 — Modifier (update) variété / fenêtre / ravageur / nutrition
Remarques : variété non éditable, fenêtre pas d'update, ravageur update, nutrition update.
**État API inégal :**
- **zone, ravageur** : déjà *upsert par clé* → éditer = ré-émettre même clé (UI à ajouter).
- **nutrition, rendements** : événement *Set* (remplace la liste) → l'UI actuelle remplace déjà tout.
- **variété, fenêtre, prix** : *ajout/append* → **manque un événement update/upsert** en plus de l'UI.

➡️ **Brique 3 « Édition des sous-items »** (surtout UI + qq events). *L'édition de fenêtre est repoussée dans D1 (refonte).*

---

## D. Raffinements du modèle agronomique — design (brainstorming requis)

### D1 — Itinéraire technique / fenêtres de production (la plus structurante)
Revoir : listing des saisons ; **fenêtre de semis en date** (pas texte) ; intégrer la fenêtre de semis dans l'itinéraire ; **liste complète des opérations** ; **opérations avant-semis** ; timing **relatif au semis (J+n)** et **enchaînement** ; **anti-collision** des dates ; + update.
Cœur agronomique. **Brainstorming dédié.** Impacte D3/D4.

### D2 — Rendement de référence
Type d'intrants (chimique / bio / combinaison), unité en **sélection**, et **rendement par zone de production** (si plusieurs zones) → yield rattaché à une zone + `inputType`.

### D3 — Ravageur
Représentation du **seuil de nuisibilité** ; stades sensibles **« après semis »** → bénéficie du modèle de temps de D1.

### D4 — Nutrition
Besoins par **stade** → même logique temporelle que D1/D3.

### D5 — Prix
**Plage de dates** au lieu d'une date fixe (dateStart/dateEnd).

---

## F. Vue client

### F1 — Page de consultation « mode client »
Il existe déjà `CropReadView` + route `/published`. À transformer en **vraie vue client** lisible section par section.

---

## Séquencement

| # | Brique | Contenu | Nature | Effort |
|---|--------|---------|--------|--------|
| 1 | **Confort & fraîcheur** | A1 + A2 + A3 | bugs | court |
| 2 | **Complétude & publication** | B1 + B2 + E1 | 1 bug + règles | court-moyen |
| 3 | **Édition des sous-items** | C1 (hors fenêtre) | feature UI (+qq events) | moyen |
| 4 | **Itinéraire technique** | D1 (+ édition fenêtre) | refonte métier | gros — brainstorming |
| 5 | **Rendement par zone** | D2 | modèle | moyen |
| 6 | **Prix en plage de dates** | D5 | modèle | court |
| 7 | **Ravageur & nutrition par stade** | D3 + D4 | modèle (dépend de D1) | moyen |
| 8 | **Vue client** | F1 | feature | moyen |

**Ordre retenu :** Brique 1 d'abord (bugs transverses), puis Brique 2 (complétude/publication/version, intriqués). Les refontes de modèle (D1 en tête) passent par un brainstorming à part, une par une.
