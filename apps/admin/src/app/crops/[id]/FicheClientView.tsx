'use client';

import type { ReactNode } from 'react';
import {
  labelOf, stageWithRange,
  CYCLE_TYPE_LABELS, USAGE_CATEGORY_LABELS, SUITABILITY_LABELS,
  SUSCEPTIBILITY_LABELS, PEST_TYPE_LABELS, CONTROL_CATEGORY_LABELS,
  PRODUCT_FORM_LABELS, SALE_UNIT_LABELS, OUTLET_LABELS,
  INPUT_TYPE_LABELS, WATER_NEED_LABELS, DROUGHT_SENSITIVITY_LABELS,
  RESISTANCE_LEVEL_LABELS, OPERATION_TYPE_LABELS,
} from '@/lib/labels';
import { formatDayMonth } from '../../../lib/format';
import type { CropDetail } from '../../../lib/api';
import { tone, TONE_DOT } from '@/components/fiche/fiche-ui';
import { ToneBadge } from '@/components/fiche/ToneBadge';
import { StatRange } from '@/components/fiche/StatRange';
import { Timeline, type TimelineStep } from '@/components/fiche/Timeline';
import { SECTION_ICON } from '@/components/fiche/section-icon';
import { Images } from 'lucide-react';

// ——————————————————————————————————————————
// Local helpers
// ——————————————————————————————————————————

const EMPTY = <p className="text-sm italic text-muted-foreground">Non renseigné</p>;

/** Chip gris neutre (unités, débouchés, traits…) */
function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{children}</span>;
}

/** Section avec icône Lucide, titre, compteur et phrase d'intro en langage simple */
function Section({
  id, iconKey, title, count, intro, children,
}: { id: string; iconKey: string; title: string; count?: number; intro?: string; children: ReactNode }) {
  const Icon = SECTION_ICON[iconKey];
  return (
    <section id={id} className="scroll-mt-16 border-t py-6">
      <h2 className={`flex items-center gap-2 text-base font-semibold ${intro ? 'mb-1' : 'mb-3'}`}>
        {Icon && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf3ea] text-[#245c27]">
            <Icon className="h-4 w-4" />
          </span>
        )}
        {title}
        {count !== undefined && (
          <span className="font-normal text-muted-foreground">({count})</span>
        )}
      </h2>
      {intro && <p className="mb-3 text-sm text-muted-foreground">{intro}</p>}
      {children}
    </section>
  );
}

// ——————————————————————————————————————————
// Pill-nav
// ——————————————————————————————————————————

const NAV_ITEMS = [
  { href: '#exigences', label: 'Exigences' },
  { href: '#varietes', label: 'Variétés' },
  { href: '#zones', label: 'Zones' },
  { href: '#phenologie', label: 'Phénologie' },
  { href: '#calendrier', label: 'Calendrier' },
  { href: '#ravageurs', label: 'Ravageurs' },
  { href: '#nutrition', label: 'Nutrition' },
  { href: '#rendement', label: 'Rendement' },
  { href: '#prix', label: 'Prix' },
  { href: '#commercialisation', label: 'Commercialisation' },
  { href: '#photos', label: 'Photos' },
];

