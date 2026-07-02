# Spec — Phase 0 : Base de connaissances agronomique + back-office admin

**Projet** : Okko — plateforme d'agriculture de précision pour l'Afrique subsaharienne
**Phase** : 0 (socle) — la première brique de la [vision globale](../../2026-07-02-vision-globale.md)
**Date** : 2026-07-02
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Construire le **socle de données agronomiques** d'Okko et le **back-office** qui permet à un expert d'y saisir des fiches culture complètes.

Le modèle de données doit être **agnostique à la culture** : aucune hypothèse sur une culture pilote. Il doit capter *tous* les paramètres possibles, bien structurés par catégorie, et couvrir tous les types de cycle — du maraîchage (carotte, plusieurs cycles/an) à la plantation forestière (gmelina, production sur 30 ans), en passant par l'annuel (coton) et le fruitier pérenne (manguier, ananas).

C'est l'**actif central** de la vision : bien conçu, il alimente plus tard le Carnet de suivi (Phase 1), le diagnostic IA (Phase 2), l'API publique (Phase 3), et un chatbot agronomique.

## 2. Périmètre

### Dans la v1
- Le **modèle de données** complet (domaine + persistance Postgres).
- Le **back-office admin** : CRUD des fiches culture, saisie **simple et complète**, structurée par catégories.
- Les deux **catalogues de référence partagés** : zones agro-écologiques, ravageurs/maladies.
- **Versionnement + journal d'audit** des fiches.
- **Provenance** des données (saisie manuelle vs source externe).
- Structure **AI-ready** et **multilingue** (i18n) dès l'origine.
- Une culture saisie **de bout en bout** comme preuve du modèle (choisie librement au moment du test).

### Hors v1 (phases suivantes)
- Interface publique de consultation / API en lecture (Phase 3).
- Import automatisé depuis les sources ouvertes (iSDA, ECOCROP, GAEZ, HarvestStat, GIEWS) — le modèle **prévoit** la provenance externe, mais l'ingestion automatique n'est pas construite en v1 (saisie manuelle, éventuellement assistée par copier-coller).
- Carnet de suivi de production (Phase 1), diagnostic IA (Phase 2), embeddings/RAG du chatbot, module élevage (Phase 4).
- Authentification multi-rôles avancée : la v1 se limite au rôle **admin/expert** (auth simple suffisante).

### Non-objectifs explicites
- Pas d'event sourcing sur le socle (réservé au Carnet, Phase 1).
- Pas de promesse de rendement affichée : les rendements sont des **références documentées et sourcées**, jamais des garanties.

## 3. Stack technique

| Couche | Choix |
|---|---|
| Base de données | **PostgreSQL** (colonnes typées + `JSONB` par catégorie) |
| Backend | **NestJS / TypeScript**, **TDD**, **clean architecture**, clean code |
| Frontend admin | **Next.js**, **TailwindCSS**, **shadcn/ui**, **lucide** icons |
| Versionnement | Versions publiées (`DRAFT`/`PUBLISHED`/`ARCHIVED`) + table d'audit ; séries de prix append-only |

## 4. Architecture (clean architecture)

Séparation stricte en couches, testées indépendamment :

- **Domaine** : entités, agrégats, value objects (ex. `RangeValue`), règles métier (validité des cycles, cohérence min/opt/max, provenance). **Aucune dépendance externe** → cœur du TDD.
- **Application** : use-cases (créer/éditer/publier une fiche, gérer variétés, lier un ravageur…), et le **read-model** (projection « fiche complète »).
- **Infrastructure** : persistance Postgres, mapping, futurs connecteurs de sources externes.
- **Présentation** : API du back-office consommée par le frontend Next.js.

