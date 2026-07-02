# Okko — Vision globale

**Plateforme d'agriculture de précision (végétale puis animale) pour l'Afrique subsaharienne**

Document de vision — 2026-07-02
Auteur : porteur du projet (agronome, licence production végétale)
Statut : draft à valider. Ce document décrit le **cap complet** (toutes les features possibles). Il ne décrit PAS le premier périmètre à construire — celui-ci fera l'objet d'un spec dédié (voir §11).

---

## 1. En une phrase

Okko rassemble en un seul endroit **le savoir agronomique actionnable, le suivi de production et le diagnostic assisté par IA**, culture par culture, pour rendre l'agriculture de précision accessible à tous les acteurs agricoles d'Afrique subsaharienne — et bâtir, chemin faisant, la base de connaissances agronomique la plus complète du continent, ouverte à terme via API.

---

## 2. Le constat, confirmé par la recherche

Le problème initial est réel et documenté :

- **L'adoption réelle par les petits exploitants reste faible**, même quand les taux d'abonnement affichés sont élevés. Les vrais utilisateurs actifs des plateformes digitales agricoles sont souvent les exploitations commerciales et les agrégateurs, pas le petit paysan. *(Ofosu-Ampong 2025 ; Gatti 2026)*
- **Les échecs sont rarement techniques** : ils viennent d'inadéquations de design et de mauvais ajustement socio-technique (outil pensé loin du terrain). Les alternatives « low-tech » et la **médiation humaine** (technicien, réseau de pairs, vidéo) l'emportent souvent sur l'app pure. *(Gatti 2026)*
- **Les barrières dominantes** : accès à l'équipement, alphabétisation, connectivité, et protection des données. *(Ofosu-Ampong 2025)*
- **Un recensement académique a identifié ~19 outils de conseil agricole** couvrant marché, finance, post-récolte, élevage, météo, réseaux de pairs/vidéo et agriculture climato-intelligente — le paysage est déjà peuplé, mais fragmenté. *(desk review, Global South)*

> **Implication n°1 pour Okko** : la différenciation ne viendra pas de « avoir une app », mais de **la profondeur et la fiabilité du savoir agronomique** + **une expérience pensée pour la médiation humaine et le hors-ligne**, pas contre eux.

⚠️ **À ne pas répéter** : la promesse marketing courante « +25 % de rendement grâce au conseil digital » circule beaucoup mais **n'a pas résisté à la vérification** (source Brookings, réfutée 2 voix contre 1). On ne fondera aucun argumentaire d'Okko sur des chiffres de rendement non prouvés.

---

## 3. Positionnement — ce qu'Okko fait différemment

| Piège observé chez les concurrents | Réponse d'Okko |
|---|---|
| App déconnectée du terrain | Conçue **avec et pour la médiation humaine** (technicien/coopérative comme utilisateur de plein droit) |
| Suppose une connexion permanente | **Hors-ligne d'abord** (offline-first), synchro opportuniste |
| Données génériques « one-size-fits-all » | Recommandations **contextualisées** par culture × région × sol × calendrier |
| Savoir dispersé | **Base de connaissances unifiée**, une fiche culture faisant autorité |
| Boîte noire | Recommandations **traçables et explicables** (« pourquoi ce conseil ») |

**Les trois publics coexistent** (petit exploitant, technicien/coopérative, agri-entrepreneur), mais le premier **relais de diffusion** visé est le **technicien/coopérative** : c'est le levier d'adoption le plus réaliste au vu de la recherche.

---

## 4. La vision produit — les 4 modules

Okko est un socle unique (la Base de connaissances) autour duquel gravitent trois modules qui la consomment et l'enrichissent.

```
                ┌─────────────────────────────────────────┐
                │   BASE DE CONNAISSANCES AGRONOMIQUE       │  ← socle & actif central
                │   (fiches cultures faisant autorité)      │
                └───────▲───────────────┬──────────────────┘
                        │ enrichit       │ alimente
        ┌───────────────┴───┐   ┌───────▼──────────┐   ┌──────────────────┐
        │ CARNET DE SUIVI    │   │ DIAGNOSTIC IA     │   │ MODULE ÉLEVAGE    │
        │ de production      │   │ (photo → maladie  │   │ (précision animale│
        │ (journal + conseils│   │  → reco)          │   │  — plus tard)     │
        │  contextualisés)   │   └───────────────────┘   └──────────────────┘
        └────────────────────┘
                        │
                        ▼
             API publique + IA agronomique (vision long terme)
```

