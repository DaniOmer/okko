# Vue client de la fiche — F1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page de consultation lisible (`/crops/[id]/fiche`) de la fiche **publiée**, présentation une colonne, sans contrôle d'édition.

**Architecture :** Admin uniquement, zéro API. Task 1 : un composant de présentation `FicheClientView` (une colonne, toutes les sections, réutilise les helpers existants) + la route `fiche/page.tsx` (lit la fiche publiée via `getCropPublished`, en-tête lecteur, message si non publiée). Task 2 : un lien « Aperçu client → » depuis la fiche admin.

**Tech Stack :** Next.js 14 (App Router, Server Components), TypeScript, Tailwind.

## Global Constraints

- **Zéro changement API** (`getCropPublished` existe). La suite API n'est **pas** touchée.
- **Source = fiche publiée** (figée, 100 % complète grâce à la garde B2). Non publiée / introuvable → **message** « Cette fiche n'est pas encore publiée » (pas un crash / 404 brut).
- **Réutiliser les helpers** existants (`labelOf`, `stageWithRange`, `formatDayMonth`, tri itinéraire + sentinelle « J0 · Semis ») — **aucune logique métier nouvelle**, présentation seulement.
- **Ne pas** modifier `CropReadView`, `/published`, `/versions` (on ajoute seulement un lien sur la fiche admin). Français seulement.
- **Admin** : barrière = `pnpm --filter @okko/admin build` vert + smoke.
- Commits `feat(admin):`. Terminer chaque message par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Racine repo `/Users/scalens_01/Documents/personal-project/okko`.

---

## File Structure

**Task 1 :** `apps/admin/src/app/crops/[id]/FicheClientView.tsx` (nouveau) ; `apps/admin/src/app/crops/[id]/fiche/page.tsx` (nouveau).
**Task 2 :** `apps/admin/src/app/crops/[id]/page.tsx` (lien).

---

## Task 1 : composant `FicheClientView` + route `/fiche`

**Files:**
- Create: `apps/admin/src/app/crops/[id]/FicheClientView.tsx`
- Create: `apps/admin/src/app/crops/[id]/fiche/page.tsx`

**Interfaces:**
- Consumes : `getCropPublished(id): Promise<CropDetail>`, helpers de `@/lib/labels` + `formatDayMonth`.
- Produces : `FicheClientView({ crop }: { crop: CropDetail })`.

