import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCrop, getCropHistory, listZones, listPests } from '../../../lib/api';
import { formatDateTime } from '../../../lib/format';
import { labelOf, CROP_STATUS_LABELS, CYCLE_TYPE_LABELS, SUITABILITY_LABELS, SUSCEPTIBILITY_LABELS, PEST_TYPE_LABELS, OPERATION_TYPE_LABELS, INPUT_LEVEL_LABELS, CONTROL_CATEGORY_LABELS } from '@/lib/labels';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompletenessRing } from '@/components/completeness-ring';
import { PublishButton } from './editors/PublishButton';
import { RequirementsEditor } from './editors/RequirementsEditor';
import { PhenologyEditor } from './editors/PhenologyEditor';
import { NutritionEditor } from './editors/NutritionEditor';
import { YieldsEditor } from './editors/YieldsEditor';
import { VarietyEditor } from './editors/VarietyEditor';
import { PriceEditor } from './editors/PriceEditor';
import { WindowEditor } from './editors/WindowEditor';
import { ZoneSuitabilityEditor } from './editors/ZoneSuitabilityEditor';
import { PestControlEditor } from './editors/PestControlEditor';

export default async function CropDetailPage({ params }: { params: { id: string } }) {
  // The crop is required — a missing one is a genuine 404, not a crashed page.
  const crop = await getCrop(params.id).catch(() => null);
  if (!crop) notFound();

  // Supplementary data degrades gracefully: a lagging or unavailable endpoint
  // (history, catalogs) must never 500 the whole detail page.
  const [history, zones, pests] = await Promise.all([
    getCropHistory(params.id).catch(() => []),
    listZones().catch(() => []),
    listPests().catch(() => []),
  ]);

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            {crop.name} <em className="text-base font-normal text-muted-foreground">{crop.scientificName}</em>
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{labelOf(CYCLE_TYPE_LABELS, crop.cycleType)}</span>
            <Badge variant={crop.status === 'PUBLISHED' ? 'default' : 'secondary'}>{labelOf(CROP_STATUS_LABELS, crop.status)}</Badge>
            <span>{crop.publishedVersion === 0 ? 'Brouillon' : `v${crop.publishedVersion}`}</span>
          </div>
          <PublishButton
            cropId={params.id}
            status={crop.status}
            hasUnpublishedChanges={crop.hasUnpublishedChanges}
            hasPublishedVersion={crop.hasPublishedVersion}
            completeness={crop.completeness}
          />
          {crop.hasPublishedVersion && (
            <Link href={`/crops/${params.id}/versions`} className="text-sm text-primary hover:underline">
              Historique des versions →
            </Link>
          )}
        </div>
        {crop.completeness && <CompletenessRing percent={crop.completeness.percent} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Exigences climatiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {crop.climatic?.temperature
              ? <p>Température : {crop.climatic.temperature.min}–{crop.climatic.temperature.optimal}–{crop.climatic.temperature.max} {crop.climatic.temperature.unit}</p>
              : <p className="text-muted-foreground">Non renseignées</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Exigences édaphiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {crop.edaphic?.ph
              ? <p>pH : {crop.edaphic.ph.min}–{crop.edaphic.ph.optimal}–{crop.edaphic.ph.max}</p>
              : <p className="text-muted-foreground">Non renseignées</p>}
            <div className="pt-2">
              <RequirementsEditor cropId={params.id} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Variétés ({crop.varieties.length})</CardTitle>
            <VarietyEditor cropId={params.id} />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <ul>
              {crop.varieties.map((v) => (
                <li key={v.id} className="flex items-center gap-2">
                  <span>{v.name.fr}{v.maturityDays ? ` — ${v.maturityDays} j` : ''}</span>
                  <VarietyEditor cropId={params.id} initial={v} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Zones ({crop.zones.length})</CardTitle>
            <ZoneSuitabilityEditor cropId={params.id} zones={zones} />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <ul className="list-disc pl-5">
              {crop.zones.map((z) => (
                <li key={z.zoneId}>{z.zoneName.fr} — <strong>{labelOf(SUITABILITY_LABELS, z.rating)}</strong>{z.justification ? ` (${z.justification})` : ''}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Phénologie ({crop.phenology.length})</CardTitle>
            <PhenologyEditor cropId={params.id} current={crop.phenology} />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <ul className="list-disc pl-5">
              {crop.phenology.map((p) => (
                <li key={p.order}>{p.name.fr} — J{p.startDay} à J{p.endDay}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Fenêtres de production ({crop.croppingWindows.length})</CardTitle>
            <WindowEditor cropId={params.id} zones={zones} />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {crop.croppingWindows.map((w) => (
              <div key={w.id} className="mb-3">
                <p className="font-medium">{w.season}{w.irrigationRequired ? ' · irrigation requise' : ''}</p>
                <ul className="list-disc pl-5">
                  {w.operations.map((op, i) => (
                    <li key={i}>J+{op.timingDays} — {op.label.fr} ({labelOf(OPERATION_TYPE_LABELS, op.type)})</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Ravageurs &amp; maladies ({crop.pests.length})</CardTitle>
            <PestControlEditor cropId={params.id} pests={pests} />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {crop.pests.map((p) => (
              <div key={p.pestId} className="mb-3">
                <p className="font-medium">{p.pestName.fr} — <strong>{labelOf(SUSCEPTIBILITY_LABELS, p.susceptibility)}</strong> ({labelOf(PEST_TYPE_LABELS, p.type)})</p>
                <ul className="list-disc pl-5">
                  {p.controlMethods.map((m, i) => (
                    <li key={i}>{labelOf(CONTROL_CATEGORY_LABELS, m.category)} : {m.description.fr}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Nutrition ({crop.nutrition.length})</CardTitle>
            <NutritionEditor cropId={params.id} current={crop.nutrition} />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <ul className="list-disc pl-5">
              {crop.nutrition.map((n, i) => (
                <li key={i}>{n.nutrient} — {n.amount} {n.unit}{n.stage ? ` (${n.stage})` : ''}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Rendement ({crop.yields.length})</CardTitle>
            <YieldsEditor cropId={params.id} current={crop.yields} />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <ul className="list-disc pl-5">
              {crop.yields.map((y, i) => (
                <li key={i}>{labelOf(INPUT_LEVEL_LABELS, y.inputLevel)} : {y.min}–{y.average}–{y.potential} {y.unit}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Prix ({crop.prices.length})</CardTitle>
            <PriceEditor cropId={params.id} />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <ul className="list-disc pl-5">
              {crop.prices.map((p) => (
                <li key={p.id}>{p.date} — {p.price} {p.unit} @ {p.market}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Historique ({history.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <ul className="divide-y">
              {history.map((h) => (
                <li key={h.id} className="py-2">{formatDateTime(h.at)} — {h.actor} — {Object.keys(h.changes).join(', ')}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
