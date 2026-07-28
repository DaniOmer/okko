import type { Zone, ZoneCropView } from '@/lib/api';
import { labelOf, CLIMATE_TYPE_LABELS, MONTH_LABELS, FERTILITY_LABELS, DRAINAGE_LABELS, SUITABILITY_RATING_LABELS } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';

const rng = (r?: { min: number; max: number; unit?: string }) => (r ? `${r.min}–${r.max}${r.unit ? ' ' + r.unit : ''}` : null);
const month = (m?: string) => (m ? labelOf(MONTH_LABELS, m) : null);

export function ZoneFicheView({ zone, crops }: { zone: Zone; crops: ZoneCropView[] }) {
  const rows: [string, string | null][] = [
    ['Code', zone.code ?? null],
    ['Région administrative', zone.region ?? null],
    ['Type de climat', zone.climateType ? labelOf(CLIMATE_TYPE_LABELS, zone.climateType) : null],
    ['Classification de Köppen', zone.koppen ?? null],
    ['Altitude', rng(zone.altitude)],
    ['Pluviométrie annuelle', rng(zone.annualRainfall)],
    ['Température moyenne', zone.meanTemperature != null ? `${zone.meanTemperature} °C` : null],
    ['Humidité moyenne', zone.meanHumidity != null ? `${zone.meanHumidity} %` : null],
    ['Saison des pluies', month(zone.rainySeasonStart) && month(zone.rainySeasonEnd) ? `${month(zone.rainySeasonStart)} → ${month(zone.rainySeasonEnd)}` : null],
    ['Saison sèche', month(zone.drySeasonStart) && month(zone.drySeasonEnd) ? `${month(zone.drySeasonStart)} → ${month(zone.drySeasonEnd)}` : null],
    ['Fertilité', zone.fertility ? labelOf(FERTILITY_LABELS, zone.fertility) : null],
    ['Drainage', zone.drainage ? labelOf(DRAINAGE_LABELS, zone.drainage) : null],
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{zone.name} <span className="text-base font-normal text-muted-foreground">{zone.country}</span></h1>
        {zone.climateType && <Badge variant="secondary" className="mt-1">{labelOf(CLIMATE_TYPE_LABELS, zone.climateType)}</Badge>}
        {zone.description?.fr && <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-[#374151]">{zone.description.fr}</p>}
      </div>

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-base font-semibold">Caractéristiques</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed py-1"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>
          ))}
        </dl>
        {(zone.soilTypes?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1 text-sm">
            <span className="text-muted-foreground">Types de sols : </span>
            {zone.soilTypes!.map((t) => <span key={t} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{t}</span>)}
          </div>
        )}
      </section>

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-base font-semibold">Cultures adaptées <span className="font-normal text-muted-foreground">({crops.length})</span></h2>
        {crops.length === 0
          ? <p className="text-sm text-muted-foreground">Aucune culture rattachée. La note d&apos;aptitude se définit depuis la fiche culture.</p>
          : (
            <ul className="space-y-1 text-sm">
              {crops.map((c) => (
                <li key={c.cropId} className="flex items-center gap-2">
                  <Badge variant="secondary">{labelOf(SUITABILITY_RATING_LABELS, c.rating)}</Badge>
                  <span>{c.cropName.fr ?? c.cropId}</span>
                  {c.justification && <span className="text-muted-foreground">— {c.justification}</span>}
                </li>
              ))}
            </ul>
          )}
        <p className="text-xs text-muted-foreground">Modifier l&apos;aptitude d&apos;une culture : depuis la fiche culture concernée.</p>
      </section>
    </div>
  );
}
