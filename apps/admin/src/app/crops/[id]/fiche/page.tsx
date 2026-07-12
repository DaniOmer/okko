import Link from 'next/link';
import { getCropPublished } from '../../../../lib/api';
import { labelOf, CYCLE_TYPE_LABELS } from '@/lib/labels';
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
  return (
    <main className="p-8 max-w-2xl mx-auto space-y-6">
      <header className="space-y-1 border-b pb-4">
        <h1 className="text-3xl font-bold">{crop.name} <em className="text-lg font-normal text-muted-foreground">{crop.scientificName}</em></h1>
        <p className="text-sm text-muted-foreground">{crop.family} · {labelOf(CYCLE_TYPE_LABELS, crop.cycleType)} · v{crop.publishedVersion}</p>
      </header>
      <FicheClientView crop={crop} />
      <Link href={`/crops/${params.id}`} className="text-xs text-muted-foreground hover:underline">← Retour à l&apos;administration</Link>
    </main>
  );
}
