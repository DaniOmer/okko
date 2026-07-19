import Link from 'next/link';
import { listZones } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ZoneRowActions } from './ZoneRowActions';

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
              <TableHead className="w-12"></TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead>Köppen</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((z) => (
              <TableRow key={z.id}>
                <TableCell>
                  {z.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={z.images[0].url} alt={z.images[0].caption ?? ''} className="h-8 w-10 rounded object-cover" />
                  )}
                </TableCell>
                <TableCell>{z.name}</TableCell>
                <TableCell>{z.country}</TableCell>
                <TableCell>{z.koppen ?? '—'}</TableCell>
                <TableCell className="text-right"><ZoneRowActions zone={z} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
