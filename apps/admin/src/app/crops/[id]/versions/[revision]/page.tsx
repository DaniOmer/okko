import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCropVersion, listPests, listZones } from '../../../../../lib/api';
import { CropReadView } from '../../CropReadView';
import { RestoreButton } from '../RestoreButton';

export default async function CropVersionPage({ params }: { params: { id: string; revision: string } }) {
  const revision = Number(params.revision);
  const version = await getCropVersion(params.id, revision).catch(() => null);
  if (!version) notFound();
  const [pests, zones] = await Promise.all([listPests().catch(() => []), listZones().catch(() => [])]);
  const pestNames = Object.fromEntries(pests.map((p) => [p.id, p.name]));
  const zoneNames = Object.fromEntries(zones.map((z) => [z.id, z.name]));

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link href={`/crops/${params.id}/versions`} className="text-sm text-primary hover:underline">← Retour aux versions</Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">
            {version.name} <em className="text-base font-normal text-muted-foreground">{version.scientificName}</em>
          </h1>
          <RestoreButton cropId={params.id} revision={revision} />
        </div>
        <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Version {revision} (figée) — Lecture seule.
        </div>
      </div>
      <CropReadView crop={version} pestNames={pestNames} zoneNames={zoneNames} />
    </main>
  );
}