### Agrégats
- **`Crop`** (racine d'agrégat) : identité, classification/cycle, variétés, exigences climatiques & édaphiques, phénologie, fenêtres de production, itinéraire technique, nutrition, rendements, prix.
- **`AgroEcologicalZone`** (agrégat de référence partagé).
- **`PestDisease`** (agrégat de référence partagé), relié aux cultures par une table de liaison portant l'info spécifique à chaque culture.

Les agrégats de référence sont partagés pour éviter la duplication (un ravageur décrit une fois, réutilisé ; une zone définie une fois).

## 5. Modèle de domaine

### 5.1 Les trois notions temporelles (indépendantes)

Le défi central est de couvrir tous les types de culture sans exception dans le code. Trois notions **orthogonales** :

1. **Phénologie** (`PhenologicalStage`, en **jours** depuis semis/plantation) : l'horloge *interne* de la plante (germination → levée → floraison → maturation). Biologie intrinsèque, indépendante de la saison. Vaut pour toutes les cultures.

2. **Phases du cycle de vie** (`LifecyclePhase`, en **années**) : pour les pérennes (établissement → juvénile improductif → entrée en production → pleine production → sénescence). Chaque phase porte son rendement attendu.
   - **Principe unificateur** : une culture annuelle = une culture pérenne à **une seule** `LifecyclePhase` qui contient le cycle unique. Aucun cas particulier dans le code ; la carotte est le cas dégénéré du manguier.

3. **Fenêtres de production** (`CroppingWindow`, scope **Zone × saison**) : *quand*, dans l'année, on peut lancer le cycle, avec ses contraintes propres. Une culture annuelle peut avoir **plusieurs fenêtres/an** (carotte : saison sèche irriguée ET saison des pluies), chacune avec son itinéraire, son rendement et ses recommandations phyto. Un pérenne a typiquement une fenêtre floraison-récolte/an, positionnée par zone. Le **nombre de cycles/an se déduit** des fenêtres définies pour une zone.

Le champ **`Crop.cycleType`** (`SEASONAL_ANNUAL`, `BIENNIAL`, `PERENNIAL_HERBACEOUS`, `PERENNIAL_WOODY_FRUIT`, `FORESTRY_WOOD`…) ne change pas la structure : il pilote seulement quelles échelles sont renseignées.

#### Validation croisée (exemples)
| Culture | `cycleType` | Phéno (jours) | Cycle de vie (années) | Fenêtres/an |
|---|---|---|---|---|
| Carotte | `SEASONAL_ANNUAL` | ~90-120 j | 1 phase | ≥ 2 (sèche + pluies) |
| Coton | `SEASONAL_ANNUAL` | ~150-180 j | 1 phase | 1 |
| Ananas | `PERENNIAL_HERBACEOUS` | cycle fructif. | plant → 1re récolte, rejets | 1 (+ rejets) |
| Manguier | `PERENNIAL_WOODY_FRUIT` | cycle flor.-récolte | juvénile 0-4 ans → plateau 8-30 ans | 1 |
| Gmelina | `FORESTRY_WOOD` | — | juvénile → coupe (rotation) | n/a |

### 5.2 Value objects réutilisables
- **`RangeValue`** : `{ min, optimal, max, unit }` — réutilisé partout (température, pluviométrie, pH…). Testé une fois, validé une fois (règle : `min ≤ optimal ≤ max`).
- **`TranslatableText`** : map `{ locale: text }` (stockée en JSONB) pour l'i18n de tous les textes.
- **`Provenance`** : `{ source, sourceRef, capturedAt, validatedBy, confidence }` attaché aux valeurs/groupes.

### 5.3 Les 11 catégories de la fiche

Chaque catégorie = table typée + colonne `JSONB metadata` (échappatoire pour les spécificités imprévues, sans migration).

| # | Catégorie | Rattachée à | Contenu principal |
|---|---|---|---|
| 1 | Identité & taxonomie | Culture | Noms communs (multilingues/locaux), nom scientifique, famille, genre, synonymes, catégorie d'usage, photo |
| 2 | Classification & cycle | Culture / Variété | `cycleType`, durée de cycle (jours), longévité (années), mode de propagation (semis direct / pépinière / bouturage / greffage) |
| 3 | Variétés | Variété | Nom, obtenteur, durée, potentiel de rendement, résistances/tolérances, caractéristiques commerciales |
| 4 | Exigences climatiques | Culture *(affinable Zone)* | Température, pluviométrie, photopériode, hygrométrie, altitude, tolérances (sécheresse/chaleur/gel), zones Köppen — au format `RangeValue` |
| 5 | Exigences édaphiques (sol) | Culture | pH, texture, structure, drainage, profondeur, matière organique, salinité — rattachable iSDAsoil |
| 6 | Zones de production | Zone *(entité partagée)* | Adéquation culture ↔ agro-écologie (adapté / marginal / déconseillé) + justification |
| 7 | Fenêtres de production | Fenêtre (Zone × saison) | Période de semis, saison, besoin d'irrigation, nb de cycles/an |
| 8 | Phénologie & itinéraire technique | Culture *(phéno)* / Fenêtre *(itinéraire)* | Stades phénologiques (jours, %) + opérations culturales ordonnées (défrichage, pépinière, mise en terre, sarclage, buttage, récolte…) avec timing + intrants |
| 9 | Nutrition & fertilisation | Culture *(affinable Zone / rendement-cible)* | Besoins N-P-K + oligo-éléments par stade / par tonne, fumure de fond & couverture, exportations |
| 10 | Phytosanitaire | `PestDisease` (partagé) ↔ Culture | Type (insecte/champignon/bactérie/virus/adventice/nématode), symptômes, stades sensibles, seuils de nuisibilité, méthodes de lutte durable (prévention → bio → intégrée → chimique homologué en dernier recours), photos |
| 11 | Rendement & Économie | Fenêtre × niveau d'intrants *(+ LifecyclePhase pour pérennes)* | Rendement de référence (min/moyen/potentiel) par niveau d'intrants et zone + séries de prix par marché/date + saisonnalité |

## 6. Préoccupations transversales

### 6.1 Versionnement & audit
- `Crop` a un statut (`DRAFT` / `PUBLISHED` / `ARCHIVED`) et un numéro de version.
- Table `AuditLog` : chaque écriture tracée (acteur, timestamp, champ, ancienne → nouvelle valeur). Diff et rollback possibles.
- Séries de prix : append-only (valid-time local).
- **Pas d'event sourcing** ici — réservé au Carnet (Phase 1) où les événements temporels sont la nature du domaine.

### 6.2 Provenance
Chaque valeur (ou groupe) porte un `Provenance` : `source` (`MANUAL` / `EXTERNAL`), `sourceRef` (URL/dataset), `capturedAt`, `validatedBy`, `confidence`. Permet de distinguer vérité experte et import, d'afficher « selon iSDA… », et de **citer les sources** dans l'API et le futur chatbot.

### 6.3 AI-readiness
1. **Schéma auto-descriptif** : chaque champ a clé stable + label (multilingue) + description + unité → sérialisable en JSON/markdown pour un LLM.
2. **Champs narratifs** (`notes`/`narrative`) à côté des valeurs chiffrées dans chaque catégorie.
3. **Vocabulaires contrôlés** (enums avec labels) → filtrables et explicables.
4. **Read-model « fiche complète »** (CQRS léger) : écriture normalisée / lecture dénormalisée assemblant la fiche pour un contexte Zone × Fenêtre. Unité naturelle pour l'API et, plus tard, le RAG (chunk embeddable). Embeddings non construits en v1 mais rendus triviaux à ajouter.
5. **i18n first-class** : textes traduisibles en JSONB `{ locale: text }`, prêt pour les langues vernaculaires.

## 7. Back-office admin (exigences UX)

- **Saisie simple mais complète** : formulaire organisé par les 11 catégories (accordéons/onglets), chaque section indépendante.
- Une fiche peut être sauvegardée **incomplète** (`DRAFT`) et complétée progressivement.
- Gestion des **variétés** (n par culture), des **fenêtres** (n par zone), des liaisons **ravageurs**.
- Sélection dans les catalogues partagés (zones, ravageurs) avec création à la volée.
- Indicateur de **complétude** de la fiche et de **provenance** par valeur.
- Prévisualisation de la **fiche complète** (read-model) avant publication.

## 8. Approche de test (TDD)

- Le **domaine** est testé en premier, sans dépendances : `RangeValue` (invariants), règles de cycle (annuel = 1 phase, cohérence phéno/fenêtres), provenance, transitions de statut.
- Use-cases testés au niveau application (create/edit/publish, liaisons).
- Tests d'intégration sur la persistance Postgres et le read-model.
- Le frontend consomme l'API ; tests de composants sur les formulaires critiques.

## 9. Critères de succès

- [ ] Une fiche culture **annuelle** (ex. carotte avec 2 fenêtres saisonnières) se saisit et se publie de bout en bout.
- [ ] Une fiche **pérenne/forestière** (ex. gmelina ou manguier avec phases pluriannuelles) se saisit dans le **même** modèle, sans cas particulier dans le code.
- [ ] Un ravageur créé une fois est **réutilisé** sur plusieurs cultures avec des infos spécifiques par culture.
- [ ] Une spécificité imprévue se stocke dans `metadata` **sans migration**.
- [ ] L'historique d'une fiche est **consultable** (audit + versions).
- [ ] Le **read-model** produit une fiche complète sérialisable (JSON/markdown) pour un contexte Zone × Fenêtre donné.
- [ ] Chaque valeur porte son **unité** et sa **provenance**.
- [ ] Couverture de tests conforme à l'approche TDD sur le domaine.

## 10. Questions ouvertes (à trancher au plan d'implémentation)
- ORM/couche d'accès Postgres (ex. Prisma vs TypeORM vs SQL + repository sur mesure) — à choisir selon la fidélité clean-architecture souhaitée.
- Granularité exacte de la provenance : par valeur, par groupe de valeurs, ou par section.
- Liste initiale des `cycleType`, types de ravageurs, niveaux d'intrants, et locales i18n de départ.
- Modalité de saisie assistée (copier-coller depuis sources ouvertes) — utile mais optionnelle en v1.

---

## Références
- Vision globale : [`docs/2026-07-02-vision-globale.md`](../../2026-07-02-vision-globale.md)
- Référentiels agronomiques inspirant le modèle : FAO ECOCROP, GAEZ v4, FAO Crop Calendar.
- Sources de données ouvertes prévues (provenance externe) : iSDAsoil (sol), Open-Meteo/CHIRPS (climat), HarvestStat Africa (rendements), FAO GIEWS FPMA (prix).
