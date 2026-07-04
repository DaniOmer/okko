# Spec — Refonte du back-office admin (shadcn/ui, app shell, modales, thème)

**Projet** : Okko — back-office de la base de connaissances
**Date** : 2026-07-04
**Statut** : spec à valider avant plan d'implémentation

---

## 1. Objectif

Refondre le design du back-office admin : adopter **shadcn/ui**, ajouter un **app shell** (sidebar verte + header avec recherche fonctionnelle, cloche de notifications décorative, bascule de thème, avatar), convertir les **formulaires d'édition inline en modales**, restyler toutes les pages, en **clair + sombre** et **responsive**. Aucun changement backend.

Direction visuelle validée par maquettes : **disposition A** (sidebar verte pleine + header blanc épuré), **thème vert agri clair par défaut + bascule sombre**, **modales shadcn Dialog** pour l'édition.

## 2. Périmètre

### Dans le lot
- **Setup shadcn/ui** : `components.json`, thème par variables CSS (palette vert agri, tokens clair + sombre), utilitaire `cn`, composants générés (Button, Input, Select, Dialog, Card, Table, Badge, Label, Sheet).
- **App shell** (`layout.tsx` + composants) : sidebar de navigation (Cultures, Zones, Ravageurs, Historique) + header (recherche, cloche décorative avec badge, toggle thème, avatar). **Responsive** : la sidebar se replie en tiroir (`Sheet`) sous un menu ☰ sur mobile.
- **Thème clair/sombre** via `next-themes` (classe `dark` + variables CSS), préférence mémorisée, toggle dans le header.
- **Recherche fonctionnelle** : l'input du header filtre la liste des cultures (voir §5).
- **Édition en modales** : le composant `EditorShell` passe d'un formulaire inline à une **`Dialog` shadcn** (déclencheur = `Button`, contenu = `DialogContent`). Les 11 éditeurs existants sont conservés ; seuls leur habillage (Input/Select/Button shadcn) et le shell changent.
- **Restyle des pages** : `/crops` (Table + Badge statut + complétude + recherche), `/crops/[id]` (Cards par section + anneau de complétude + Dialog editors + historique), `/zones`, `/pests`, `/crops/new`, `/zones/new`, `/pests/new` (formulaires en Card).

### Hors périmètre
- Aucun changement backend ; pas de nouvel endpoint (la cloche de notifications est **décorative**, sans données).
- Recherche multi-entités (zones/ravageurs) : ce lot filtre les **cultures** ; extension future.
- Édition/suppression des lignes déjà persistées (variétés/prix/fenêtres/zones/ravageurs) : reste hors périmètre comme dans le lot précédent (l'API n'a pas de DELETE).
- Fonctionnalité réelle des notifications : différée (pas de backend).

## 3. Dépendances (nouvelles, assumées)

shadcn/ui n'est pas une dépendance runtime unique mais génère du code s'appuyant sur : `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-label`, `class-variance-authority`, `clsx`, `tailwind-merge`, `next-themes`. `lucide-react` est déjà présent. Ces ajouts sont **assumés** (le choix de shadcn les implique) — c'est la seule dérogation à la règle « pas de dépendance nouvelle » des lots précédents.

## 4. Architecture

- **shadcn/ui** installé dans `apps/admin` : `npx shadcn@latest init` (style « new-york » ou « default », base color personnalisée), génère `components.json`, met à jour `tailwind.config.ts` (tokens via CSS variables) et `globals.css` (les variables `--background`, `--primary`, etc. en `:root` clair et `.dark`). La palette `--primary` est calée sur le vert (`green-600/700`).
- **App shell** :
  - `layout.tsx` enveloppe l'app dans `<ThemeProvider>` (next-themes) puis un composant serveur `AppShell` (sidebar + header + `{children}`).
  - `Sidebar` : composant (majoritairement statique) listant les liens ; l'élément actif est mis en évidence côté client (`usePathname`).
  - `Header` : Client Component (recherche + toggle thème + cloche décorative + avatar).
  - **Responsive** : sur mobile, la sidebar devient un `Sheet` déclenché par un bouton ☰ dans le header ; en desktop elle est fixe.
