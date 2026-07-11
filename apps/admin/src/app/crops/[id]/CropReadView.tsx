import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  labelOf, SUITABILITY_LABELS, SUSCEPTIBILITY_LABELS, PEST_TYPE_LABELS,
  OPERATION_TYPE_LABELS, INPUT_TYPE_LABELS, CONTROL_CATEGORY_LABELS,
} from '@/lib/labels';
import type { CropDetail } from '../../../lib/api';

export function CropReadView({ crop }: { crop: CropDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Exigences climatiques</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {crop.climatic?.temperature
            ? <p>Température : {crop.climatic.temperature.min}–{crop.climatic.temperature.optimal}–{crop.climatic.temperature.max} {crop.climatic.temperature.unit}</p>
            : <p className="text-muted-foreground">Non renseignées</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Exigences édaphiques</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {crop.edaphic?.ph
            ? <p>pH : {crop.edaphic.ph.min}–{crop.edaphic.ph.optimal}–{crop.edaphic.ph.max}</p>
            : <p className="text-muted-foreground">Non renseignées</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Variétés ({crop.varieties.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.varieties.map((v) => (<li key={v.id}>{v.name.fr}{v.maturityDays ? ` — ${v.maturityDays} j` : ''}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Zones ({crop.zones.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.zones.map((z) => (<li key={z.zoneId}>{z.zoneName.fr} — <strong>{labelOf(SUITABILITY_LABELS, z.rating)}</strong>{z.justification ? ` (${z.justification})` : ''}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Phénologie ({crop.phenology.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.phenology.map((p) => (<li key={p.order}>{p.name.fr} — J{p.startDay} à J{p.endDay}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Fenêtres de production ({crop.croppingWindows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {crop.croppingWindows.map((w) => (
            <div key={w.id} className="mb-3">
              <p className="font-medium">{w.season}{w.irrigationRequired ? ' · irrigation requise' : ''}</p>
              <ul className="list-disc pl-5">
                {w.operations.map((op, i) => (<li key={i}>J+{op.timingDays} — {op.label.fr} ({labelOf(OPERATION_TYPE_LABELS, op.type)})</li>))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Ravageurs &amp; maladies ({crop.pests.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {crop.pests.map((p) => (
            <div key={p.pestId} className="mb-3">
              <p className="font-medium">{p.pestName.fr} — <strong>{labelOf(SUSCEPTIBILITY_LABELS, p.susceptibility)}</strong> ({labelOf(PEST_TYPE_LABELS, p.type)})</p>
              <ul className="list-disc pl-5">
                {p.controlMethods.map((m, i) => (<li key={i}>{labelOf(CONTROL_CATEGORY_LABELS, m.category)} : {m.description.fr}</li>))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Nutrition ({crop.nutrition.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.nutrition.map((n, i) => (<li key={i}>{n.nutrient} — {n.amount} {n.unit}{n.stage ? ` (${n.stage})` : ''}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Rendement ({crop.yields.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.yields.map((y, i) => (<li key={i}>{labelOf(INPUT_TYPE_LABELS, y.inputType)} : {y.min}–{y.average}–{y.potential} {y.unit}{y.zoneId ? ` — zone ${crop.zones.find((z) => z.zoneId === y.zoneId)?.zoneName.fr ?? y.zoneId}` : ''}</li>))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Prix ({crop.prices.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <ul className="list-disc pl-5">
            {crop.prices.map((p) => (<li key={p.id}>{p.periodStart === p.periodEnd ? p.periodStart : `${p.periodStart} → ${p.periodEnd}`} — {p.price} {p.unit} @ {p.market}</li>))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
