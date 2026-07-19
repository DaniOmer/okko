# Refonte des vues de détail d'une culture — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'aperçu client (`fiche`) en page « magazine » soignée et la version publiée (`published`) en grille de cartes dense, avec un kit de présentation partagé (couleurs sémantiques, badges, barres min–optimal–max, frises). Purement présentation — aucune modification API/données.

**Architecture:** Admin Next.js 14 (Server Components + shadcn/ui + Tailwind). Un kit partagé `components/fiche/` (helpers purs + petits composants) consommé par les deux vues, dont les conteneurs de section diffèrent (bloc magazine vs carte). Les pages serveur chargent les référentiels pests/zones pour résoudre les noms.

**Tech Stack:** TypeScript, React, Tailwind, shadcn/ui, `lucide-react`, Vitest.

## Global Constraints

- **Aucune** modification hors `apps/admin`. Pas de changement API/DTO/domaine. Le DTO `CropDetail` (via `getCropPublished`) porte déjà toutes les données.
- **Palette « Vert classique raffiné »** appliquée via un helper, sans toucher le thème global shadcn. Jetons (Tailwind arbitrary values) :
  - good `bg-[#eaf3ea] text-[#245c27]` · warn `bg-[#fef3e2] text-[#b45309]` · bad `bg-[#fdecec] text-[#b91c1c]` · neutral `bg-[#eef1f4] text-[#475569]`.
  - pastilles (dots) : good `bg-[#2e7d32]`, warn `bg-[#d97706]`, bad `bg-[#b91c1c]`, neutral `bg-[#94a1ab]`. Accent barre/optimal `#2e7d32`. Semis (frise) ambre `#b45309`.
- **Sémantique couleur** via `tone(kind, code)` — attention à l'inversion :
  - suitability : `SUITABLE`→good, `MARGINAL`→warn, `UNSUITABLE`→bad.
  - susceptibility : `LOW`→good, `MEDIUM`→warn, `HIGH`→bad.
  - resistance : `HIGH`→good, `MEDIUM`→warn, `LOW`→bad. Inconnu → neutral.
