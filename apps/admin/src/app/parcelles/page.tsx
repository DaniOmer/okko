import { listParcels, listBeneficiaries, listZones } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ParcelleCreate } from './ParcelleForm.client';
import { ParcelleRowActions } from './ParcelleRowActions';

const WRITERS = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

export default async function ParcellesPage() {
  const session = getSession();
  const canWrite = session ? WRITERS.includes(session.role) : false;
  const [parcels, beneficiaries, zones] = await Promise.all([
    listParcels().catch(() => []), listBeneficiaries().catch(() => []), listZones().catch(() => []),
  ]);
  const beneName = Object.fromEntries(beneficiaries.map((b) => [b.id, b.name]));
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parcelles</h1>
          <p className="text-sm text-muted-foreground">Les parcelles suivies par votre organisation.</p>
        </div>
        {canWrite && <ParcelleCreate beneficiaries={beneficiaries} zones={zones} />}
      </div>
      {parcels.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune parcelle.</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Bénéficiaire</TableHead><TableHead>Zone</TableHead><TableHead>Surface (ha)</TableHead>{canWrite && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {parcels.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.beneficiaryId ? (beneName[p.beneficiaryId] ?? '—') : '—'}</TableCell>
                <TableCell>{p.zoneId ? (zoneName[p.zoneId] ?? '—') : '—'}</TableCell>
                <TableCell>{p.areaHectares ?? '—'}</TableCell>
                {canWrite && <TableCell className="text-right"><ParcelleRowActions p={p} beneficiaries={beneficiaries} zones={zones} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