function PillNav() {
  return (
    <nav className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-t bg-white/95 px-6 py-2.5 backdrop-blur-sm">
      {NAV_ITEMS.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="whitespace-nowrap rounded-full bg-[#f3f4f6] px-3 py-1 text-xs text-[#475569] hover:bg-[#eaf3ea] hover:text-[#245c27] transition-colors"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

// ——————————————————————————————————————————
// Main component
// ——————————————————————————————————————————

export function FicheClientView({
  crop,
  pestNames,
  zoneNames,
}: {
  crop: CropDetail;
  pestNames: Record<string, string>;
  zoneNames: Record<string, string>;
}) {
  // ── Pastille en langage simple (usage · cycle), sans jargon ni métadonnée admin ──
  const tagline = [
    crop.usageCategory ? labelOf(USAGE_CATEGORY_LABELS, crop.usageCategory) : '',
    labelOf(CYCLE_TYPE_LABELS, crop.cycleType),
  ].filter(Boolean).join(' · ');

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div
        className="flex gap-5 rounded-xl px-6 py-7"
        style={{ background: 'linear-gradient(135deg,#f0f7f0,#fbfdfb)' }}
      >
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{crop.name}</h1>
          {crop.scientificName && (
            <p className="mt-0.5 text-sm italic text-muted-foreground">{crop.scientificName}</p>
          )}
          {tagline && (
            <span className="mt-3 inline-block rounded-full bg-[#eaf3ea] px-3 py-1 text-[13px] font-semibold text-[#245c27]">
              🌱 {tagline}
            </span>
          )}
          {crop.description?.fr && (
            <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-[#374151]">
              {crop.description.fr}
            </p>
          )}
          {crop.family && (
            <p className="mt-2 text-xs text-muted-foreground">Famille botanique : {crop.family}</p>
          )}
        </div>
        {crop.images?.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={crop.images[0].url}
            alt={crop.images[0].caption ?? crop.name}
            className="h-28 w-28 shrink-0 rounded-2xl border border-[#dde8dd] object-cover"
          />
        ) : (
          <div
            className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-[#dde8dd] text-center text-[11px] leading-tight text-[#9bb39b]"
            style={{ background: 'repeating-linear-gradient(45deg,#eef3ee,#eef3ee 8px,#e5efe5 8px,#e5efe5 16px)' }}
            aria-hidden
          >
            Photo<br />à venir
          </div>
        )}
      </div>

      {/* ── Nav pilules collante ─────────────────────────────────────────────── */}
      <PillNav />

      {/* ── Sections ─────────────────────────────────────────────────────────── */}
      <div className="px-6">

        {/* 1. Exigences agroécologiques */}
        <Section id="exigences" iconKey="climatic" title="Exigences agroécologiques"
          intro="Les conditions dans lesquelles cette culture pousse le mieux.">
          {(() => {
            const hasClim =
              crop.climatic?.temperature ||
              crop.climatic?.rainfall ||
              crop.climatic?.altitude ||
              crop.climatic?.waterNeed ||
              crop.climatic?.droughtSensitivity;
            const hasEdaph = crop.edaphic?.ph || crop.edaphic?.texture;
            if (!hasClim && !hasEdaph) return EMPTY;
            return (
              <div className="space-y-1">
                {crop.climatic?.temperature && (
                  <StatRange
                    label="Température"
                    min={crop.climatic.temperature.min}
                    optimal={crop.climatic.temperature.optimal}
                    max={crop.climatic.temperature.max}
                    unit={crop.climatic.temperature.unit}
                  />
                )}
                {crop.climatic?.rainfall && (
                  <StatRange
                    label="Pluviométrie"
                    min={crop.climatic.rainfall.min}
                    optimal={crop.climatic.rainfall.optimal}
                    max={crop.climatic.rainfall.max}
                    unit={crop.climatic.rainfall.unit}
                  />
                )}
                {crop.climatic?.altitude && (
                  <StatRange
                    label="Altitude"
                    min={crop.climatic.altitude.min}
                    optimal={crop.climatic.altitude.optimal}
                    max={crop.climatic.altitude.max}
                    unit={crop.climatic.altitude.unit}
                  />
                )}
                {crop.edaphic?.ph && (
                  <StatRange
                    label="pH du sol"
                    min={crop.edaphic.ph.min}
                    optimal={crop.edaphic.ph.optimal}
                    max={crop.edaphic.ph.max}
                    unit={crop.edaphic.ph.unit}
                  />
                )}
                {(crop.climatic?.waterNeed || crop.climatic?.droughtSensitivity || crop.edaphic?.texture) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {crop.climatic?.waterNeed && (
                      <ToneBadge tone="neutral">
                        Besoin en eau : {labelOf(WATER_NEED_LABELS, crop.climatic.waterNeed)}
                      </ToneBadge>
                    )}
                    {crop.climatic?.droughtSensitivity && (
                      <ToneBadge tone="neutral">
                        Sensibilité sécheresse : {labelOf(DROUGHT_SENSITIVITY_LABELS, crop.climatic.droughtSensitivity)}
                      </ToneBadge>
                    )}
                    {crop.edaphic?.texture && (
                      <ToneBadge tone="neutral">Texture : {crop.edaphic.texture}</ToneBadge>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </Section>

        {/* 2. Variétés */}
        <Section id="varietes" iconKey="varieties" title="Variétés" count={crop.varieties.length || undefined}
          intro="Les variétés cultivées et leurs points forts (résistances, adaptation).">

          {crop.varieties.length === 0 ? EMPTY : (
            <div className="space-y-2">
              {crop.varieties.map((v) => (
                <div key={v.id} className="rounded-lg border p-3">
                  <p className="font-semibold">
                    {v.name.fr}
                    {v.maturityDays && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        — {v.maturityDays} j
                      </span>
                    )}
                  </p>
                  {(v.diseaseResistances ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="mr-1 text-xs text-muted-foreground">Résistances :</span>
                      {(v.diseaseResistances ?? []).map((r, i) => (
                        <ToneBadge key={i} tone={tone('resistance', r.level)}>
                          {pestNames[r.pestId] ?? r.pestId} · {labelOf(RESISTANCE_LEVEL_LABELS, r.level)}
                        </ToneBadge>
                      ))}
                    </div>
                  )}
                  {(v.zoneAdaptations ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="mr-1 text-xs text-muted-foreground">Adaptation :</span>
                      {(v.zoneAdaptations ?? []).map((a, i) => (
                        <ToneBadge key={i} tone={tone('suitability', a.rating)}>
                          {zoneNames[a.zoneId] ?? crop.zones.find((z) => z.zoneId === a.zoneId)?.zoneName.fr ?? a.zoneId}
                          {' '}· {labelOf(SUITABILITY_LABELS, a.rating)}
                        </ToneBadge>
                      ))}
                    </div>
                  )}
                  {v.traits.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {v.traits.map((t, i) => <Chip key={i}>{t}</Chip>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 3. Zones de production */}
        <Section id="zones" iconKey="zones" title="Zones de production" count={crop.zones.length || undefined}
          intro="Les régions où cette culture se plaît, et à quel point.">
          {crop.zones.length === 0 ? EMPTY : (
            <div className="flex flex-wrap gap-2">
              {crop.zones.map((z) => (
                <span
                  key={z.zoneId}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${TONE_DOT[tone('suitability', z.rating)]}`} />
                  <span className="font-medium">{z.zoneName.fr}</span>
                  <span className="text-muted-foreground">—</span>
                  <span className="font-semibold">{labelOf(SUITABILITY_LABELS, z.rating)}</span>
                  {z.justification && (
                    <span className="text-xs text-muted-foreground">({z.justification})</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* 4. Phénologie */}
        <Section id="phenologie" iconKey="phenology" title="Phénologie"
          intro="Les grandes étapes de développement de la plante, en jours après le semis.">
          {crop.phenology.length === 0 ? EMPTY : (
            <Timeline
              steps={[...crop.phenology]
                .sort((a, b) => a.startDay - b.startDay)
                .map((p) => ({
                  key: String(p.order),
                  j: `J${p.startDay}–J${p.endDay}`,
                  label: p.name.fr,
                }))}
            />
          )}
        </Section>

        {/* 5. Calendrier & itinéraire technique */}
        <Section id="calendrier" iconKey="windows" title="Calendrier & itinéraire technique"
          intro="Quand semer et quelles opérations mener, tout au long du cycle.">
          {crop.croppingWindows.length === 0 ? EMPTY : (
            <div className="space-y-5">
              {crop.croppingWindows.map((w) => {
                // Build intermediate array with sowing marker
                type RawStep = {
                  timingDays: number;
                  key: string;
                  label: string;
                  sowing?: boolean;
                  chips?: string[];
                };
                const rawSteps: RawStep[] = [
                  // operations
                  ...w.operations.map((op, i) => ({
                    timingDays: op.timingDays,
                    key: `op-${i}`,
                    label: op.label.fr || labelOf(OPERATION_TYPE_LABELS, op.type),
                    chips: [...op.inputs, ...(op.equipment ?? [])],
                  })),
                  // sowing marker
                  { timingDays: 0, key: 'sow', label: 'Semis', sowing: true },
                ];

                // Sort by timingDays
                rawSteps.sort((a, b) => a.timingDays - b.timingDays);

                // Map to TimelineStep
                const steps: TimelineStep[] = rawSteps.map((s) => ({
                  key: s.key,
                  j: s.sowing ? 'J0' : `J${s.timingDays >= 0 ? '+' : ''}${s.timingDays}`,
                  label: s.label,
                  sowing: s.sowing,
                  chips: s.chips,
                }));

                return (
                  <div key={w.id}>
                    <p className="mb-1 text-sm font-semibold">
                      {w.season}
                      {w.sowingStart && (
                        <span className="font-normal">
                          {' '}· semis {formatDayMonth(w.sowingStart)}
                          {w.sowingEnd ? ` → ${formatDayMonth(w.sowingEnd)}` : ''}
                        </span>
                      )}
                      {' '}· {w.irrigationRequired ? 'irrigation requise' : 'irrigation non requise'}
                    </p>
                    <Timeline steps={steps} />
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 6. Ravageurs & maladies */}
        <Section id="ravageurs" iconKey="pests" title="Ravageurs & maladies" count={crop.pests.length || undefined}
          intro="Les principaux ennemis de la culture et comment s'en protéger.">
          {crop.pests.length === 0 ? EMPTY : (
            <div className="space-y-2">
              {crop.pests.map((p) => (
                <div key={p.pestId} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.pestName.fr}</span>
                    <ToneBadge tone={tone('susceptibility', p.susceptibility)}>
                      {labelOf(SUSCEPTIBILITY_LABELS, p.susceptibility)}
                    </ToneBadge>
                    <span className="text-xs italic text-muted-foreground">
                      · {labelOf(PEST_TYPE_LABELS, p.type)}
                    </span>
                  </div>
                  {p.controlMethods.length > 0 && (
                    <ul className="mt-2 space-y-0.5 pl-4 text-sm list-disc">
                      {p.controlMethods.map((m, i) => (
                        <li key={i}>
                          {labelOf(CONTROL_CATEGORY_LABELS, m.category)} : {m.description.fr}
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.sensitiveStages.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Stades sensibles : {p.sensitiveStages.map((s) => stageWithRange(s, crop.phenology)).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 7. Nutrition */}
        <Section id="nutrition" iconKey="nutrition" title="Nutrition"
          intro="Les apports d'engrais recommandés.">
          {crop.nutrition.length === 0 ? EMPTY : (
            <ul className="space-y-1 text-sm">
              {crop.nutrition.map((n, i) => (
                <li key={i} className="flex flex-wrap gap-1 items-baseline">
                  <span className="font-medium">{n.nutrient}</span>
                  <span className="text-muted-foreground">—</span>
                  <span>{n.amount} {n.unit}</span>
                  {n.stage && (
                    <span className="text-xs text-muted-foreground">
                      ({stageWithRange(n.stage, crop.phenology)})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 8. Rendement */}
        <Section id="rendement" iconKey="yields" title="Rendement"
          intro="Ce que la culture peut produire.">

          {crop.yields.length === 0 ? EMPTY : (
            <ul className="space-y-1 text-sm">
              {crop.yields.map((y, i) => (
                <li key={i}>
                  <span className="font-medium">{labelOf(INPUT_TYPE_LABELS, y.inputType)}</span>
                  {' '}: {y.min}–<strong>{y.average}</strong>–{y.potential} {y.unit}
                  {y.zoneId && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      — {crop.zones.find((z) => z.zoneId === y.zoneId)?.zoneName.fr ?? y.zoneId}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 9. Prix */}
        <Section id="prix" iconKey="prices" title="Prix récents" count={crop.prices.length || undefined}
          intro="Prix récents observés sur les marchés.">

          {crop.prices.length === 0 ? EMPTY : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b pb-1.5 pt-0 text-left text-xs font-semibold text-muted-foreground pr-3">Forme</th>
                    <th className="border-b pb-1.5 pt-0 text-left text-xs font-semibold text-muted-foreground pr-3">Prix</th>
                    <th className="border-b pb-1.5 pt-0 text-left text-xs font-semibold text-muted-foreground pr-3">Marché</th>
                    <th className="border-b pb-1.5 pt-0 text-left text-xs font-semibold text-muted-foreground">Période</th>
                  </tr>
                </thead>
                <tbody>
                  {crop.prices.map((p) => (
                    <tr key={p.id} className="border-b border-[#f3f4f6]">
                      <td className="py-1.5 pr-3">{labelOf(PRODUCT_FORM_LABELS, p.form)}</td>
                      <td className="py-1.5 pr-3">
                        <strong>{p.price}</strong> {p.currency}/{labelOf(SALE_UNIT_LABELS, p.unit)}
                      </td>
                      <td className="py-1.5 pr-3">{p.market}</td>
                      <td className="py-1.5 text-xs text-muted-foreground">
                        {p.periodStart === p.periodEnd
                          ? formatDayMonth(p.periodStart)
                          : `${formatDayMonth(p.periodStart)} → ${formatDayMonth(p.periodEnd)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 10. Commercialisation */}
        <Section id="commercialisation" iconKey="commercialization" title="Commercialisation"
          intro="Sous quelles formes et par quels circuits la culture se vend.">
          {(crop.commercialization ?? []).length === 0 ? EMPTY : (
            <div className="space-y-2">
              {(crop.commercialization ?? []).map((p, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <p className="font-semibold">{labelOf(PRODUCT_FORM_LABELS, p.form)}</p>
                  {p.saleUnits.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-1">Unités :</span>
                      {p.saleUnits.map((u, j) => <Chip key={j}>{labelOf(SALE_UNIT_LABELS, u)}</Chip>)}
                    </div>
                  )}
                  {p.outlets.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-1">Débouchés :</span>
                      {p.outlets.map((o, j) => <Chip key={j}>{labelOf(OUTLET_LABELS, o)}</Chip>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 11. Photos */}
        {(crop.images?.length ?? 0) > 0 && (
          <section id="photos" className="scroll-mt-16 border-t py-6">
            <h2 className="flex items-center gap-2 text-base font-semibold mb-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf3ea] text-[#245c27]">
                <Images className="h-4 w-4" />
              </span>
              Photos
              <span className="font-normal text-muted-foreground">({crop.images!.length})</span>
            </h2>
            <div className="flex flex-wrap gap-3">
              {crop.images!.map((img) => (
                <div key={img.key} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.caption ?? ''}
                    className="h-36 w-44 rounded-lg border object-cover"
                  />
                  {img.caption && (
                    <p className="text-xs text-muted-foreground w-44 truncate">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
