import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPest } from '../../../lib/api';
import { PestFicheView } from './PestFicheView';
import { PestBiologyEditor } from './editors/PestBiologyEditor';

export default async function PestFichePage({ params }: { params: { id: string } }) {
  const pest = await getPest(params.id).catch(() => null);
  if (!pest) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <PestFicheView pest={pest} />
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <Link href="/pests" className="text-xs text-muted-foreground hover:underline">← Retour à la liste</Link>
        <PestBiologyEditor pest={pest} />
      </div>
    </main>
  );
}
