import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCropPublished, listPests, listZones } from '../../../../lib/api';
import { FicheClientView } from '../FicheClientView';

export default async function PublishedCropPage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) notFound();
  const [pests, zones] = await Promise.all([listPests().catch(() => []), listZones().catch(() => [])]);
  const pestNames = Object.fromEntries(pests.map((p) => [p.id, p.name]));
  const zoneNames = Object.fromEntries(zones.map((z) => [z.id, z.name]));

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <FicheClientView
        crop={crop}
        pestNames={pestNames}
        zoneNames={zoneNames}
        hideEmpty
        stamp={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf3ea] px-2.5 py-0.5 text-xs font-medium text-[#245c27]">
            🔒 Publié · v{crop.publishedVersion}
          </span>
        }
      />
      <Link href={`/crops/${params.id}`} className="mt-6 inline-block text-xs text-muted-foreground hover:underline">
        ← Retour à l&apos;administration
      </Link>
    </main>
  );
}
