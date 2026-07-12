# Spec — Vue client de la fiche — F1

**Projet** : Okko — admin (Next.js) uniquement
**Date** : 2026-07-12
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Offrir une **page de consultation lisible** de la fiche **publiée**, orientée lecteur (technicien / coopérative), distincte de l'aperçu admin. Présentation **une colonne**, sans contrôle d'édition, dans l'ordre agronomique.

Référence backlog : `docs/2026-07-11-backlog-retours-usage.md` (§F1).

## 2. Contexte (vérifié)

- La fiche publiée (figée) est lue via `getCropPublished(id): Promise<CropDetail>` (existant). Grâce à la garde B2, une fiche publiée est **100 % complète** → toutes les sections sont remplies.
- `CropDetail` porte : `name`, `scientificName`, `family`, `cycleType`, `publishedVersion`, `climatic?`, `edaphic?`, `varieties`, `zones`, `phenology`, `croppingWindows`, `pests`, `nutrition`, `yields`, `prices`, `hasPublishedVersion`.
- La page `/crops/[id]/published` existe déjà (aperçu **admin** figé, via `CropReadView` en grille 2 colonnes, avec « ← Retour au brouillon ») — **conservée telle quelle**.
- La fiche admin (`crops/[id]/page.tsx`) a déjà un bloc `{crop.hasPublishedVersion && (…)}` (lien « Historique des versions → ») où ajouter le lien vue client.
- Helpers existants réutilisables : `labelOf`, `stageWithRange`, `formatDayMonth`, et la logique de tri d'itinéraire + sentinelle « J0 · Semis » (D1).
- **Décisions brainstorming** : nouvelle route `/crops/[id]/fiche` (garder `/published`) ; **mise en page une colonne** ; français seulement.

## 3. Périmètre

### Dans le lot (admin seulement)
- Nouvelle route `apps/admin/src/app/crops/[id]/fiche/page.tsx` (lit la fiche **publiée**).
- Nouveau composant `FicheClientView` (présentation une colonne, toutes sections).
- Lien « Aperçu client → » depuis la fiche admin (si publiée).

### Hors périmètre
- **Zéro changement API** (`getCropPublished` existe).
- Accès **public / sans authentification** → Phase 3 (API).
- Sélecteur **multilingue** (fr seulement) ; export **PDF** / impression avancée.
- Refonte de `CropReadView` ou de `/published`.

### Comportement préservé
- `/published`, `/versions`, la fiche admin : inchangés (on ajoute seulement un lien).
- Autres pages : inchangées.

## 4. Architecture — Admin

### 4.1 Route `fiche/page.tsx`
```tsx
export default async function FicheClientPage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) {
    // fiche non publiée (ou introuvable)
    return (
      <main className="p-8 max-w-2xl mx-auto space-y-4">
        <Link href={`/crops/${params.id}`} className="text-sm text-primary hover:underline">← Retour</Link>
        <p className="text-muted-foreground">Cette fiche n'est pas encore publiée.</p>
      </main>
    );
  }
  return (
    <main className="p-8 max-w-2xl mx-auto space-y-6">
      <header className="space-y-1 border-b pb-4">
        <h1 className="text-3xl font-bold">{crop.name} <em className="text-lg font-normal text-muted-foreground">{crop.scientificName}</em></h1>
        <p className="text-sm text-muted-foreground">{crop.family} · {labelOf(CYCLE_TYPE_LABELS, crop.cycleType)} · v{crop.publishedVersion}</p>
      </header>
      <FicheClientView crop={crop} />
      <Link href={`/crops/${params.id}`} className="text-xs text-muted-foreground hover:underline">← Retour à l'administration</Link>
    </main>
  );
}
```
- `getCropPublished` renvoie `null` (catch) si la fiche n'est pas publiée → message dédié (pas un 404 brut).

