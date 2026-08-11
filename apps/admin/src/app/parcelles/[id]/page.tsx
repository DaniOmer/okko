import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listParcels, listCampaigns, listPublishedCrops } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CampaignEditor } from './CampaignForm.client';
import { CampaignRowActions } from './CampaignRowActions';

const WRITERS = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'En cours', CLOSED: 'Terminée' };

export default async function ParcelleDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  const canWrite = session ? WRITERS.includes(session.role) : false;
  const [parcels, campaigns, crops] = await Promise.all([
    listParcels().catch(() => []), listCampaigns(params.id).catch(() => []), listPublishedCrops().catch(() => []),
  ]);
  const parcel = parcels.find((p) => p.id === params.id);
  if (!parcel) notFound();
  const cropName = Object.fromEntries(crops.map((c) => [c.id, c.name]));
  return (
    <main className="space-y-6">
      <div>
        <Link href="/parcelles" className="text-xs text-muted-foreground hover:underline">← Retour aux parcelles</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{parcel.name}</h1>
          {canWrite && <CampaignEditor parcelId={parcel.id} crops={crops} trigger={<Button>Nouvelle campagne</Button>} />}
        </div>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune campagne sur cette parcelle.</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Culture</TableHead><TableHead>Saison</TableHead><TableHead>Statut</TableHead><TableHead>Journal</TableHead>{canWrite && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.cropId ? (cropName[c.cropId] ?? c.cropId) : (c.customCropName ?? '—')}</TableCell>
                <TableCell>{c.season}</TableCell>
                <TableCell>{STATUS_LABELS[c.status] ?? c.status}</TableCell>
                <TableCell><Link href={`/parcelles/${parcel.id}/campagnes/${c.id}`} className="text-primary hover:underline">Ouvrir</Link></TableCell>
                {canWrite && <TableCell className="text-right"><CampaignRowActions campaign={c} crops={crops} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
