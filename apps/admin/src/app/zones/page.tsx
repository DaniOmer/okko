import Link from 'next/link';
import { listZones } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

export default async function ZonesPage() {
  const zones = await listZones().catch(() => []);
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Zones agro-écologiques</h1>
        <Button asChild>
          <Link href="/zones/new">Nouvelle zone</Link>
        </Button>
      </div>
      {zones.length === 0 ? (
        <div className="rounded border-2 border-dashed p-8 text-center text-muted-foreground">
          Aucune zone enregistrée.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead>Köppen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((z) => (
              <TableRow key={z.id}>
                <TableCell>{z.name}</TableCell>
                <TableCell>{z.country}</TableCell>
                <TableCell>{z.koppen ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
