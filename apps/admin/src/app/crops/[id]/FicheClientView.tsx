import type { ReactNode } from 'react';
import {
  labelOf, stageWithRange, CYCLE_TYPE_LABELS, SUITABILITY_LABELS, SUSCEPTIBILITY_LABELS,
  PEST_TYPE_LABELS, OPERATION_TYPE_LABELS, INPUT_TYPE_LABELS, CONTROL_CATEGORY_LABELS,
  PRODUCT_FORM_LABELS, SALE_UNIT_LABELS,
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

      <Section title="Commercialisation">
        <ul className="list-disc pl-5">
          {(crop.commercialization ?? []).map((p, i) => (
            <li key={i}>
              {labelOf(PRODUCT_FORM_LABELS, p.form)}
              {p.saleUnits.length > 0 && ` — ${p.saleUnits.map((u) => labelOf(SALE_UNIT_LABELS, u)).join(', ')}`}
              {p.outlets.length > 0 && ` (${p.outlets.join(', ')})`}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