- **Icônes lucide** par section : climatic→`Thermometer`, edaphic→`Mountain`, varieties→`Sprout`, zones→`MapPin`, phenology→`Activity`, windows→`CalendarDays`, pests→`Bug`, nutrition→`FlaskConical`, yields→`Wheat`, prices→`Coins`, commercialization→`ShoppingCart`.
- **Toutes les sections affichées** dans les deux vues ; section vide → texte atténué « Non renseigné ».
- Réutiliser `labelOf` + maps de `lib/labels.ts` (`CYCLE_TYPE_LABELS`, `USAGE_CATEGORY_LABELS`, `SUITABILITY_LABELS`, `SUSCEPTIBILITY_LABELS`, `RESISTANCE_LEVEL_LABELS`, `WATER_NEED_LABELS`, `DROUGHT_SENSITIVITY_LABELS`, `PEST_TYPE_LABELS`, `OPERATION_TYPE_LABELS`, `INPUT_TYPE_LABELS`, `PRODUCT_FORM_LABELS`, `SALE_UNIT_LABELS`, `OUTLET_LABELS`, `stageWithRange`).
- Résolution des noms : `listPests()` → `Pest{id,name}` ; `listZones()` → `Zone{id,name}`. Construire des maps `id→nom` côté page serveur, passées aux vues (repli sur l'id brut).
- **Maquettes de référence** (source de vérité visuelle, sur disque, lisibles par les implémenteurs) :
  - Client : `/Users/scalens_01/Documents/personal-project/okko/.superpowers/brainstorm/91051-1784473427/content/client-A-refined.html`
  - Publiée : `/Users/scalens_01/Documents/personal-project/okko/.superpowers/brainstorm/91051-1784473427/content/published-view.html`
- Chaque commit se termine par : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Kit de présentation partagé (`components/fiche/`)

**Files:**
- Create: `apps/admin/src/components/fiche/fiche-ui.ts`
- Create: `apps/admin/src/components/fiche/fiche-ui.test.ts`
- Create: `apps/admin/src/components/fiche/ToneBadge.tsx`
- Create: `apps/admin/src/components/fiche/RangeBar.tsx`
- Create: `apps/admin/src/components/fiche/Timeline.tsx`
- Create: `apps/admin/src/components/fiche/section-icon.ts`

**Interfaces:**
- Produces (consommés par Task 2 & 3) : `tone(kind, code): Tone`, `Tone`, `TONE_CLASS`, `TONE_DOT`, `optimalPercent(min,optimal,max): number` ; `<ToneBadge tone={Tone}>` ; `<RangeBar label min optimal max unit? />` ; `<Timeline steps={TimelineStep[]} />` avec `TimelineStep = { key, j, label, sowing?, chips? }` ; `SECTION_ICON: Record<string, LucideIcon>`.

- [ ] **Step 1: Écrire le test rouge des helpers.** Créer `fiche-ui.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { tone, optimalPercent } from './fiche-ui';

describe('tone', () => {
  it('suitability', () => {
    expect(tone('suitability', 'SUITABLE')).toBe('good');
    expect(tone('suitability', 'MARGINAL')).toBe('warn');
    expect(tone('suitability', 'UNSUITABLE')).toBe('bad');
  });
  it('susceptibility (peu sensible = bon)', () => {
    expect(tone('susceptibility', 'LOW')).toBe('good');
    expect(tone('susceptibility', 'HIGH')).toBe('bad');
  });
  it('resistance (très résistant = bon, inversé)', () => {
    expect(tone('resistance', 'HIGH')).toBe('good');
    expect(tone('resistance', 'LOW')).toBe('bad');
  });
  it('inconnu → neutral', () => {
    expect(tone('suitability', 'ZZZ')).toBe('neutral');
    expect(tone('resistance', undefined)).toBe('neutral');
  });
});

describe('optimalPercent', () => {
  it('milieu', () => { expect(optimalPercent(0, 5, 10)).toBe(50); });
  it('clampe', () => { expect(optimalPercent(10, 5, 20)).toBe(0); expect(optimalPercent(0, 30, 10)).toBe(100); });
  it('plage nulle → 50', () => { expect(optimalPercent(5, 5, 5)).toBe(50); });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec.** Run: `cd apps/admin && npx vitest run src/components/fiche/fiche-ui.test.ts`. Expected: FAIL (module absent).

- [ ] **Step 3: Écrire `fiche-ui.ts`.**

```ts
export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-[#eaf3ea] text-[#245c27]',
  warn: 'bg-[#fef3e2] text-[#b45309]',
  bad: 'bg-[#fdecec] text-[#b91c1c]',
  neutral: 'bg-[#eef1f4] text-[#475569]',
};

export const TONE_DOT: Record<Tone, string> = {
  good: 'bg-[#2e7d32]',
  warn: 'bg-[#d97706]',
  bad: 'bg-[#b91c1c]',
  neutral: 'bg-[#94a1ab]',
};

type ToneKind = 'suitability' | 'susceptibility' | 'resistance';

export function tone(kind: ToneKind, code: string | undefined): Tone {
  switch (kind) {
    case 'suitability':
      return code === 'SUITABLE' ? 'good' : code === 'MARGINAL' ? 'warn' : code === 'UNSUITABLE' ? 'bad' : 'neutral';
    case 'susceptibility':
      return code === 'LOW' ? 'good' : code === 'MEDIUM' ? 'warn' : code === 'HIGH' ? 'bad' : 'neutral';
    case 'resistance':
      return code === 'HIGH' ? 'good' : code === 'MEDIUM' ? 'warn' : code === 'LOW' ? 'bad' : 'neutral';
    default:
      return 'neutral';
  }
}

/** Position 0..100 de l'optimal dans [min,max], clampée ; plage nulle → 50. */
export function optimalPercent(min: number, optimal: number, max: number): number {
  if (max <= min) return 50;
  return Math.min(100, Math.max(0, ((optimal - min) / (max - min)) * 100));
}
```

- [ ] **Step 4: Vérifier vert.** Run: `cd apps/admin && npx vitest run src/components/fiche/fiche-ui.test.ts`. Expected: PASS.

- [ ] **Step 5: `ToneBadge.tsx`.**

```tsx
import type { ReactNode } from 'react';
import { Tone, TONE_CLASS } from './fiche-ui';

export function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 6: `RangeBar.tsx`.**

```tsx
import { optimalPercent } from './fiche-ui';

export function RangeBar({ label, min, optimal, max, unit }: { label: string; min: number; optimal: number; max: number; unit?: string }) {
  const pct = optimalPercent(min, optimal, max);
  return (
    <div className="my-2">
      <div className="mb-1 text-sm text-muted-foreground">{label}{unit ? ` (${unit})` : ''}</div>
      <div className="relative h-2 rounded-md" style={{ background: 'linear-gradient(90deg,#f1c40f22,#2e7d3244,#f1c40f22)' }}>
        <div className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#2e7d32]"
             style={{ left: `${pct}%`, boxShadow: '0 0 0 1px #2e7d32' }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{min} min</span><span>{optimal} optimal</span><span>{max} max</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `Timeline.tsx`.**

```tsx
export interface TimelineStep { key: string; j: string; label: string; sowing?: boolean; chips?: string[]; }

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="mt-2 flex items-start overflow-x-auto pb-1">
      {steps.map((s) => (
        <div key={s.key} className="relative min-w-[96px] pt-[18px] text-center">
          <span className="absolute left-0 right-0 top-[6px] h-[2px] bg-[#e6e8eb]" />
          <span className={`absolute left-1/2 top-[2px] -translate-x-1/2 rounded-full ${s.sowing ? 'h-3 w-3 bg-[#b45309]' : 'h-2.5 w-2.5 bg-[#2e7d32]'}`} />
          <div className="text-[11px] text-muted-foreground">{s.j}</div>
          <div className="text-xs font-semibold">{s.label}</div>
          {s.chips && s.chips.length > 0 && (
            <div className="mt-0.5 flex flex-wrap justify-center gap-1">
              {s.chips.map((c, i) => <span key={i} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">{c}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: `section-icon.ts`.**

```ts
import { Thermometer, Mountain, Sprout, MapPin, Activity, CalendarDays, Bug, FlaskConical, Wheat, Coins, ShoppingCart, type LucideIcon } from 'lucide-react';

export const SECTION_ICON: Record<string, LucideIcon> = {
  climatic: Thermometer, edaphic: Mountain, varieties: Sprout, zones: MapPin, phenology: Activity,
  windows: CalendarDays, pests: Bug, nutrition: FlaskConical, yields: Wheat, prices: Coins, commercialization: ShoppingCart,
};
```

- [ ] **Step 9: Typecheck + test.** Run: `cd apps/admin && npx tsc --noEmit && npx vitest run src/components/fiche/`. Expected: aucune erreur ; tests verts.

- [ ] **Step 10: Commit.**

```bash
git add apps/admin/src/components/fiche
git commit -m "feat(admin): kit de présentation fiche (tone/RangeBar/Timeline/ToneBadge/icons)"
```

---

### Task 2: Aperçu client — « Fiche magazine »

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/FicheClientView.tsx` (réécriture)
- Modify: `apps/admin/src/app/crops/[id]/fiche/page.tsx` (chargement référentiels + hero + conteneur)

**Interfaces:**
- Consumes: kit `components/fiche/` (Task 1), `listPests`/`listZones`/`getCropPublished`, maps `lib/labels.ts`.
- `FicheClientView` prend désormais : `{ crop: CropDetail; pestNames: Record<string,string>; zoneNames: Record<string,string> }`.

**Référence visuelle : lire `.superpowers/brainstorm/91051-1784473427/content/client-A-refined.html`** pour la structure/hero/ordre exacts. Reproduire ce rendu en React.

- [ ] **Step 1: Page serveur `fiche/page.tsx`** — charger les référentiels et construire les maps id→nom, conteneur `max-w-3xl mx-auto`, hero.

```tsx
import Link from 'next/link';
import { getCropPublished, listPests, listZones } from '../../../../lib/api';
import { labelOf, CYCLE_TYPE_LABELS, USAGE_CATEGORY_LABELS } from '@/lib/labels';
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
  const [pests, zones] = await Promise.all([listPests().catch(() => []), listZones().catch(() => [])]);
  const pestNames = Object.fromEntries(pests.map((p) => [p.id, p.name]));
  const zoneNames = Object.fromEntries(zones.map((z) => [z.id, z.name]));

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <FicheClientView crop={crop} pestNames={pestNames} zoneNames={zoneNames} />
      <Link href={`/crops/${params.id}`} className="mt-6 inline-block text-xs text-muted-foreground hover:underline">← Retour à l&apos;administration</Link>
    </main>
  );
}
```

- [ ] **Step 2: Réécrire `FicheClientView.tsx`** en style magazine, en suivant la maquette. Structure imposée :
  - **Hero** : barre d'accent verte `border-l-[6px] border-[#2e7d32]` ; `crop.name` (grand, ~`text-3xl font-bold`) + `crop.scientificName` en `italic text-muted-foreground` ; `crop.description?.fr` en paragraphe si présent ; rangée de badges (`family`, `labelOf(CYCLE_TYPE_LABELS, crop.cycleType)`, `labelOf(USAGE_CATEGORY_LABELS, crop.usageCategory)` si `usageCategory`, `v{crop.publishedVersion} · publiée`). Badge « famille » en vert (`bg-[#eaf3ea] text-[#245c27]`), les autres neutres.
  - **Nav pilules collante** : `sticky top-0 z-10` ; une pilule (`<a href="#...">`) par section (Exigences, Variétés, Zones, Phénologie, Calendrier, Ravageurs, Nutrition, Rendement, Prix, Commercialisation), ancres correspondant aux `id` des `<section>`.
  - **Composant `Section`** local : `<section id={id} className="scroll-mt-16 border-t py-5">` avec titre `flex items-center gap-2` = icône lucide (`SECTION_ICON[key]`, `h-4 w-4`) + `<h2 className="text-base font-semibold">` + compteur atténué éventuel. Chaque section vide rend `<p className="text-sm italic text-muted-foreground">Non renseigné</p>`.
  - **Traitements par section** (mêmes données que l'actuel `FicheClientView`, mais rendus riches) :
    - Exigences (`climatic`, `edaphic`) : `<RangeBar>` pour `temperature`, `rainfall`, `altitude`, `edaphic.ph` (celles présentes, `unit` fourni) ; si `waterNeed`/`droughtSensitivity` : `<ToneBadge tone="neutral">Besoin en eau : {labelOf(WATER_NEED_LABELS, ...)}</ToneBadge>` etc. (neutral, pas de sémantique) ; `edaphic.texture` en ligne. Vide si aucune donnée.
    - Variétés : carte `rounded-lg border p-3` par variété — `name.fr` + ` — {maturityDays} j` si présent ; résistances : `(v.diseaseResistances ?? []).map` → `<ToneBadge tone={tone('resistance', r.level)}>{pestNames[r.pestId] ?? r.pestId} · {labelOf(RESISTANCE_LEVEL_LABELS, r.level)}</ToneBadge>` ; adaptations : `<ToneBadge tone={tone('suitability', a.rating)}>{zoneNames[a.zoneId] ?? crop.zones.find(z=>z.zoneId===a.zoneId)?.zoneName.fr ?? a.zoneId} · {labelOf(SUITABILITY_LABELS, a.rating)}</ToneBadge>` ; `traits` en puces neutres.
    - Zones : pastille `inline-block h-2 w-2 rounded-full ${TONE_DOT[tone('suitability', z.rating)]}` + `zoneName.fr` — `labelOf(SUITABILITY_LABELS, z.rating)` (gras) + justification atténuée.
    - Phénologie : `<Timeline>` sur `[...crop.phenology].sort((a,b)=>a.startDay-b.startDay)` → `{ key:String(p.order), j:`J${p.startDay}–J${p.endDay}`, label:p.name.fr }`.
    - Calendrier & itinéraire : par fenêtre, ligne saison (`w.season` + semis `formatDayMonth(w.sowingStart)`→`sowingEnd` + irrigation) ; `<Timeline>` sur les opérations + repère semis. Construire un tableau intermédiaire portant `timingDays` : `w.operations.map(op => ({ timingDays: op.timingDays, key: …, label: op.label.fr, chips: [...op.inputs, ...(op.equipment ?? [])] }))`, y **insérer** `{ timingDays: 0, key: 'sow', label: 'Semis', sowing: true }`, **trier par `timingDays`**, puis mapper en `TimelineStep` avec `j = t === 0 && sowing ? 'J0' : `J${t >= 0 ? '+' : ''}${t}``.
    - Ravageurs & maladies : carte par bioagresseur — `pestName.fr` + `<ToneBadge tone={tone('susceptibility', p.susceptibility)}>{labelOf(SUSCEPTIBILITY_LABELS, p.susceptibility)}</ToneBadge>` + `labelOf(PEST_TYPE_LABELS, p.type)` atténué ; liste des `controlMethods` (`labelOf(CONTROL_CATEGORY_LABELS, m.category)} : {m.description.fr`) ; `sensitiveStages` via `stageWithRange(s, crop.phenology)` atténué.
    - Nutrition : liste `n.nutrient — n.amount n.unit (stage)`.
    - Rendement : par entrée `labelOf(INPUT_TYPE_LABELS, y.inputType)} : {y.min}–<strong>{y.average}</strong>–{y.potential} {y.unit}` + zone via `crop.zones` si `zoneId`.
    - Prix : `<table>` compact (Forme `labelOf(PRODUCT_FORM_LABELS, p.form)` / Prix `p.price p.currency/labelOf(SALE_UNIT_LABELS, p.unit)` / Marché / Période `formatDayMonth`).
    - Commercialisation : carte par produit — forme + unités (puces neutres `labelOf(SALE_UNIT_LABELS)`) + débouchés (puces neutres `labelOf(OUTLET_LABELS)`).
  - Utiliser les jetons de couleur des Global Constraints ; badges via `<ToneBadge>` ; puces neutres = `rounded-md bg-muted px-1.5 py-0.5 text-[11px]` ou `TONE_CLASS.neutral`.

- [ ] **Step 3: Typecheck + build.** Run: `cd apps/admin && npx tsc --noEmit && pnpm build`. Expected: aucune erreur ; « Compiled successfully ».

- [ ] **Step 4: Commit.**

```bash
git add "apps/admin/src/app/crops/[id]/FicheClientView.tsx" "apps/admin/src/app/crops/[id]/fiche/page.tsx"
git commit -m "feat(admin): aperçu client — fiche magazine (hero, nav pilules, sections riches)"
```

---

### Task 3: Version publiée — grille de cartes dense

**Files:**
- Modify: `apps/admin/src/app/crops/[id]/CropReadView.tsx` (réécriture)
- Modify: `apps/admin/src/app/crops/[id]/published/page.tsx` (chargement référentiels + en-tête compact + bande de complétude)

**Interfaces:**
- Consumes: kit `components/fiche/` (Task 1), `listPests`/`listZones`/`getCropPublished`, maps `lib/labels.ts`.
- `CropReadView` prend désormais : `{ crop: CropDetail; pestNames: Record<string,string>; zoneNames: Record<string,string> }`.

**Référence visuelle : lire `.superpowers/brainstorm/91051-1784473427/content/published-view.html`.**

- [ ] **Step 1: Page serveur `published/page.tsx`** — charger référentiels, en-tête compact, bandeau figé conservé, conteneur `max-w-5xl`.

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCropPublished, listPests, listZones } from '../../../../lib/api';
import { labelOf, CYCLE_TYPE_LABELS, USAGE_CATEGORY_LABELS } from '@/lib/labels';
import { CropReadView } from '../CropReadView';

export default async function PublishedCropPage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) notFound();
  const [pests, zones] = await Promise.all([listPests().catch(() => []), listZones().catch(() => [])]);
  const pestNames = Object.fromEntries(pests.map((p) => [p.id, p.name]));
  const zoneNames = Object.fromEntries(zones.map((z) => [z.id, z.name]));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6 md:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{crop.name} <em className="text-base font-normal text-muted-foreground">{crop.scientificName}</em></h1>
          <p className="text-sm text-muted-foreground">{crop.family} · {labelOf(CYCLE_TYPE_LABELS, crop.cycleType)}{crop.usageCategory ? ` · ${labelOf(USAGE_CATEGORY_LABELS, crop.usageCategory)}` : ''}</p>
        </div>
        <Link href={`/crops/${params.id}`} className="shrink-0 text-sm text-primary hover:underline">← Retour au brouillon</Link>
      </div>
      <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        🔒 Version publiée figée — v{crop.publishedVersion} · lecture seule
      </div>
      <CropReadView crop={crop} pestNames={pestNames} zoneNames={zoneNames} />
    </main>
  );
}
```

- [ ] **Step 2: Réécrire `CropReadView.tsx`** en grille dense, suivant la maquette. Structure imposée :
  - **Bande de complétude** en tête : 11 segments `{ key, label, filled }` où `filled` = présence de la donnée (`!!crop.climatic?.temperature || !!crop.climatic?.rainfall`, `!!crop.edaphic?.ph`, `crop.varieties.length>0`, `crop.zones.length>0`, `crop.phenology.length>0`, `crop.croppingWindows.length>0`, `crop.pests.length>0`, `crop.nutrition.length>0`, `crop.yields.length>0`, `crop.prices.length>0`, `(crop.commercialization??[]).length>0`). Chaque segment : `text-[11px] px-2 py-0.5 rounded-md` vert (`bg-[#eaf3ea] text-[#245c27]`) si `filled`, gris (`bg-[#f1f2f4] text-[#9aa1ab]`) sinon.
  - **Grille** `grid gap-2.5 md:grid-cols-2`. Composant `Card` local `rounded-lg border p-3` avec titre `flex items-center gap-2 text-[13px] font-medium` (icône `SECTION_ICON[key]` `h-4 w-4` + libellé + compteur `ml-auto text-[11px] text-muted-foreground`). Sections larges (`md:col-span-2`) : Calendrier, Prix, Commercialisation.
  - **Rendus compacts** (mêmes données que Task 2 mais denses) :
    - Exigences climatiques : lignes texte `Température : {min}–<strong className="text-[#245c27]">{optimal}</strong>–{max} {unit}` ; idem pluviométrie/altitude ; badges eau/sécheresse neutres. Vide → « Non renseigné ».
    - Édaphique : `pH : min–<b>opt</b>–max`, texture.
    - Variétés : une ligne par variété `<b>{name.fr}</b> · {maturityDays} j` + `<ToneBadge>` résistances (tone=resistance) — mêmes résolutions de noms que Task 2.
    - Zones : ligne pastille (`TONE_DOT[tone('suitability', rating)]`) + nom — aptitude.
    - Phénologie : une ligne condensée `Levée J0–J8 · Croissance J8–J45 · …` (join ` · `).
    - Ravageurs : une ligne par bioagresseur `nom` + `<ToneBadge tone=susceptibility>` + type.
    - Calendrier (large) : par fenêtre, ligne saison en gras puis itinéraire condensé une ligne `J-15 Labour · <b>J0 Semis</b> · J+45 Fertilisation` (opérations triées, semis inséré).
    - Nutrition : lignes `nutrient — amount unit (stage)`.
    - Rendement : lignes `type : min–<b>average</b>–potential unit`.
    - Prix (large) : `<table>` compact (Forme/Prix/Marché/Période).
    - Commercialisation (large) : ligne(s) `<b>forme</b> — unités <puces> · débouchés <puces>`.
    - Toute section vide → `<span className="text-xs italic text-muted-foreground">Non renseigné</span>` (cohérent avec le segment gris).
  - Réutiliser `ToneBadge`, `TONE_DOT`, `SECTION_ICON` du kit. **Ne pas** réintroduire les `RangeBar` ici (la vue dense utilise le texte inline).

- [ ] **Step 3: Typecheck + build.** Run: `cd apps/admin && npx tsc --noEmit && pnpm build`. Expected: aucune erreur ; « Compiled successfully ».

- [ ] **Step 4: Commit.**

```bash
git add "apps/admin/src/app/crops/[id]/CropReadView.tsx" "apps/admin/src/app/crops/[id]/published/page.tsx"
git commit -m "feat(admin): version publiée — grille de cartes dense + bande de complétude"
```

---

### Task 4: Vérification finale

**Files:** aucun.

- [ ] **Step 1: Tests + build admin.** Run: `cd apps/admin && npx vitest run && npx tsc --noEmit && pnpm build`. Expected: tests verts ; aucune erreur de type ; « Compiled successfully ».
- [ ] **Step 2: Contrôle grep — pas d'usage résiduel de l'ancienne signature.** Run: `cd apps/admin && grep -rn "FicheClientView\|CropReadView" src/app/crops/[id] | grep -v "function\|import"`. Vérifier que les deux composants sont appelés avec les nouvelles props (`pestNames`, `zoneNames`).
- [ ] **Step 3: Smoke manuel (à relayer à l'utilisateur).** Ouvrir `/crops/<maïs>/fiche` et `/crops/<maïs>/published` sur une fiche remplie et une partielle : hiérarchie, couleurs sémantiques (dont inversion résistance/sensibilité), frises, tableaux, états « Non renseigné », noms maladie/zone résolus.
