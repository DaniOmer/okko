import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCropPublished } from '../../../../lib/api';
import { CropReadView } from '../CropReadView';

export default async function PublishedCropPage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) notFound();

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link href={`/crops/${params.id}`} className="text-sm text-primary hover:underline">← Retour au brouillon</Link>
        <h1 className="text-2xl font-bold">
          {crop.name} <em className="text-base font-normal text-muted-foreground">{crop.scientificName}</em>
        </h1>
        <div className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Version publiée (figée) — v{crop.publishedVersion}. Lecture seule.
        </div>
      </div>
      <CropReadView crop={crop} />
    </main>
  );
}
