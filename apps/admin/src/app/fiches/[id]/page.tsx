import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCropPublished } from '@/lib/api';
import { FicheClientView } from '../../crops/[id]/FicheClientView';

export default async function TenantFichePage({ params }: { params: { id: string } }) {
  const crop = await getCropPublished(params.id).catch(() => null);
  if (!crop) notFound();
  // Build name maps from the embedded crop document — no superadmin endpoints needed.
  const pestNames: Record<string, string> = Object.fromEntries(
    crop.pests.map((p) => [p.pestId, p.pestName.fr ?? '']),
  );
  const zoneNames: Record<string, string> = Object.fromEntries(
    crop.zones.map((z) => [z.zoneId, z.zoneName.fr ?? '']),
  );
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
      <Link href="/fiches" className="mt-6 inline-block text-xs text-muted-foreground hover:underline">← Retour aux fiches</Link>
    </main>
  );
}
