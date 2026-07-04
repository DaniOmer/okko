import { getCrop } from '../../../lib/api';

export default async function CropDetailPage({ params }: { params: { id: string } }) {
  const crop = await getCrop(params.id);
  return (
    <main className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{crop.name} <em className="text-base text-gray-500">{crop.scientificName}</em></h1>
      <p className="text-sm">{crop.cycleType} · {crop.status} (v{crop.version})</p>

      <section>
        <h2 className="font-semibold mb-2">Exigences climatiques</h2>
        {crop.climatic?.temperature
          ? <p>Température : {crop.climatic.temperature.min}–{crop.climatic.temperature.optimal}–{crop.climatic.temperature.max} {crop.climatic.temperature.unit}</p>
          : <p className="text-gray-400">Non renseignées</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Exigences édaphiques</h2>
        {crop.edaphic?.ph
          ? <p>pH : {crop.edaphic.ph.min}–{crop.edaphic.ph.optimal}–{crop.edaphic.ph.max}</p>
          : <p className="text-gray-400">Non renseignées</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Variétés ({crop.varieties.length})</h2>
        <ul className="list-disc pl-5">
          {crop.varieties.map((v) => (
            <li key={v.id}>{v.name.fr}{v.maturityDays ? ` — ${v.maturityDays} j` : ''}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Zones ({crop.zones.length})</h2>
        <ul className="list-disc pl-5">
          {crop.zones.map((z) => (
            <li key={z.zoneId}>{z.zoneName.fr} — <strong>{z.rating}</strong>{z.justification ? ` (${z.justification})` : ''}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Phénologie ({crop.phenology.length})</h2>
        <ul className="list-disc pl-5">
          {crop.phenology.map((p) => (
            <li key={p.order}>{p.name.fr} — J{p.startDay} à J{p.endDay}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Fenêtres de production ({crop.croppingWindows.length})</h2>
        {crop.croppingWindows.map((w) => (
          <div key={w.id} className="mb-3">
            <p className="font-medium">{w.season}{w.irrigationRequired ? ' · irrigation requise' : ''}</p>
            <ul className="list-disc pl-5 text-sm">
              {w.operations.map((op, i) => (
                <li key={i}>J+{op.timingDays} — {op.label.fr} ({op.type})</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