- [ ] **Step 1 : Créer `FicheClientView.tsx`** — présentation une colonne (adaptée de `CropReadView`, en sections empilées + Identité + pluviométrie ; prix en jour-mois) :
```tsx
import type { ReactNode } from 'react';
import {
  labelOf, stageWithRange, CYCLE_TYPE_LABELS, SUITABILITY_LABELS, SUSCEPTIBILITY_LABELS,
  PEST_TYPE_LABELS, OPERATION_TYPE_LABELS, INPUT_TYPE_LABELS, CONTROL_CATEGORY_LABELS,
} from '@/lib/labels';
import { formatDayMonth } from '../../../lib/format';
import type { CropDetail } from '../../../lib/api';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold border-b pb-1">{title}</h2>
      <div className="text-sm space-y-1">{children}</div>
    </section>
  );
}

export function FicheClientView({ crop }: { crop: CropDetail }) {
  return (
    <div className="space-y-6">
      <Section title="Identité">
        <p>Famille : {crop.family}</p>
        <p>Type de cycle : {labelOf(CYCLE_TYPE_LABELS, crop.cycleType)}</p>
      </Section>

      <Section title="Variétés">
        <ul className="list-disc pl-5">
          {crop.varieties.map((v) => <li key={v.id}>{v.name.fr}{v.maturityDays ? ` — ${v.maturityDays} j` : ''}</li>)}
        </ul>
      </Section>

      <Section title="Zones de production">
        <ul className="list-disc pl-5">
          {crop.zones.map((z) => <li key={z.zoneId}>{z.zoneName.fr} — <strong>{labelOf(SUITABILITY_LABELS, z.rating)}</strong>{z.justification ? ` (${z.justification})` : ''}</li>)}
        </ul>
      </Section>

      <Section title="Exigences">
        {crop.climatic?.temperature && <p>Température : {crop.climatic.temperature.min}–{crop.climatic.temperature.optimal}–{crop.climatic.temperature.max} {crop.climatic.temperature.unit}</p>}
        {crop.climatic?.rainfall && <p>Pluviométrie : {crop.climatic.rainfall.min}–{crop.climatic.rainfall.optimal}–{crop.climatic.rainfall.max} {crop.climatic.rainfall.unit}</p>}
        {crop.edaphic?.ph && <p>pH du sol : {crop.edaphic.ph.min}–{crop.edaphic.ph.optimal}–{crop.edaphic.ph.max}</p>}
        {crop.edaphic?.texture && <p>Texture : {crop.edaphic.texture}</p>}
      </Section>

      <Section title="Phénologie">
        <ul className="list-disc pl-5">
          {[...crop.phenology].sort((a, b) => a.startDay - b.startDay).map((p) => <li key={p.order}>{p.name.fr} — J{p.startDay} à J{p.endDay}</li>)}
        </ul>
      </Section>

      <Section title="Calendrier & itinéraire technique">
        {crop.croppingWindows.map((w) => {
          const items = [...w.operations, { type: '__SOWING__', label: { fr: '' }, timingDays: 0, inputs: [] }].sort((a, b) => a.timingDays - b.timingDays);
          return (
            <div key={w.id} className="mb-3">
              <p className="font-medium">{w.season}{w.sowingStart ? ` · semis ${formatDayMonth(w.sowingStart)}${w.sowingEnd ? ` → ${formatDayMonth(w.sowingEnd)}` : ''}` : ''}{w.irrigationRequired ? ' · irrigation requise' : ''}</p>
              <ul className="list-disc pl-5">
                {items.map((op, i) => op.type === '__SOWING__'
                  ? <li key={`s${i}`} className="font-medium">J0 · Semis</li>
                  : <li key={i}>J{op.timingDays >= 0 ? '+' : ''}{op.timingDays} — {op.label.fr} ({labelOf(OPERATION_TYPE_LABELS, op.type)})</li>)}
              </ul>
            </div>
          );
        })}
      </Section>

      <Section title="Nutrition">
        <ul className="list-disc pl-5">
          {crop.nutrition.map((n, i) => <li key={i}>{n.nutrient} — {n.amount} {n.unit}{n.stage ? ` (${stageWithRange(n.stage, crop.phenology)})` : ''}</li>)}
        </ul>
      </Section>

      <Section title="Ravageurs & maladies">
        {crop.pests.map((p) => (
          <div key={p.pestId} className="mb-3">
            <p className="font-medium">{p.pestName.fr} — <strong>{labelOf(SUSCEPTIBILITY_LABELS, p.susceptibility)}</strong> ({labelOf(PEST_TYPE_LABELS, p.type)})</p>
            <ul className="list-disc pl-5">
              {p.controlMethods.map((m, i) => <li key={i}>{labelOf(CONTROL_CATEGORY_LABELS, m.category)} : {m.description.fr}</li>)}
            </ul>
            {p.sensitiveStages.length > 0 && <p className="text-xs text-muted-foreground">Stades sensibles : {p.sensitiveStages.map((s) => stageWithRange(s, crop.phenology)).join(', ')}</p>}
          </div>
        ))}
      </Section>

      <Section title="Rendements">
        <ul className="list-disc pl-5">
          {crop.yields.map((y, i) => <li key={i}>{labelOf(INPUT_TYPE_LABELS, y.inputType)} : {y.min}–{y.average}–{y.potential} {y.unit}{y.zoneId ? ` — zone ${crop.zones.find((z) => z.zoneId === y.zoneId)?.zoneName.fr ?? y.zoneId}` : ''}</li>)}
        </ul>
      </Section>

      <Section title="Prix">
        <ul className="list-disc pl-5">
          {crop.prices.map((p) => <li key={p.id}>{p.periodStart === p.periodEnd ? formatDayMonth(p.periodStart) : `${formatDayMonth(p.periodStart)} → ${formatDayMonth(p.periodEnd)}`} — {p.price} {p.unit} @ {p.market}</li>)}
        </ul>
      </Section>
    </div>
  );
}
```
> Vérifier que `CYCLE_TYPE_LABELS` est bien exporté par `@/lib/labels` (il est utilisé dans `page.tsx`). Les champs consommés (`climatic.rainfall`, `edaphic.texture`, `yields.inputType`, `prices.periodStart/End`, `pests.sensitiveStages`) existent sur `CropDetail` (vérifiés).