- **Thème** : `next-themes` `ThemeProvider` (attribute `class`), un `ThemeToggle` (Client) dans le header bascule `light`/`dark`.
- **Édition en modales** : `EditorShell` refactoré — expose toujours le contrat render-prop `{ submit, close, busy }` mais rend une `Dialog` (trigger `Button` avec le `label`, `DialogContent` avec titre + le formulaire de l'éditeur + `DialogFooter` Annuler/Enregistrer). Les 11 éditeurs changent peu : leurs `<input>`/`<select>`/`<button>` deviennent `Input`/`Select`/`Button` shadcn, et l'erreur s'affiche dans le `DialogContent`. Le succès ferme la modale + `router.refresh()`.

## 5. Recherche fonctionnelle (data flow)

Le header étant global, la recherche **navigue vers la liste filtrée** plutôt que de filtrer une page arbitraire :
- Le `Header` (Client) tient un input ; à la soumission / au typing (débounce léger), il fait `router.push('/crops?q=' + encodeURIComponent(term))`.
- La page `/crops` (Server Component) lit `searchParams.q` et **filtre côté serveur** la liste (`listCrops()`) sur `name` + `scientificName` (insensible à la casse). Champ vide → liste complète.
- SSR-friendly, pas d'état global, partageable par URL.

## 6. Composants & fichiers

```
apps/admin/
├── components.json                     # NEW (shadcn config)
├── tailwind.config.ts                  # MODIFY (CSS-variable tokens)
├── src/
│   ├── lib/utils.ts                    # NEW (cn helper)
│   ├── components/
│   │   ├── ui/                          # NEW (shadcn: button, input, select, dialog, card, table, badge, label, sheet)
│   │   ├── app-shell.tsx               # NEW (sidebar + header + children)
│   │   ├── sidebar.tsx                 # NEW
│   │   ├── header.tsx                  # NEW (client: search + theme + bell + avatar + mobile ☰)
│   │   ├── theme-provider.tsx          # NEW (next-themes wrapper)
│   │   └── theme-toggle.tsx            # NEW (client)
│   └── app/
│       ├── globals.css                 # MODIFY (theme CSS variables light/dark)
│       ├── layout.tsx                  # MODIFY (ThemeProvider + AppShell)
│       ├── crops/page.tsx              # MODIFY (Table + Badge + completeness + q filter)
│       ├── crops/[id]/page.tsx         # MODIFY (Card sections + completeness ring)
│       ├── crops/[id]/editors/*        # MODIFY (EditorShell → Dialog; inputs → shadcn)
│       ├── crops/new/page.tsx          # MODIFY (Card form)
│       ├── zones/{page,new/page}.tsx   # MODIFY (styled)
│       └── pests/{page,new/page}.tsx   # MODIFY (styled)
```

## 7. Gestion d'erreur

Inchangée fonctionnellement : chaque modale affiche l'erreur API **inline dans la `Dialog`** (ex. « API 409 » sur double-publication) sans se fermer ni planter la page. Cohérent avec l'`EditorShell` actuel.

## 8. Tests

Conforme au reste de l'app admin (pas de tests unitaires — **le build est la porte**) :
1. `pnpm --filter @okko/admin build` doit réussir (type-check + ESLint, incl. `no-unescaped-entities`).
2. **Vérification manuelle** : naviguer via la sidebar ; basculer clair/sombre ; rechercher une culture depuis le header (→ `/crops?q=`) ; ouvrir chaque modale d'édition, enregistrer, voir la donnée apparaître ; vérifier le responsive (sidebar → tiroir sous ~768px).

## 9. Critères de succès

- [ ] shadcn/ui installé et fonctionnel ; thème vert agri en variables CSS, clair + sombre.
- [ ] App shell : sidebar (nav + actif) + header (recherche, cloche décorative, toggle thème, avatar) sur toutes les pages.
- [ ] Responsive : sidebar repliée en tiroir `Sheet` sous ~768px via ☰.
- [ ] Recherche header → `/crops?q=` filtre la liste (name + scientificName).
- [ ] Les 11 éditeurs s'ouvrent en **modale** ; succès ferme + `router.refresh()` ; erreur inline dans la modale.
- [ ] Pages restylées (crops list en Table, détail en Cards + anneau de complétude, formulaires en Card).
- [ ] `next build` réussit ; aucun changement backend ; l'API (136 tests) reste intacte.

## 10. Notes de périmètre / décomposition

Ce lot est conséquent. Le plan pourra être découpé en **deux sous-plans** si besoin :
- **Fondation** : shadcn init + thème + `cn` + composants `ui/` + app shell (sidebar/header) + theme toggle + recherche.
- **Restyle & modales** : `EditorShell` → Dialog, habillage des 11 éditeurs, restyle des pages.
À trancher au moment d'écrire le plan (un seul plan à tâches groupées est acceptable vu qu'il n'y a pas de backend ni de tests unitaires).

## 11. Questions ouvertes
- Style shadcn : « default » vs « new-york » (proposé : **new-york**, plus compact/pro).
- Toasts de succès (`sonner`) en plus du `router.refresh()` ? (proposé : différé — le refresh suffit ; on pourra ajouter des toasts plus tard.)

---

## Références
- Maquettes validées : `.superpowers/brainstorm/…/content/` (shell-layout A, visual-style clair, visual-style-dark).
- Éditeurs existants : `apps/admin/src/app/crops/[id]/editors/` (Plan « édition en place »).
- shadcn/ui : https://ui.shadcn.com
