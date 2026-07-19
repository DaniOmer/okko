import type { ReactNode } from 'react';
import {
  labelOf, stageWithRange,
  SUITABILITY_LABELS, SUSCEPTIBILITY_LABELS, PEST_TYPE_LABELS,
  PRODUCT_FORM_LABELS, SALE_UNIT_LABELS, OUTLET_LABELS,
  INPUT_TYPE_LABELS, WATER_NEED_LABELS, DROUGHT_SENSITIVITY_LABELS,
  RESISTANCE_LEVEL_LABELS, OPERATION_TYPE_LABELS,
} from '@/lib/labels';
import { formatDayMonth } from '../../../lib/format';
import type { CropDetail } from '../../../lib/api';
import { tone, TONE_DOT } from '@/components/fiche/fiche-ui';
import { ToneBadge } from '@/components/fiche/ToneBadge';
import { SECTION_ICON } from '@/components/fiche/section-icon';

// ──────────────────────────────────────────────────────────────────
// Empty sentinel
// ──────────────────────────────────────────────────────────────────

const EMPTY = (
  <span className="text-xs italic text-muted-foreground">Non renseigné</span>
);

// ──────────────────────────────────────────────────────────────────
// Dense card
// ──────────────────────────────────────────────────────────────────

function DenseCard({
  iconKey,
  title,
  count,
  wide,
  children,
}: {
  iconKey: string;
  title: string;
  count?: number | string;
  wide?: boolean;
  children: ReactNode;
}) {
  const Icon = SECTION_ICON[iconKey];
  return (
    <div
      className={`rounded-lg border p-3${wide ? ' md:col-span-2' : ''}`}
    >
      <h4 className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-[#111827]">
        {Icon && (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[#eaf3ea] text-[#245c27]">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        {title}
        {count !== undefined && (
          <span className="ml-auto text-[11px] text-muted-foreground">{count}</span>
        )}
      </h4>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Neutral chip (units, outlets)
// ──────────────────────────────────────────────────────────────────

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px]">
      {children}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Completeness strip
// ──────────────────────────────────────────────────────────────────

function CompletenessStrip({ crop }: { crop: CropDetail }) {
  const segments: { key: string; label: string; filled: boolean }[] = [
    {
      key: 'climatic',
      label: 'Exigences',
      filled: !!(crop.climatic?.temperature || crop.climatic?.rainfall),
    },
    {
      key: 'edaphic',
      label: 'Édaphique',
      filled: !!crop.edaphic?.ph,
    },
    {
      key: 'varieties',
      label: 'Variétés',
      filled: crop.varieties.length > 0,
    },
    {
      key: 'zones',
      label: 'Zones',
      filled: crop.zones.length > 0,
    },
    {
      key: 'phenology',
      label: 'Phénologie',
      filled: crop.phenology.length > 0,
    },
    {
      key: 'calendar',
      label: 'Calendrier',
      filled: crop.croppingWindows.length > 0,
    },
    {
      key: 'pests',
      label: 'Ravageurs',
      filled: crop.pests.length > 0,
    },
    {
      key: 'nutrition',
      label: 'Nutrition',
      filled: crop.nutrition.length > 0,
    },
    {
      key: 'yields',
      label: 'Rendement',
      filled: crop.yields.length > 0,
    },
    {
      key: 'prices',
      label: 'Prix',
      filled: crop.prices.length > 0,
    },
    {
      key: 'commercialization',
      label: 'Commercialisation',
      filled: (crop.commercialization ?? []).length > 0,
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 pb-1">
      {segments.map((seg) => (
        <span
          key={seg.key}
          className={`text-[11px] px-2 py-0.5 rounded-md${
            seg.filled
              ? ' bg-[#eaf3ea] text-[#245c27]'
              : ' bg-[#f1f2f4] text-[#9aa1ab]'
          }`}
        >
          {seg.label}
        </span>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────

export function CropReadView({
  crop,
  pestNames,
  zoneNames,
}: {
  crop: CropDetail;
  pestNames: Record<string, string>;
  zoneNames: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      {/* Completeness strip */}
      <CompletenessStrip crop={crop} />

      {/* Dense 2-col grid */}
      <div className="grid gap-2.5 md:grid-cols-2">

        {/* ── 1. Exigences climatiques ─────────────────────────────── */}
        <DenseCard iconKey="climatic" title="Exigences climatiques">
          {!crop.climatic?.temperature && !crop.climatic?.rainfall && !crop.climatic?.altitude && !crop.climatic?.waterNeed && !crop.climatic?.droughtSensitivity
            ? EMPTY
            : (
              <div className="space-y-0.5">
                {crop.climatic?.temperature && (
                  <div className="text-[12.5px] leading-snug">
                    Température :{' '}
                    {crop.climatic.temperature.min}–
                    <strong className="text-[#245c27]">{crop.climatic.temperature.optimal}</strong>–
                    {crop.climatic.temperature.max}{' '}
                    {crop.climatic.temperature.unit}
                  </div>
                )}
                {crop.climatic?.rainfall && (
                  <div className="text-[12.5px] leading-snug">
                    Pluviométrie :{' '}
                    {crop.climatic.rainfall.min}–
                    <strong className="text-[#245c27]">{crop.climatic.rainfall.optimal}</strong>–
                    {crop.climatic.rainfall.max}{' '}
                    {crop.climatic.rainfall.unit}
                  </div>
                )}
                {crop.climatic?.altitude && (
                  <div className="text-[12.5px] leading-snug">
                    Altitude :{' '}
                    {crop.climatic.altitude.min}–
                    <strong className="text-[#245c27]">{crop.climatic.altitude.optimal}</strong>–
                    {crop.climatic.altitude.max}{' '}
                    {crop.climatic.altitude.unit}
                  </div>
                )}
                {(crop.climatic?.waterNeed || crop.climatic?.droughtSensitivity) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {crop.climatic?.waterNeed && (
                      <ToneBadge tone="neutral">
                        Eau : {labelOf(WATER_NEED_LABELS, crop.climatic.waterNeed)}
                      </ToneBadge>
                    )}
                    {crop.climatic?.droughtSensitivity && (
                      <ToneBadge tone="neutral">
                        Sécheresse : {labelOf(DROUGHT_SENSITIVITY_LABELS, crop.climatic.droughtSensitivity)}
                      </ToneBadge>
                    )}
                  </div>
                )}
              </div>
            )}
        </DenseCard>

        {/* ── 2. Exigences édaphiques ──────────────────────────────── */}
        <DenseCard iconKey="edaphic" title="Exigences édaphiques">
          {!crop.edaphic?.ph && !crop.edaphic?.texture
            ? EMPTY
            : (
              <div className="space-y-0.5">
                {crop.edaphic?.ph && (
                  <div className="text-[12.5px] leading-snug">
                    pH :{' '}
                    {crop.edaphic.ph.min}–
                    <strong className="text-[#245c27]">{crop.edaphic.ph.optimal}</strong>–
                    {crop.edaphic.ph.max}
                  </div>
                )}
                {crop.edaphic?.texture && (
                  <div className="text-[12.5px] leading-snug">
                    Texture : {crop.edaphic.texture}
                  </div>
                )}
              </div>
            )}
        </DenseCard>

        {/* ── 3. Variétés ──────────────────────────────────────────── */}
        <DenseCard
          iconKey="varieties"
          title="Variétés"
          count={crop.varieties.length > 0 ? crop.varieties.length : undefined}
        >
          {crop.varieties.length === 0
            ? EMPTY
            : (
              <div className="space-y-1">
                {crop.varieties.map((v) => (
                  <div key={v.id} className="text-[12.5px] leading-snug">
                    <strong>{v.name.fr}</strong>
                    {v.maturityDays ? ` · ${v.maturityDays} j` : ''}
                    {(v.diseaseResistances ?? []).length > 0 && (
                      <span className="ml-1 inline-flex flex-wrap gap-0.5">
                        {(v.diseaseResistances ?? []).map((r, i) => (
                          <ToneBadge key={i} tone={tone('resistance', r.level)}>
                            {pestNames[r.pestId] ?? r.pestId} · {labelOf(RESISTANCE_LEVEL_LABELS, r.level)}
                          </ToneBadge>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
        </DenseCard>

        {/* ── 4. Zones ─────────────────────────────────────────────── */}
        <DenseCard
          iconKey="zones"
          title="Zones"
          count={crop.zones.length > 0 ? crop.zones.length : undefined}
        >
          {crop.zones.length === 0
            ? EMPTY
            : (
              <div className="space-y-0.5">
                {crop.zones.map((z) => (
                  <div key={z.zoneId} className="flex items-center gap-1 text-[12.5px] leading-snug">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone('suitability', z.rating)]}`}
                    />
                    {zoneNames[z.zoneId] ?? z.zoneName.fr} —{' '}
                    <strong>{labelOf(SUITABILITY_LABELS, z.rating)}</strong>
                  </div>
                ))}
              </div>
            )}
        </DenseCard>

        {/* ── 5. Phénologie ────────────────────────────────────────── */}
        <DenseCard
          iconKey="phenology"
          title="Phénologie"
          count={crop.phenology.length > 0 ? crop.phenology.length : undefined}
        >
          {crop.phenology.length === 0
            ? EMPTY
            : (
              <div className="text-[12.5px] leading-snug">
                {[...crop.phenology]
                  .sort((a, b) => a.startDay - b.startDay)
                  .map((p) => `${p.name.fr} J${p.startDay}–J${p.endDay}`)
                  .join(' · ')}
              </div>
            )}
        </DenseCard>

        {/* ── 6. Ravageurs & maladies ──────────────────────────────── */}
        <DenseCard
          iconKey="pests"
          title="Ravageurs & maladies"
          count={crop.pests.length > 0 ? crop.pests.length : undefined}
        >
          {crop.pests.length === 0
            ? EMPTY
            : (
              <div className="space-y-0.5">
                {crop.pests.map((p) => (
                  <div key={p.pestId} className="text-[12.5px] leading-snug">
                    {pestNames[p.pestId] ?? p.pestName.fr}{' '}
                    <ToneBadge tone={tone('susceptibility', p.susceptibility)}>
                      {labelOf(SUSCEPTIBILITY_LABELS, p.susceptibility)}
                    </ToneBadge>
                    {' '}· {labelOf(PEST_TYPE_LABELS, p.type)}
                  </div>
                ))}
              </div>
            )}
        </DenseCard>

        {/* ── 7. Calendrier (wide) ─────────────────────────────────── */}
        <DenseCard
          iconKey="windows"
          title="Calendrier & itinéraire"
          count={
            crop.croppingWindows.length > 0
              ? `${crop.croppingWindows.length} fenêtre${crop.croppingWindows.length > 1 ? 's' : ''}`
              : undefined
          }
          wide
        >
          {crop.croppingWindows.length === 0
            ? EMPTY
            : (
              <div className="space-y-2">
                {crop.croppingWindows.map((w) => {
                  // Build operations + sowing marker, sorted by timingDays
                  const ops: { timingDays: number; label: string; sowing?: boolean }[] = [
                    ...w.operations.map((op) => ({
                      timingDays: op.timingDays,
                      label: op.label.fr || labelOf(OPERATION_TYPE_LABELS, op.type),
                    })),
                    { timingDays: 0, label: 'Semis', sowing: true },
                  ].sort((a, b) => a.timingDays - b.timingDays);

                  return (
                    <div key={w.id}>
                      <div className="text-[12.5px] font-semibold leading-snug">
                        {w.season}
                        {w.sowingStart && (
                          <span className="font-normal">
                            {' '}· semis {formatDayMonth(w.sowingStart)}
                            {w.sowingEnd ? ` → ${formatDayMonth(w.sowingEnd)}` : ''}
                          </span>
                        )}
                        {' '}·{' '}
                        {w.irrigationRequired ? 'irrigation requise' : 'sans irrigation'}
                      </div>
                      {ops.length > 1 && (
                        <div className="text-[12.5px] leading-snug">
                          {ops.map((op, i) => {
                            const dayLabel = op.sowing ? 'J0' : `J${op.timingDays >= 0 ? '+' : ''}${op.timingDays}`;
                            const text = `${dayLabel} ${op.label}`.trim();
                            return (
                              <span key={i}>
                                {i > 0 && ' · '}
                                {op.sowing ? <strong className="text-[#245c27]">{text}</strong> : text}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </DenseCard>

        {/* ── 8. Rendement ─────────────────────────────────────────── */}
        <DenseCard
          iconKey="yields"
          title="Rendement"
          count={crop.yields.length > 0 ? crop.yields.length : '—'}
        >
          {crop.yields.length === 0
            ? EMPTY
            : (
              <div className="space-y-0.5">
                {crop.yields.map((y, i) => (
                  <div key={i} className="text-[12.5px] leading-snug">
                    <span className="font-medium">{labelOf(INPUT_TYPE_LABELS, y.inputType)}</span>
                    {' '}: {y.min}–
                    <strong className="text-[#245c27]">{y.average}</strong>–
                    {y.potential} {y.unit}
                    {y.zoneId && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        — {zoneNames[y.zoneId] ?? crop.zones.find((z) => z.zoneId === y.zoneId)?.zoneName.fr ?? y.zoneId}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
        </DenseCard>

        {/* ── 9. Nutrition ─────────────────────────────────────────── */}
        <DenseCard
          iconKey="nutrition"
          title="Nutrition"
          count={crop.nutrition.length > 0 ? crop.nutrition.length : undefined}
        >
          {crop.nutrition.length === 0
            ? EMPTY
            : (
              <div className="space-y-0.5">
                {crop.nutrition.map((n, i) => (
                  <div key={i} className="text-[12.5px] leading-snug">
                    {n.nutrient} — {n.amount} {n.unit}
                    {n.stage ? ` (${stageWithRange(n.stage, crop.phenology)})` : ''}
                  </div>
                ))}
              </div>
            )}
        </DenseCard>

        {/* ── 10. Prix (wide) ──────────────────────────────────────── */}
        <DenseCard
          iconKey="prices"
          title="Prix"
          count={crop.prices.length > 0 ? crop.prices.length : undefined}
          wide
        >
          {crop.prices.length === 0
            ? EMPTY
            : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="border-b pb-1 text-left font-semibold text-muted-foreground pr-3">Forme</th>
                      <th className="border-b pb-1 text-left font-semibold text-muted-foreground pr-3">Prix</th>
                      <th className="border-b pb-1 text-left font-semibold text-muted-foreground pr-3">Marché</th>
                      <th className="border-b pb-1 text-left font-semibold text-muted-foreground">Période</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crop.prices.map((p) => (
                      <tr key={p.id} className="border-b border-[#f4f4f4]">
                        <td className="py-1 pr-3">{labelOf(PRODUCT_FORM_LABELS, p.form)}</td>
                        <td className="py-1 pr-3">
                          <strong>{p.price}</strong> {p.currency}/{labelOf(SALE_UNIT_LABELS, p.unit)}
                        </td>
                        <td className="py-1 pr-3">{p.market}</td>
                        <td className="py-1 text-xs text-muted-foreground">
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
        </DenseCard>

        {/* ── 11. Commercialisation (wide) ─────────────────────────── */}
        <DenseCard
          iconKey="commercialization"
          title="Commercialisation"
          count={(crop.commercialization ?? []).length > 0 ? (crop.commercialization ?? []).length : undefined}
          wide
        >
          {(crop.commercialization ?? []).length === 0
            ? EMPTY
            : (
              <div className="space-y-1">
                {(crop.commercialization ?? []).map((p, i) => (
                  <div key={i} className="text-[12.5px] leading-snug">
                    <strong>{labelOf(PRODUCT_FORM_LABELS, p.form)}</strong>
                    {p.saleUnits.length > 0 && (
                      <>
                        {' '}— unités{' '}
                        {p.saleUnits.map((u, j) => (
                          <Chip key={j}>{labelOf(SALE_UNIT_LABELS, u)}</Chip>
                        ))}
                      </>
                    )}
                    {p.outlets.length > 0 && (
                      <>
                        {' '}· débouchés{' '}
                        {p.outlets.map((o, j) => (
                          <Chip key={j}>{labelOf(OUTLET_LABELS, o)}</Chip>
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
        </DenseCard>

      </div>
    </div>
  );
}