- [ ] **Step 2 : Créer `fiche/page.tsx`** — `apps/admin/src/app/crops/[id]/fiche/page.tsx` :
```tsx
import Link from 'next/link';
import { getCropPublished } from '../../../../lib/api';
import { labelOf, CYCLE_TYPE_LABELS } from '@/lib/labels';
import { FicheClientView } from '../FicheClientView';

export default async function FicheClientPage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) {
    return (
      <main className="p-8 max-w-2xl mx-auto space-y-4">
        <Link href={`/crops/${params.id}`} className="text-sm text-primary hover:underline">← Retour</Link>
        <p className="text-muted-foreground">Cette fiche n&apos;est pas encore publiée.</p>
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
      <Link href={`/crops/${params.id}`} className="text-xs text-muted-foreground hover:underline">← Retour à l&apos;administration</Link>
    </main>
  );
}
```
> Vérifier le chemin d'import de `getCropPublished` depuis `fiche/page.tsx` (`../../../../lib/api`) et de `FicheClientView` (`../FicheClientView`) — la page est un niveau plus profond que `page.tsx`.

- [ ] **Step 3 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert (nouvelle route `/crops/[id]/fiche` compilée).

- [ ] **Step 4 : Commit**
```bash
git add apps/admin/src/app/crops/\[id\]/FicheClientView.tsx apps/admin/src/app/crops/\[id\]/fiche/page.tsx
git commit -m "feat(admin): vue client de la fiche publiée (/crops/:id/fiche, une colonne)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : lien « Aperçu client → » depuis la fiche admin

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/page.tsx`

**Interfaces:**
- Consumes : la route `/crops/[id]/fiche` (Task 1).

- [ ] **Step 1 : Ajouter le lien** — dans `apps/admin/src/app/crops/[id]/page.tsx`, dans le bloc existant `{crop.hasPublishedVersion && ( … )}` (qui contient déjà « Historique des versions → »), ajouter à côté :
```tsx
<Link href={`/crops/${params.id}/fiche`} className="text-sm text-primary hover:underline">Aperçu client →</Link>
```
> Si le bloc ne contient qu'un seul `<Link>`, l'envelopper avec le nouveau dans un conteneur flex (`<div className="flex gap-3">…</div>`) pour éviter deux liens collés — au choix, sans casser le build. Ne rien changer d'autre.

- [ ] **Step 2 : Build.** Run: `pnpm --filter @okko/admin build` — Expected: vert.

- [ ] **Step 3 : Smoke manuel** (à rapporter, non bloquant ; DB à repeupler). Publier une fiche complète → depuis la fiche admin, « Aperçu client → » ouvre `/crops/[id]/fiche` : toutes les sections en une colonne, lisibles, sans contrôle d'édition ; une fiche non publiée sur `/fiche` → message « pas encore publiée ».

- [ ] **Step 4 : Commit**
```bash
git add apps/admin/src/app/crops/\[id\]/page.tsx
git commit -m "feat(admin): lien Aperçu client depuis la fiche

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes de vérification finale (revue de branche)

- Route `/crops/[id]/fiche` lit la fiche **publiée** ; message propre si non publiée.
- `FicheClientView` : 10 sections en une colonne, ordre agronomique, sans édition ; réutilise `labelOf`/`stageWithRange`/`formatDayMonth` + tri itinéraire + « J0 · Semis ».
- Lien « Aperçu client → » présent (si publiée) ; `CropReadView`/`/published`/`/versions` inchangés ; zéro API ; build admin vert.

## Self-review (couverture spec)

- §4.1 route (source publiée, en-tête, message non publiée) → Task 1 Step 2. ✅
- §4.2 `FicheClientView` (10 sections, une colonne, helpers) → Task 1 Step 1. ✅
- §4.3 lien depuis la fiche admin → Task 2. ✅
- §3 hors périmètre (API, /published inchangé) → Global Constraints + Notes. ✅
- §6 vérification (build + smoke) → Task 1 Step 3, Task 2 Steps 2-3. ✅