### 4.2 Composant `FicheClientView`
Nouveau composant `apps/admin/src/app/crops/[id]/FicheClientView.tsx` : props `{ crop: CropDetail }`. Rend une **suite de sections empilées** (une colonne), chacune avec un titre (ex. `<h2 className="text-lg font-semibold border-b pb-1">`) puis le contenu. Ordre :
1. **Identité** — Famille, type de cycle (rappel structuré ; l'en-tête a déjà nom + scientifique).
2. **Variétés** — liste `{name.fr} — {maturityDays} j` (+ traits si présents).
3. **Zones de production** — `{zoneName.fr} — {rating}` (+ justification).
4. **Exigences** — climatiques (température, pluviométrie) + édaphiques (pH…).
5. **Phénologie** — stades `{name.fr} — J{startDay}–J{endDay}` (tri par `order`/`startDay`).
6. **Calendrier & itinéraire technique** — par fenêtre : saison, semis `formatDayMonth(sowingStart) → formatDayMonth(sowingEnd)`, irrigation, puis l'**itinéraire trié** (opérations + sentinelle « J0 · Semis », triés par `timingDays`) au format « J{±n} — {label.fr} ({type}) ».
7. **Nutrition** — `{nutrient} — {amount} {unit}` + `({stageWithRange(stage, crop.phenology)})` si stade.
8. **Ravageurs & maladies** — `{pestName.fr} — {susceptibility} ({type})`, méthodes de lutte, et « stades sensibles : {stageWithRange…} » si présents.
9. **Rendements** — `{inputType} : {min}–{average}–{potential} {unit}` + « zone {nom} » si `zoneId`.
10. **Prix** — `{période jour-mois}` — `{price} {unit} @ {market}`.

Réutilise `labelOf` + les maps de libellés, `stageWithRange`, `formatDayMonth`, et la sentinelle d'itinéraire (mêmes calculs que `page.tsx`/`CropReadView`). **Aucune logique métier nouvelle** — présentation seulement. Les sections vides (cas théorique, fiche complète) s'affichent gracieusement (rien / « — »).

### 4.3 Lien depuis la fiche admin
Dans `crops/[id]/page.tsx`, dans le bloc `{crop.hasPublishedVersion && (…)}` existant, ajouter à côté du lien « Historique des versions → » :
```tsx
<Link href={`/crops/${params.id}/fiche`} className="text-sm text-primary hover:underline">Aperçu client →</Link>
```

## 5. Gestion d'erreur
- Fiche non publiée / introuvable → message « Cette fiche n'est pas encore publiée » (pas un crash). Sections vides → rendu gracieux.

## 6. Vérification
- **Admin** : `pnpm --filter @okko/admin build` vert + smoke : publier une fiche complète → `/crops/[id]/fiche` affiche toutes les sections en une colonne, lisible ; fiche non publiée → message ; lien « Aperçu client → » présent sur la fiche publiée.
- **Zéro API** → suite API non touchée.

## 7. Critères de succès
- [ ] Route `/crops/[id]/fiche` lit la fiche publiée ; message si non publiée.
- [ ] `FicheClientView` : les 10 sections en une colonne, ordre agronomique, sans contrôle d'édition ; réutilise les helpers.
- [ ] Lien « Aperçu client → » depuis la fiche admin (si publiée).
- [ ] `next build` vert ; zéro API ; `/published` et le reste inchangés.

## Références
- Backlog : `docs/2026-07-11-backlog-retours-usage.md` (§F1).
- Admin : `src/app/crops/[id]/fiche/page.tsx` (nouveau), `src/app/crops/[id]/FicheClientView.tsx` (nouveau), `src/app/crops/[id]/page.tsx` (lien), `src/lib/api.ts` (`getCropPublished`, `CropDetail`), `src/lib/labels.ts`, `src/lib/format.ts`.
- Modèle de présentation existant : `src/app/crops/[id]/CropReadView.tsx` (pour la logique de rendu des sections — à adapter en une colonne).
