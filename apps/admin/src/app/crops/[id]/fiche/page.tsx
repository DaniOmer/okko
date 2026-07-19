import Link from 'next/link';
import { getCropPublished, listPests, listZones } from '../../../../lib/api';
import { FicheClientView } from '../FicheClientView';

export default async function FicheClientPage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) {
    return (
      <main className="p-8 max-w-2xl mx-auto space-y-4">
        <Link href={`/crops/${params.id}`} className="text-sm text-primary hover:underline">← Retour</Link>
        <p className="text-muted-foreground">Cette fiche n&apos;est pas encore publiée.</p>
      </main>
    );
  }
  const [pests, zones] = await Promise.all([listPests().catch(() => []), listZones().catch(() => [])]);
  const pestNames = Object.fromEntries(pests.map((p) => [p.id, p.name]));
  const zoneNames = Object.fromEntries(zones.map((z) => [z.id, z.name]));

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <FicheClientView crop={crop} pestNames={pestNames} zoneNames={zoneNames} />
      <Link href={`/crops/${params.id}`} className="mt-6 inline-block text-xs text-muted-foreground hover:underline">← Retour à l&apos;administration</Link>
    </main>
  );
}
