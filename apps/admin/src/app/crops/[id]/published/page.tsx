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
          <h1 className="text-2xl font-bold">
            {crop.name}{' '}
            <em className="text-base font-normal text-muted-foreground">{crop.scientificName}</em>
          </h1>
          <p className="text-sm text-muted-foreground">
            {crop.family} · {labelOf(CYCLE_TYPE_LABELS, crop.cycleType)}
            {crop.usageCategory ? ` · ${labelOf(USAGE_CATEGORY_LABELS, crop.usageCategory)}` : ''}
          </p>
        </div>
        <Link href={`/crops/${params.id}`} className="shrink-0 text-sm text-primary hover:underline">
          ← Retour au brouillon
        </Link>
      </div>
      <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        🔒 Version publiée figée — v{crop.publishedVersion} · lecture seule
      </div>
      <CropReadView crop={crop} pestNames={pestNames} zoneNames={zoneNames} />
    </main>
  );
}
