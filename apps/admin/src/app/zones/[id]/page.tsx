import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getZone, getZoneCrops, getZonePests, listPests } from '@/lib/api';
import { ZoneFicheView } from './ZoneFicheView';
import { ZonePestPresenceEditor } from './ZonePestPresenceEditor';

export default async function ZoneFichePage({ params }: { params: { id: string } }) {
  const zone = await getZone(params.id).catch(() => null);
  if (!zone) notFound();
  const [crops, pests, allPests] = await Promise.all([
    getZoneCrops(params.id).catch(() => []),
    getZonePests(params.id).catch(() => []),
    listPests().catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href="/zones" className="text-xs text-muted-foreground hover:underline">← Retour aux zones</Link>
      <div className="mt-4">
        <ZoneFicheView zone={zone} crops={crops} />
        <ZonePestPresenceEditor zoneId={params.id} links={pests} allPests={allPests.map((p) => ({ id: p.id, name: p.name, kind: p.kind }))} />
      </div>
    </main>
  );
}