### Module 1 — Base de connaissances agronomique *(socle, premier périmètre)*
La fiche culture faisant autorité : zones/agro-écologies adaptées, exigences climatiques (pluviométrie, température), sol (pH, texture), cycle et calendrier cultural, besoins nutritifs/fertilisation, ravageurs & maladies, méthodes de lutte durable, rendements de référence, évolution des prix. Alimentée via un **back-office admin** (l'expert crée une culture et renseigne le plus large possible). Détail en §5.

### Module 2 — Carnet de suivi de production
L'agriculteur (ou son technicien) renseigne sa région, sa parcelle, puis journalise l'exécution : défrichage, pépinière, mise en terre, apports d'intrants, opérations culturales. En retour, Okko croise ces données avec la Base pour produire des **recommandations datées** (« il est temps de… », « attention, fenêtre de traitement… »). Ce module **génère la donnée terrain** qui affine la Base.

### Module 3 — Diagnostic IA
Photo d'une plante → détection de maladie/ravageur → recommandation de prévention/traitement. Réalisme et état de l'art en §7. **Ne pas construire en premier** : coûteux, dépendant de données que le carnet de suivi produira.

### Module 4 — Élevage de précision *(extension future)*
Réplique de la logique (savoir + suivi + diagnostic) pour l'agriculture animale. Détail et écosystème existant en §8.

---

## 5. Anatomie d'une fiche culture (modèle de données du socle)

La recherche valide qu'il existe des **référentiels agronomiques ouverts et éprouvés** sur lesquels calquer la structure — inutile de réinventer la taxonomie.

**FAO ECOCROP** modélise les exigences écologiques d'une culture selon : température, précipitations, **pH du sol**, lumière, zones climatiques (Köppen), photopériode, latitude, altitude, caractéristiques de sol, et descripteurs de plante. *(FAO ECOCROP — primaire)*

**GAEZ v4** (Global Agro-Ecological Zones, FAO/IIASA) complète avec : **longueur du cycle**, indice de récolte (harvest index), LAI (indice de surface foliaire), photosynthèse, pratiques culturales et niveaux d'intrants. *(GAEZ Model Documentation — primaire)*

> ⚠️ Nuance : ECOCROP est **figé depuis 2015** (plus mis à jour), mais reste valide et est réutilisé via GAEZ v4. À traiter comme référentiel d'amorçage, pas comme source vivante.

**Structure de fiche proposée pour Okko** (à affiner dans le spec du socle) :

1. **Identité** : nom commun (multilingue/local), nom scientifique, famille, variétés.
2. **Zones de production adéquates** : agro-écologies, altitude, latitude, zones climatiques.
3. **Exigences climatiques** : pluviométrie (min/opt/max), température (min/opt/max), photopériode.
4. **Exigences sol** : pH (min/opt/max), texture, drainage, profondeur.
5. **Cycle & calendrier cultural** : durée du cycle, stades phénologiques, fenêtres de semis/récolte par zone.
6. **Nutrition & fertilisation** : besoins N-P-K et oligo-éléments par stade, fumure de fond/couverture.
7. **Ravageurs & maladies** : catalogue, symptômes, seuils de nuisibilité.
8. **Lutte durable** : méthodes agroécologiques, prévention, lutte intégrée respectueuse de l'environnement.
9. **Rendements de référence** : par niveau d'intrants / zone (voir HarvestStat §6).
10. **Prix de vente** : séries et tendances (voir GIEWS §6).

Chaque champ doit pouvoir être **soit saisi par l'expert (admin), soit rattaché à une source de données** (§6). C'est ce double mode qui rend la fiche à la fois riche dès le départ et vivante ensuite.

---

## 6. Sources de données ouvertes exploitables

Toutes vérifiées comme primaires et accessibles programmatiquement, sauf mention :

| Besoin | Source | Accès / licence | Réserve |
|---|---|---|---|
| Calendrier cultural | **FAO Crop Calendar** — dates de semis/récolte, requêtable par pays/culture/activité | API FAO/data.apps.fao.org | — |
| Exigences écologiques (amorçage fiche) | **ECOCROP / GAEZ v4** | Portails FAO/IIASA | ECOCROP figé 2015 |
| Météo / agrométéo | **Open-Meteo** — variables agricoles, sans clé API | Gratuit **usage non commercial uniquement** | ⚠️ licence à revalider pour un usage commercial |
| Pluviométrie Afrique | **CHIRPS** — archive pluie (satellite + stations) | Libre, ex. AWS Open Data (Digital Earth Africa) | CC-BY |
| Sol (pH, 20+ propriétés) | **iSDAsoil** (iSDA Africa) — prédictions sol, **API gratuite** | CC-BY | — |
| Prix de marché | **FAO GIEWS FPMA Tool** — prix alimentaires courants/historiques | Portail FAO | Couverture variable selon pays |
| Rendements de référence | **HarvestStat Africa** — 574 204 enregistrements de rendement en accès ouvert | Dataset ouvert (Nature Sci. Data 2025) | Confiance légèrement moindre (vote 2-1) |

> **Implication n°2** : le socle n'a pas besoin d'être rempli 100 % à la main. La fiche culture peut **agréger** ces sources ouvertes et laisser l'expert corriger/enrichir. C'est un accélérateur majeur pour le premier périmètre.
>
> ⚠️ **Point de vigilance juridique** : Open-Meteo est gratuit **seulement en non-commercial**. Dès qu'Okko a un modèle payant, il faudra une offre commerciale (Open-Meteo payant) ou une alternative. À trancher avant tout lancement monétisé.

---

## 7. Module IA de diagnostic — état de l'art & réalisme

C'est le module le plus « sexy » et le plus piégeux. La recherche impose de la prudence :

- **PlantVillage a une limite structurelle** : ses images sont prises en **laboratoire** (feuille unique, fond uniforme). Les modèles entraînés dessus **généralisent mal aux photos de champ réelles** (fonds complexes, feuilles multiples, luminosité variable). *(constat récurrent de la littérature ; à considérer comme acquis même si non isolé en claim vérifié)*
- **Alternative terrain** : le dataset **FieldPlant** (images de plantes **en conditions de champ**) est précisément conçu pour combler ce manque en détection/classification par deep learning. *(FieldPlant — primaire)*
- **Preuve que ça peut marcher** : **PlantVillage Nuru** (app de diagnostic IA, IITA) détecte les maladies du **manioc avec 65 à 93 % de justesse**, dépassant agents de vulgarisation et agriculteurs. **MAIS** les gains de rendement associés **ne sont pas prouvés**. *(Frontiers Plant Science 2020, PMC7775399)*

> **Implication n°3** : YOLOv5 + PlantVillage est un **bon prototype de démonstration**, pas un produit fiable en l'état. Pour un module réellement utile : entraîner/affiner sur des **images de champ** (FieldPlant, puis les photos remontées par le Carnet de suivi), viser une culture à la fois, et communiquer sur la **justesse de diagnostic**, jamais sur des promesses de rendement.

**Séquencement recommandé** : le diagnostic IA arrive **après** que le Carnet de suivi ait commencé à collecter des photos terrain géolocalisées et étiquetées. Ces données sont le vrai carburant — et un avantage concurrentiel que personne d'autre n'a.

---

## 8. Module élevage (vision, plus tard)

L'écosystème existe déjà, ce qui valide le besoin et fournit des points d'intégration :

- Un **guide d'outils de diagnostic des maladies animales** en Afrique subsaharienne existe (Livestock Data for Decisions). *(primaire)*
- L'**ILRI** a lancé une **app mobile de suivi des performances des animaux laitiers** (projet Africa-Asia Dairy Genetic Gains). *(primaire)*
- Le **NEPAD** pousse activement l'agriculture de précision pour les petits exploitants. *(primaire)*

> **Implication n°4** : le module élevage réutilisera l'architecture (savoir + suivi + diagnostic) mais sur un domaine distinct. À garder dans la vision, hors périmètre initial. Opportunité de partenariat plutôt que de tout reconstruire (ILRI, réseaux Livestock Data).

---

## 9. Modèle économique & monétisation

Contexte de marché à connaître :

- **Le financement de l'agtech africaine s'est contracté** (le secteur a perdu de l'élan) — lever des fonds sera plus dur qu'en 2021-2022. *(NextBillion, Briter — secondaires)*
- **L'énorme besoin est le financement agricole** : déficit estimé à **~117 Md USD** en Afrique subsaharienne (42 Md pour les petits exploitants + 75 Md pour les agri-PME). *(IFC 2023 — primaire)*
- Les agtech qui monétisent le font souvent en **connectant les agriculteurs au crédit, aux intrants et aux marchés** (la data agronomique sert de socle de credit-scoring), pas en vendant du conseil seul. *(Briter, IFC)*

**Pistes de monétisation pour Okko (par ordre de réalisme) :**

1. **B2B2F via coopératives/techniciens** : licence/abonnement payé par l'organisation qui équipe ses agriculteurs (aligné sur le public le plus adoptant).
2. **API de la Base de connaissances** (vision long terme du porteur, validée) : vendre l'accès structuré au savoir agronomique + données agrégées à d'autres agtech, assureurs, prêteurs, ONG.
3. **Data pour le credit-scoring / assurance indicielle** : les données de suivi de production ont une valeur directe pour le financement agricole (le plus gros marché).
4. **Freemium** : socle de connaissances gratuit (adoption + effet réseau), modules avancés (diagnostic IA, analytics) payants.

> **Implication n°5** : la stratégie « Base de connaissances → API → IA » du porteur est **cohérente avec le marché**. L'actif monétisable n'est pas l'app, c'est **la donnée agronomique et de production que personne d'autre n'accumule**. D'où l'importance de bien concevoir le socle et le carnet dès le départ pour que la donnée soit propre, structurée et réutilisable.

---

## 10. Principes directeurs (non négociables)

1. **Offline-first.** La connectivité rurale est une barrière prouvée. L'app doit fonctionner sans réseau et synchroniser quand elle peut.
2. **Médiation humaine, pas contre elle.** Le technicien/coopérative est un utilisateur de premier rang.
3. **Une culture à la fois, en profondeur.** Mieux vaut une fiche maïs irréprochable que 50 fiches creuses.
4. **Traçabilité des conseils.** Toujours pouvoir répondre « pourquoi ce conseil ». Pas de boîte noire.
5. **Pas de promesse de rendement non prouvée.** Crédibilité avant marketing.
6. **Donnée propre dès le jour 1.** Le socle et le carnet sont conçus pour que la donnée soit un actif API/IA réutilisable.
7. **Respect de l'environnement.** La lutte durable/agroécologique est au cœur, pas une option.
8. **Protection des données** des agriculteurs (barrière et enjeu de confiance identifiés).

---

## 11. Feuille de route brique par brique

| Phase | Livrable | Pourquoi maintenant |
|---|---|---|
| **0 (premier périmètre)** | **Base de connaissances + back-office admin** : créer une culture, renseigner tous les champs (§5), agréger les sources ouvertes (§6). Une culture pilote de bout en bout. | C'est le socle. Rien ne fonctionne sans lui. Faisable, mesurable, et il crée l'actif central. |
| **1** | **Carnet de suivi de production** (consomme la Base, produit des reco datées) | Génère la donnée terrain et l'usage réel. A besoin que la Base existe. |
| **2** | **Diagnostic IA** (affiné sur images de champ + photos du carnet) | A besoin des données de la phase 1. Coûteux, à ne pas anticiper. |
| **3** | **API publique de la Base + analytics** | Monétisation. A besoin d'une base mature et de données de production. |
| **4** | **Module élevage** | Nouveau domaine. Réutilise l'architecture éprouvée. |

---

## 12. Prochaine étape immédiate

Cadrer le **premier périmètre (Phase 0)** : la Base de connaissances avec son back-office admin. Questions à trancher dans le spec dédié :
- La culture pilote et la zone géographique.
- Le modèle de données précis de la fiche culture (champs, types, unités, multilinguisme).
- Quelles sources ouvertes on intègre dès la v1 vs. saisie manuelle.
- Le socle technique (offline-first, stack).
- Les rôles (admin/expert, technicien, agriculteur) et le périmètre exact de la v1 (probablement : admin + consultation, le suivi vient en Phase 1).

---

## Sources (vérifiées, primaires sauf mention)

**Paysage & adoption**
- Ofosu-Ampong 2025 — *Digital agro-advisory tools in the Global South* — https://link.springer.com/article/10.1007/s44279-025-00190-y
- Gatti 2026 — *Socio-technical fit of digital ag platforms* — https://www.sciencedirect.com/science/article/pii/S0743016726002123
- Brookings — *Digital solutions in agriculture* (⚠️ claim +25 % réfuté) — https://www.brookings.edu/articles/digital-solutions-in-agriculture-drive-meaningful-livelihood-improvements-for-african-smallholder-farmers/

**Modélisation fiche culture**
- FAO ECOCROP — https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en
- GAEZ v4 Model Documentation — https://www.gaez.iiasa.ac.at/docs/GAEZ_Model_Documentation.pdf
- FAO Crop Calendar (dataset) — https://data.apps.fao.org/catalog/dataset/crop-calendar-by-country-crop-activity-and-stage
- HarvestStat Africa (574 204 rendements) — https://www.nature.com/articles/s41597-025-05001-z

**Sources de données ouvertes**
- iSDAsoil — https://www.isda-africa.com/isdasoil/open-soil-data/
- Open-Meteo (⚠️ non commercial) — https://open-meteo.com/en/docs
- CHIRPS (Digital Earth Africa) — https://registry.opendata.aws/deafrica-chirps/
- FAO GIEWS FPMA (prix) — https://www.fao.org/giews/food-prices/price-tool/en/

**IA diagnostic**
- FieldPlant (images de champ) — https://www.researchgate.net/publication/369642460_FieldPlant_A_dataset_of_field_plant_images_for_plant_disease_detection_and_classification_with_deep_learning
- PlantVillage Nuru / manioc 65-93 % — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7775399/
- Plant disease detection review — https://link.springer.com/article/10.1186/s13007-025-01450-0

**Économie & monétisation**
- IFC 2023 — *Scaling up farmer financing through agtechs in SSA* (déficit 117 Md USD) — https://www.ifc.org/content/dam/ifc/doc/2024/scaling-up-farmer-financing-through-agtechs-in-sub-saharan-africa-ifc-2023.pdf
- Briter — *How African agtechs monetise* — https://www.briter.co/insights/articles/how-are-african-agtechs-monetising-climate-resilience-for-smallholder-farmers
- NextBillion — *Building a better agtech funding model* — https://nextbillion.net/building-better-agtech-funding-model-africa-three-key-challenges-ecosystems-loss-of-momentum/

**Élevage**
- Frontiers Animal Science 2025 — https://www.frontiersin.org/journals/animal-science/articles/10.3389/fanim.2025.1541838/full
- Livestock Data for Decisions — outils diagnostic — https://livestockdata.org/news/livestock-disease-diagnosis-tools-sub-saharan-africa-guide-whats-out-there
- ILRI — app suivi performance laitière — https://www.ilri.org/news/africa-asia-dairy-genetic-gains-project-launches-mobile-app-track-dairy-animal-performance
- NEPAD — précision pour petits exploitants — https://www.nepad.org/blog/bolstering-africas-precision-agriculture-smallholder-farming

---

*Réserves méthodologiques : le recensement des ~19 outils couvre le « Global South » (plus large que la seule Afrique subsaharienne). ECOCROP est figé depuis 2015. Certaines URL FAO/IIASA renvoient 403 mais les contenus ont été confirmés via miroirs. Aucune affirmation vérifiée ne couvre isolément les limites de PlantVillage en champ ni ses alternatives — l'analyse §7 s'appuie sur la littérature générale et FieldPlant/Nuru. Les données phytosanitaires ouvertes et les données élevage structurées restent des lacunes à explorer.*
