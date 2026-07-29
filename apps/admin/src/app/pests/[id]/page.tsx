import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPest } from '../../../lib/api';
import { PestFicheView } from './PestFicheView';
import { PestBiologyEditor } from './editors/PestBiologyEditor';
import { PestDamageEditor } from './editors/PestDamageEditor';
import { PestDistributionEditor } from './editors/PestDistributionEditor';
import { PestManagementEditor } from './editors/PestManagementEditor';
import { PestSourcesEditor } from './editors/PestSourcesEditor';
import { PestWeedEditor } from './editors/PestWeedEditor';
import { PestDiseaseEditor } from './editors/PestDiseaseEditor';

export default async function PestFichePage({ params }: { params: { id: string } }) {
  const pest = await getPest(params.id).catch(() => null);
  if (!pest) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <PestFicheView pest={pest} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Link href="/pests" className="text-xs text-muted-foreground hover:underline">← Retour à la liste</Link>
        <div className="flex gap-2">
          <PestBiologyEditor pest={pest} />
          <PestDamageEditor pest={pest} />
          {pest.kind === 'WEED' && <PestWeedEditor pest={pest} />}
          {pest.kind === 'DISEASE' && <PestDiseaseEditor pest={pest} />}
          <PestDistributionEditor pest={pest} />
          <PestManagementEditor pest={pest} />
          <PestSourcesEditor pest={pest} />
        </div>
      </div>
    </main>
  );
}
