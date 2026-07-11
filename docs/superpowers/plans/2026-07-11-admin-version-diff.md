# Admin — vue de diff entre versions (Lot C-admin D2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher dans l'admin le diff sémantique entre deux versions publiées — page `/crops/[id]/diff` avec deux sélecteurs De/À, rendu labellé (champs + sections ajoutés/supprimés/modifiés).

**Architecture :** Aucun changement back-end — on consomme `GET /crops/:id/diff?from=A&to=B` (C3). On étend le client (`getCropDiff` + types), on ajoute une route Server Component `/crops/[id]/diff` (lit `searchParams`) qui rend un composant client `VersionSelectors` (navigation par URL) et un composant présentiel `CropDiffView` (rendu labellé), et un lien depuis la page des versions.

**Tech Stack :** Next.js 14 (App Router, Server Components), TypeScript, Tailwind, shadcn/ui (`Select`).

## Global Constraints

- **Aucun changement back-end** : l'endpoint C3 `GET /crops/:id/diff?from=A&to=B` est mergé.
- **Pas de framework de test admin** : barrière de vérif = **`pnpm --filter @okko/admin build`** vert (compile + typecheck) + smoke manuel décrit (non bloquant, à rapporter ; l'app live n'est pas lancée par l'implémenteur).
- **Réutiliser l'existant** : `getCropVersions`/`CropVersion` (D1), helper `readError`, `BASE`, shadcn `Select` (`Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, motif `value`+`onValueChange`), liens `className="text-sm text-primary hover:underline"`.
- **Rendu labellé** : champs `libellé : avant → après` (scalaires) ou blocs `<pre>` (complexes) ; sections en groupes **Ajoutés** (vert) / **Supprimés** (rouge) / **Modifiés** (libellé + avant/après) ; libellé d'item via `itemLabel`.
- **Hors périmètre** : rendu riche par item, diff des sous-champs, changement back-end, framework de test.
- Copie UI en français. Commits `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Toutes les commandes depuis la racine du repo `/Users/scalens_01/Documents/personal-project/okko` ; éditions sous `apps/admin/`.

---

## File Structure

**Modifiés :**
- `apps/admin/src/lib/api.ts` — types `CropDiff`/`SectionDiff`/`FieldChange`/`ItemChange` + `getCropDiff`.
- `apps/admin/src/app/crops/[id]/versions/page.tsx` — lien « Comparer les versions → ».

**Créés :**
- `apps/admin/src/app/crops/[id]/diff/CropDiffView.tsx` — rendu présentiel du diff.
- `apps/admin/src/app/crops/[id]/diff/VersionSelectors.tsx` — deux `Select` client.
- `apps/admin/src/app/crops/[id]/diff/page.tsx` — page (searchParams + défauts).

---

## Task 1 : Client API — diff

**Files:**
- Modify: `apps/admin/src/lib/api.ts`

**Interfaces:**
- Produces : `FieldChange`, `ItemChange`, `SectionDiff`, `CropDiff` ; `getCropDiff(id, from, to): Promise<CropDiff>`.

- [ ] **Step 1 : Ajouter les types + la fonction** dans `api.ts`, après les fonctions versions (`getCropVersions`/`getCropVersion`/`restoreVersion`) ajoutées en D1 (`BASE`, `readError` déjà définis) :
```ts
export interface FieldChange { field: string; before: unknown; after: unknown; }
export interface ItemChange { key: string; before: unknown; after: unknown; }
export interface SectionDiff { section: string; added: unknown[]; removed: unknown[]; changed: ItemChange[]; }
export interface CropDiff {
  cropId: string;
  from: number;
  to: number;
  fields: FieldChange[];
  sections: SectionDiff[];
}

export async function getCropDiff(id: string, from: number, to: number): Promise<CropDiff> {
  const res = await fetch(`${BASE}/crops/${id}/diff?from=${from}&to=${to}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
```

- [ ] **Step 2 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (rien ne consomme encore ; valide la compilation TS).

- [ ] **Step 3 : Commit**
```bash
git add apps/admin/src/lib/api.ts
git commit -m "feat(admin): client API diff (getCropDiff + types CropDiff)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Composant de rendu `CropDiffView`

**Files:**
- Create: `apps/admin/src/app/crops/[id]/diff/CropDiffView.tsx`

**Interfaces:**
- Consumes : `CropDiff`, `FieldChange`, `SectionDiff` (Task 1).
- Produces : `CropDiffView({ diff: CropDiff })` (composant présentiel, pas de `'use client'`).

- [ ] **Step 1 : Créer `CropDiffView.tsx`** :
```tsx
import { CropDiff, FieldChange, SectionDiff } from '../../../../lib/api';

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom', scientificName: 'Nom scientifique', family: 'Famille', cycleType: 'Type de cycle',
  climatic: 'Exigences climatiques', edaphic: 'Exigences édaphiques', metadata: 'Métadonnées',
  phenology: 'Phénologie', nutrition: 'Nutrition', yields: 'Rendement',
};

const SECTION_LABELS: Record<string, string> = {
  varieties: 'Variétés', zones: 'Zones', croppingWindows: 'Fenêtres de production',
  pests: 'Ravageurs & maladies', prices: 'Prix',
};

function isScalar(v: unknown): boolean {
  return typeof v === 'string' || typeof v === 'number';
}

function itemLabel(section: string, item: unknown): string {
  const it = (item ?? {}) as Record<string, any>;
  switch (section) {
    case 'varieties': return it.name?.fr ?? String(it.id ?? '?');
    case 'zones': return it.zoneName?.fr ?? String(it.zoneId ?? '?');
    case 'pests': return it.pestName?.fr ?? String(it.pestId ?? '?');
    case 'prices': return `${it.market ?? '?'} — ${it.date ?? '?'}`;
    case 'croppingWindows': return it.season ?? String(it.id ?? '?');
    default: return String(it.id ?? '?');
  }
}

function Json({ value }: { value: unknown }) {
  return <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
}

function BeforeAfter({ before, after }: { before: unknown; after: unknown }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <div><div className="text-xs text-muted-foreground">avant</div><Json value={before} /></div>
      <div><div className="text-xs text-muted-foreground">après</div><Json value={after} /></div>
    </div>
  );
}

function FieldRow({ change }: { change: FieldChange }) {
  const label = FIELD_LABELS[change.field] ?? change.field;
  if (isScalar(change.before) && isScalar(change.after)) {
    return <li><strong>{label}</strong> : {String(change.before)} → {String(change.after)}</li>;
  }
  return (
    <li className="space-y-1">
      <strong>{label}</strong>
      <BeforeAfter before={change.before} after={change.after} />
    </li>
  );
}

function SectionBlock({ diff }: { diff: SectionDiff }) {
  const label = SECTION_LABELS[diff.section] ?? diff.section;
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{label}</h3>
      {diff.added.length > 0 && (
        <div>
          <div className="text-sm font-medium text-green-700">Ajoutés</div>
          <ul className="list-disc pl-5 text-sm text-green-700">
            {diff.added.map((it, i) => <li key={i}>{itemLabel(diff.section, it)}</li>)}
          </ul>
        </div>
      )}
      {diff.removed.length > 0 && (
        <div>
          <div className="text-sm font-medium text-red-700">Supprimés</div>
          <ul className="list-disc pl-5 text-sm text-red-700">
            {diff.removed.map((it, i) => <li key={i}>{itemLabel(diff.section, it)}</li>)}
          </ul>
        </div>
      )}
      {diff.changed.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Modifiés</div>
          {diff.changed.map((c, i) => (
            <div key={i} className="space-y-1">
              <div className="text-sm font-medium">{itemLabel(diff.section, c.before)}</div>
              <BeforeAfter before={c.before} after={c.after} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CropDiffView({ diff }: { diff: CropDiff }) {
  if (diff.fields.length === 0 && diff.sections.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune différence entre ces deux versions.</p>;
  }
  return (
    <div className="space-y-6">
      {diff.fields.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Champs modifiés</h2>
          <ul className="space-y-2 text-sm">
            {diff.fields.map((f, i) => <FieldRow key={i} change={f} />)}
          </ul>
        </div>
      )}
      {diff.sections.map((s) => <SectionBlock key={s.section} diff={s} />)}
    </div>
  );
}
```
> Composant présentiel (pas de `'use client'`, pas de hooks) → utilisable depuis un Server Component. Chemin `../../../../lib/api` depuis `src/app/crops/[id]/diff/CropDiffView.tsx` = `src/lib/api` (4 niveaux).

- [ ] **Step 2 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (le composant compile ; il n'est pas encore monté par une route).

- [ ] **Step 3 : Commit**
```bash
git add apps/admin/src/app/crops/[id]/diff/CropDiffView.tsx
git commit -m "feat(admin): CropDiffView — rendu labellé du diff (champs + sections ajout/suppr/modif)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Page de diff + sélecteurs + lien

**Files:**
- Create: `apps/admin/src/app/crops/[id]/diff/VersionSelectors.tsx`
- Create: `apps/admin/src/app/crops/[id]/diff/page.tsx`
- Modify: `apps/admin/src/app/crops/[id]/versions/page.tsx`

**Interfaces:**
- Consumes : `getCropVersions`/`CropVersion` (D1), `getCropDiff` (Task 1), `CropDiffView` (Task 2), shadcn `Select`.

- [ ] **Step 1 : Créer `VersionSelectors.tsx`** (Client Component) :
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { CropVersion } from '../../../../lib/api';

export function VersionSelectors({ cropId, versions, from, to }: { cropId: string; versions: CropVersion[]; from: number; to: number }) {
  const router = useRouter();
  const go = (nextFrom: number, nextTo: number) => router.push(`/crops/${cropId}/diff?from=${nextFrom}&to=${nextTo}`);
  return (
    <div className="flex items-end gap-4">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">De</div>
        <Select value={String(from)} onValueChange={(v) => go(Number(v), to)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {versions.map((v) => <SelectItem key={v.revision} value={String(v.revision)}>v{v.revision} — {v.publishedBy}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">À</div>
        <Select value={String(to)} onValueChange={(v) => go(from, Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {versions.map((v) => <SelectItem key={v.revision} value={String(v.revision)}>v{v.revision} — {v.publishedBy}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```
> Chemin `../../../../lib/api` (4 niveaux). Motif `Select` copié de `src/app/crops/new/page.tsx`.

- [ ] **Step 2 : Créer `diff/page.tsx`** (Server Component) :
```tsx
import Link from 'next/link';
import { getCropVersions, getCropDiff } from '../../../../lib/api';
import { VersionSelectors } from './VersionSelectors';
import { CropDiffView } from './CropDiffView';

export default async function CropDiffPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { from?: string; to?: string } }) {
  const versions = await getCropVersions(params.id).catch(() => []);
  const back = (
    <Link href={`/crops/${params.id}/versions`} className="text-sm text-primary hover:underline">← Retour aux versions</Link>
  );

  if (versions.length < 2) {
    return (
      <main className="p-8 max-w-4xl space-y-4">
        {back}
        <h1 className="text-2xl font-bold">Comparer les versions</h1>
        <p className="text-sm text-muted-foreground">Il faut au moins deux versions publiées pour comparer.</p>
      </main>
    );
  }

  const to = searchParams.to ? Number(searchParams.to) : versions[0].revision;
  const from = searchParams.from ? Number(searchParams.from) : versions[1].revision;
  const diff = await getCropDiff(params.id, from, to).catch(() => null);

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="space-y-2">
        {back}
        <h1 className="text-2xl font-bold">Comparer les versions</h1>
      </div>
      <VersionSelectors cropId={params.id} versions={versions} from={from} to={to} />
      {diff
        ? <CropDiffView diff={diff} />
        : <p className="text-sm text-destructive">Impossible de comparer ces révisions.</p>}
    </main>
  );
}
```
> Chemin `../../../../lib/api` (4 niveaux). `versions[0]` = révision la plus récente (l'API trie décroissant).

- [ ] **Step 3 : Lien depuis la page des versions** — dans `apps/admin/src/app/crops/[id]/versions/page.tsx`, dans l'en-tête (le bloc `<div className="space-y-1">` avec le lien retour + `<h1>Versions publiées</h1>`), ajouter, après le `<h1>` :
```tsx
        {versions.length >= 2 && (
          <Link href={`/crops/${params.id}/diff`} className="text-sm text-primary hover:underline">
            Comparer les versions →
          </Link>
        )}
```
> `Link` est déjà importé dans ce fichier (D1). Lire l'en-tête pour placer le lien dans le même bloc que le `<h1>`.

- [ ] **Step 4 : Build.**

Run: `pnpm --filter @okko/admin build`
Expected: build **vert** (route `/crops/[id]/diff` compile).

- [ ] **Step 5 : Smoke manuel** (à rapporter). API sur `:3001` + `pnpm --filter @okko/admin dev` : publier une culture 2× (avec une édition entre) → `/crops/[id]/versions` → « Comparer les versions → » → page diff (De/À = avant-dernière → dernière) montrant le champ changé (`Nom : … → …`) + items de section ajout/suppr/modif ; changer un sélecteur recharge le diff (URL mise à jour) ; deux fois la même révision → « Aucune différence ».

- [ ] **Step 6 : Commit**
```bash
git add apps/admin/src/app/crops/[id]/diff/VersionSelectors.tsx apps/admin/src/app/crops/[id]/diff/page.tsx apps/admin/src/app/crops/[id]/versions/page.tsx
git commit -m "feat(admin): page de diff entre versions (sélecteurs De/À + lien depuis les versions)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- **Diff cliquable** : versions → « Comparer les versions → » → page avec sélecteurs De/À → rendu labellé (champs + sections colorées ajout/suppr/modif).
- **Sélecteurs** : navigation par URL (`?from=&to=`), défauts avant-dernière → dernière, révisions arbitraires.
- **Cas limites** : < 2 versions (message) ; révision invalide (message d'erreur) ; `from==to` (« Aucune différence »).
- **Zéro back-end** ; `pnpm --filter @okko/admin build` vert ; rendu riche/sous-champs non inclus.
